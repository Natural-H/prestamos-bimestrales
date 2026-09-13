import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { SolicitudPrestamo } from '../../src/domain/entities/solicitud-prestamo.entity';
import { ConflictoDeConcurrenciaError } from '../../src/domain/errors/conflicto-de-concurrencia.error';
import { PoliticaPrestamoAlumno } from '../../src/domain/services/politica-prestamo-alumno';
import { PoliticaPrestamoTrabajador } from '../../src/domain/services/politica-prestamo-trabajador';
import { Bimestre, MesReferencia } from '../../src/domain/value-objects/bimestre';
import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { Monto } from '../../src/domain/value-objects/monto';
import { PeriodoDiciembre } from '../../src/domain/value-objects/periodo-diciembre';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { opcionesDeConexion } from '../../src/infrastructure/config/data-source';
import { SolicitanteOrmEntity } from '../../src/infrastructure/persistence/typeorm/entities/solicitante.orm-entity';
import {
  PeriodoSolicitadoOrmEntity,
  SolicitudPrestamoOrmEntity,
} from '../../src/infrastructure/persistence/typeorm/entities/solicitud-prestamo.orm-entity';
import { SolicitudPrestamoRepositoryImpl } from '../../src/infrastructure/persistence/typeorm/repositories/solicitud-prestamo.repository.impl';

/**
 * Pruebas de integración del repositorio de solicitudes, **contra PostgreSQL
 * real**.
 *
 * ## Por qué éstas no pueden ser unitarias
 *
 * El resto del proyecto se prueba con dobles en memoria, y está bien: las reglas
 * de negocio viven en el dominio y no necesitan base de datos. Pero hay dos
 * garantías que **sólo existen dentro de Postgres** y que un doble no puede
 * demostrar:
 *
 * 1. El **bloqueo optimista** (RN-15): que dos operaciones simultáneas sobre el
 *    mismo registro no se pisen. El agregado garantiza la coherencia de *una*
 *    operación; que dos procesos que no comparten memoria no se sobrescriban lo
 *    garantiza el `UPDATE ... WHERE version = :version`.
 * 2. El **mapeo entre las filas y el agregado**: que el `numeric` vuelva como
 *    cadena sin perder precisión (RN-14) y que la columna `date` se reconstruya
 *    como día civil y no como instante (RN-04).
 *
 * Requieren `npm run db:up` y `npm run migration:run`. Se ejecutan con
 * `npm run test:int`, no con `npm test`.
 *
 * Cada prueba usa un solicitante con identificador propio y lo borra al final,
 * así que no ensucian los datos del seed ni chocan entre ellas.
 */
describe('SolicitudPrestamoRepositoryImpl (integración)', () => {
  const ANIO = 2026;
  const HOY = FechaCivil.de(ANIO, 1, 15);
  const politicaAlumno = new PoliticaPrestamoAlumno();
  const politicaTrabajador = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('12345.67'));

  let dataSource: DataSource;
  let repositorio: SolicitudPrestamoRepositoryImpl;
  const solicitantesCreados: string[] = [];

  beforeAll(async () => {
    dataSource = await new DataSource(opcionesDeConexion()).initialize();
    // El adaptador sólo necesita el DataSource; se construye a mano porque estas
    // pruebas no levantan NestJS.
    repositorio = new SolicitudPrestamoRepositoryImpl(dataSource);
  });

  afterAll(async () => {
    if (solicitantesCreados.length > 0) {
      // El borrado en cascada se lleva por delante solicitudes y periodos.
      await dataSource.getRepository(SolicitanteOrmEntity).delete(solicitantesCreados);
    }
    await dataSource.destroy();
  });

  /** Da de alta un solicitante de usar y tirar, y devuelve su identificador. */
  const nuevoSolicitante = async (tipoUsuario: 'alumno' | 'trabajador'): Promise<SolicitanteId> => {
    const id = randomUUID();
    solicitantesCreados.push(id);
    await dataSource.getRepository(SolicitanteOrmEntity).save({
      id,
      tipoUsuario,
      sueldoBase: tipoUsuario === 'trabajador' ? '12345.67' : null,
    });
    return SolicitanteId.de(id);
  };

  const versionEnBd = async (solicitanteId: SolicitanteId): Promise<number | null> => {
    const fila = await dataSource.getRepository(SolicitudPrestamoOrmEntity).findOne({
      where: { solicitanteId: solicitanteId.valor, anio: ANIO },
      select: { version: true },
    });
    return fila?.version ?? null;
  };

  const periodosEnBd = async (solicitanteId: SolicitanteId): Promise<number> => {
    return dataSource
      .getRepository(PeriodoSolicitadoOrmEntity)
      .createQueryBuilder('periodo')
      .innerJoin('periodo.solicitud', 'solicitud')
      .where('solicitud.solicitante_id = :id AND solicitud.anio = :anio', {
        id: solicitanteId.valor,
        anio: ANIO,
      })
      .getCount();
  };

  describe('mapeo entre las filas y el agregado', () => {
    it('conserva el monto capturado del alumno al centavo, sin pasar por coma flotante', async () => {
      const solicitanteId = await nuevoSolicitante('alumno');
      const solicitud = SolicitudPrestamo.crearVacia(solicitanteId, ANIO);
      solicitud.agregar(
        [
          {
            periodo: Bimestre.crear(MesReferencia.FEBRERO, ANIO),
            montoCapturado: Monto.desdePesos('1234.56'),
          },
          {
            periodo: Bimestre.crear(MesReferencia.OCTUBRE, ANIO),
            montoCapturado: Monto.desdePesos('3500.00'),
          },
        ],
        politicaAlumno,
        HOY,
      );

      await repositorio.guardar(solicitud);
      const recuperada = await repositorio.buscarPorSolicitanteYAnio(solicitanteId, ANIO);

      expect(recuperada).not.toBeNull();
      expect(recuperada?.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-02', '2026-10']);
      expect(recuperada?.montoTotalVigente(politicaAlumno).aCadena()).toBe('4734.56');
      expect(recuperada?.periodosSolicitados[0]?.fechaSolicitud.toString()).toBe('2026-01-15');
    });

    it('reconstruye diciembre como su propio value object, no como un bimestre (RN-11)', async () => {
      const solicitanteId = await nuevoSolicitante('trabajador');
      const solicitud = SolicitudPrestamo.crearVacia(solicitanteId, ANIO);
      solicitud.agregar(
        [
          { periodo: Bimestre.crear(MesReferencia.OCTUBRE, ANIO), montoCapturado: null },
          { periodo: PeriodoDiciembre.delAnio(ANIO), montoCapturado: null },
        ],
        politicaTrabajador,
        HOY,
      );

      await repositorio.guardar(solicitud);
      const recuperada = await repositorio.buscarPorSolicitanteYAnio(solicitanteId, ANIO);

      const periodos = recuperada?.periodosSolicitados ?? [];
      expect(periodos.map((p) => p.periodo.tipo)).toEqual(['bimestre', 'diciembre']);
      // El monto del trabajador NO se guarda: se deriva del sueldo vigente (RN-20).
      expect(periodos.every((p) => p.montoCapturado === null)).toBe(true);
      expect(recuperada?.montoTotalVigente(politicaTrabajador).aCadena()).toBe('5925.92');
    });

    it('devuelve null cuando el usuario no tiene registro ese año', async () => {
      const solicitanteId = await nuevoSolicitante('alumno');

      await expect(repositorio.buscarPorSolicitanteYAnio(solicitanteId, ANIO)).resolves.toBeNull();
    });
  });

  describe('bloqueo optimista ante escrituras simultáneas (RN-15, EC-13)', () => {
    it('rechaza la segunda de dos operaciones concurrentes en vez de dejar que se pisen', async () => {
      const solicitanteId = await nuevoSolicitante('alumno');

      // Un registro ya existente, para que ambas operaciones compitan por
      // avanzar la MISMA versión.
      const inicial = SolicitudPrestamo.crearVacia(solicitanteId, ANIO);
      inicial.agregar(
        [
          {
            periodo: Bimestre.crear(MesReferencia.FEBRERO, ANIO),
            montoCapturado: Monto.desdePesos('100.00'),
          },
        ],
        politicaAlumno,
        HOY,
      );
      await repositorio.guardar(inicial);
      expect(await versionEnBd(solicitanteId)).toBe(1);

      /*
       * Dos usuarios —o dos pestañas— cargan el registro a la vez: cada uno
       * obtiene su propia instancia del agregado, ambas con la versión 1.
       */
      const cargaA = await repositorio.buscarPorSolicitanteYAnio(solicitanteId, ANIO);
      const cargaB = await repositorio.buscarPorSolicitanteYAnio(solicitanteId, ANIO);
      expect(cargaA?.version).toBe(1);
      expect(cargaB?.version).toBe(1);

      cargaA?.agregar(
        [
          {
            periodo: Bimestre.crear(MesReferencia.ABRIL, ANIO),
            montoCapturado: Monto.desdePesos('200.00'),
          },
        ],
        politicaAlumno,
        HOY,
      );
      cargaB?.agregar(
        [
          {
            periodo: Bimestre.crear(MesReferencia.JUNIO, ANIO),
            montoCapturado: Monto.desdePesos('300.00'),
          },
        ],
        politicaAlumno,
        HOY,
      );

      // Y guardan a la vez.
      const resultados = await Promise.allSettled([
        repositorio.guardar(cargaA as SolicitudPrestamo),
        repositorio.guardar(cargaB as SolicitudPrestamo),
      ]);

      const cumplidas = resultados.filter((r) => r.status === 'fulfilled');
      const rechazadas = resultados.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );

      // Exactamente una gana; la otra se entera, en vez de sobrescribir en silencio.
      expect(cumplidas).toHaveLength(1);
      expect(rechazadas).toHaveLength(1);
      expect(rechazadas[0]?.reason).toBeInstanceOf(ConflictoDeConcurrenciaError);

      // El registro queda coherente: la versión avanzó una sola vez y sólo se
      // agregó el periodo del ganador.
      expect(await versionEnBd(solicitanteId)).toBe(2);
      expect(await periodosEnBd(solicitanteId)).toBe(2);
    });

    it('la operación rechazada no deja nada a medias (RN-18)', async () => {
      const solicitanteId = await nuevoSolicitante('alumno');
      const inicial = SolicitudPrestamo.crearVacia(solicitanteId, ANIO);
      inicial.agregar(
        [
          {
            periodo: Bimestre.crear(MesReferencia.FEBRERO, ANIO),
            montoCapturado: Monto.desdePesos('100.00'),
          },
        ],
        politicaAlumno,
        HOY,
      );
      await repositorio.guardar(inicial);

      // Instancia obsoleta: en la base la versión ya es 1, pero ésta cree que es 0.
      const obsoleta = SolicitudPrestamo.crearVacia(solicitanteId, ANIO);
      obsoleta.agregar(
        [
          {
            periodo: Bimestre.crear(MesReferencia.AGOSTO, ANIO),
            montoCapturado: Monto.desdePesos('400.00'),
          },
        ],
        politicaAlumno,
        HOY,
      );

      await expect(repositorio.guardar(obsoleta)).rejects.toThrow(ConflictoDeConcurrenciaError);

      // Su periodo no se coló: la transacción entera se deshizo.
      expect(await periodosEnBd(solicitanteId)).toBe(1);
      expect(await versionEnBd(solicitanteId)).toBe(1);
    });
  });

  describe('unicidad de periodos dentro del registro (RN-15)', () => {
    it('guardar dos veces el mismo periodo no lo duplica', async () => {
      const solicitanteId = await nuevoSolicitante('trabajador');
      const solicitud = SolicitudPrestamo.crearVacia(solicitanteId, ANIO);
      solicitud.agregar(
        [{ periodo: Bimestre.crear(MesReferencia.OCTUBRE, ANIO), montoCapturado: null }],
        politicaTrabajador,
        HOY,
      );

      await repositorio.guardar(solicitud);
      // Se vuelve a guardar el mismo agregado recargado: el índice único y el
      // ON CONFLICT DO NOTHING tienen que absorberlo sin duplicar ni fallar.
      const recargada = await repositorio.buscarPorSolicitanteYAnio(solicitanteId, ANIO);
      await repositorio.guardar(recargada as SolicitudPrestamo);

      expect(await periodosEnBd(solicitanteId)).toBe(1);
    });
  });
});
