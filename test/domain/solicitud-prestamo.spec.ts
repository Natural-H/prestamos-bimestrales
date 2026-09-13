import { SolicitudPrestamo } from '../../src/domain/entities/solicitud-prestamo.entity';
import { PoliticaPrestamoAlumno } from '../../src/domain/services/politica-prestamo-alumno';
import { PoliticaPrestamoTrabajador } from '../../src/domain/services/politica-prestamo-trabajador';
import { Bimestre, MesReferencia } from '../../src/domain/value-objects/bimestre';
import { EstadoEntrega } from '../../src/domain/value-objects/estado-entrega';
import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { Monto } from '../../src/domain/value-objects/monto';
import { PeriodoDiciembre } from '../../src/domain/value-objects/periodo-diciembre';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { BimestreBloqueadoError } from '../../src/domain/errors/bimestre-bloqueado.error';
import { DiciembreExclusivoTrabajadoresError } from '../../src/domain/errors/diciembre-exclusivo-trabajadores.error';
import { MontoExcedeLimiteError } from '../../src/domain/errors/monto-excede-limite.error';
import { MontoNoCapturableError } from '../../src/domain/errors/monto-no-capturable.error';
import { PeriodoDeOtroAnioError } from '../../src/domain/errors/periodo-de-otro-anio.error';
import { PeriodoDiciembreCerradoError } from '../../src/domain/errors/periodo-diciembre-cerrado.error';
import { PeriodoSolicitudCerradoError } from '../../src/domain/errors/periodo-solicitud-cerrado.error';
import { PeriodoYaSolicitadoConOtroMontoError } from '../../src/domain/errors/periodo-ya-solicitado-con-otro-monto.error';
import { RelojFijo } from '../support/reloj-fijo';

const ANIO = 2026;
const ID = SolicitanteId.de('usuario-1');

const politicaAlumno = new PoliticaPrestamoAlumno();
const politicaTrabajador = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('12345.67'));

const hoyEnMexico = (mes: number, dia: number, anio = ANIO): FechaCivil =>
  FechaCivil.desdeInstante(RelojFijo.enMexico(anio, mes, dia).now());

const bimestre = (mes: MesReferencia, anio = ANIO): Bimestre => Bimestre.crear(mes, anio);
const diciembre = (anio = ANIO): PeriodoDiciembre => PeriodoDiciembre.delAnio(anio);

const registroVacio = (): SolicitudPrestamo => SolicitudPrestamo.crearVacia(ID, ANIO);

describe('SolicitudPrestamo (agregado)', () => {
  describe('registro único por usuario y año que acumula (RN-06)', () => {
    it('nace vacío y se va llenando con cada solicitud', () => {
      const solicitud = registroVacio();
      expect(solicitud.estaVacia).toBe(true);

      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1000.00') }],
        politicaAlumno,
        hoyEnMexico(1, 15),
      );

      expect(solicitud.estaVacia).toBe(false);
      expect(solicitud.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-02']);
    });

    it('AGREGA sin reemplazar lo solicitado antes', () => {
      const solicitud = registroVacio();
      const hoy = hoyEnMexico(1, 15);

      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1000.00') }],
        politicaAlumno,
        hoy,
      );
      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.JUNIO), montoCapturado: Monto.desdePesos('2000.00') }],
        politicaAlumno,
        hoy,
      );

      expect(solicitud.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-02', '2026-06']);
    });

    it('admite varios bimestres por adelantado en una sola operación (RN-03)', () => {
      const solicitud = registroVacio();

      const resultado = solicitud.agregar(
        Bimestre.todosDelAnio(ANIO).map((b) => ({
          periodo: b,
          montoCapturado: Monto.desdePesos('3500.00'),
        })),
        politicaAlumno,
        hoyEnMexico(2, 10),
      );

      expect(resultado.agregados).toEqual(['2026-02', '2026-04', '2026-06', '2026-08', '2026-10']);
      expect(solicitud.montoTotalVigente(politicaAlumno).aCadena()).toBe('17500.00');
    });

    it('rechaza periodos de otro año: cada año tiene su propio registro', () => {
      const solicitud = registroVacio();

      expect(() =>
        solicitud.agregar(
          [
            {
              periodo: bimestre(MesReferencia.FEBRERO, 2027),
              montoCapturado: Monto.desdePesos('10'),
            },
          ],
          politicaAlumno,
          hoyEnMexico(1, 15),
        ),
      ).toThrow(PeriodoDeOtroAnioError);
      expect(solicitud.estaVacia).toBe(true);
    });
  });

  describe('idempotencia (RN-18)', () => {
    it('repetir un periodo con los mismos datos es un no-op, no un error ni un duplicado', () => {
      const solicitud = registroVacio();
      const hoy = hoyEnMexico(1, 15);
      const peticion = [
        { periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1000.00') },
      ];

      solicitud.agregar(peticion, politicaAlumno, hoy);
      const segundoIntento = solicitud.agregar(peticion, politicaAlumno, hoy);

      expect(segundoIntento.agregados).toEqual([]);
      expect(segundoIntento.sinCambios).toEqual(['2026-02']);
      expect(solicitud.periodosSolicitados).toHaveLength(1);
    });

    it('para el trabajador la repetición siempre es idéntica: no captura monto', () => {
      const solicitud = registroVacio();
      const hoy = hoyEnMexico(1, 15);
      const peticion = [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: null }];

      solicitud.agregar(peticion, politicaTrabajador, hoy);
      const segundoIntento = solicitud.agregar(peticion, politicaTrabajador, hoy);

      expect(segundoIntento.sinCambios).toEqual(['2026-02']);
    });

    it('repetir un periodo del alumno con otro monto es conflicto y no modifica nada (EC-11)', () => {
      const solicitud = registroVacio();
      const hoy = hoyEnMexico(1, 15);
      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1000.00') }],
        politicaAlumno,
        hoy,
      );

      expect(() =>
        solicitud.agregar(
          [
            {
              periodo: bimestre(MesReferencia.FEBRERO),
              montoCapturado: Monto.desdePesos('2000.00'),
            },
          ],
          politicaAlumno,
          hoy,
        ),
      ).toThrow(PeriodoYaSolicitadoConOtroMontoError);
      expect(
        solicitud.montoVigenteDe(bimestre(MesReferencia.FEBRERO), politicaAlumno)?.aCadena(),
      ).toBe('1000.00');
    });

    it('un periodo ya registrado sigue siendo no-op aunque entretanto se haya bloqueado', () => {
      const solicitud = registroVacio();
      const peticion = [
        { periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1000.00') },
      ];
      solicitud.agregar(peticion, politicaAlumno, hoyEnMexico(1, 15));

      // Ya es junio: febrero lleva meses bloqueado, pero repetir lo ya registrado no falla.
      const repeticionTardia = solicitud.agregar(peticion, politicaAlumno, hoyEnMexico(6, 1));

      expect(repeticionTardia.sinCambios).toEqual(['2026-02']);
    });
  });

  describe('atomicidad: si un periodo del request choca, no se persiste ninguno (RN-18, EC-12)', () => {
    it('rechaza el lote completo cuando uno de los montos se sale del tope', () => {
      const solicitud = registroVacio();

      expect(() =>
        solicitud.agregar(
          [
            {
              periodo: bimestre(MesReferencia.FEBRERO),
              montoCapturado: Monto.desdePesos('1000.00'),
            },
            { periodo: bimestre(MesReferencia.ABRIL), montoCapturado: Monto.desdePesos('3500.01') },
            { periodo: bimestre(MesReferencia.JUNIO), montoCapturado: Monto.desdePesos('500.00') },
          ],
          politicaAlumno,
          hoyEnMexico(1, 15),
        ),
      ).toThrow(MontoExcedeLimiteError);

      expect(solicitud.estaVacia).toBe(true);
    });

    it('rechaza el lote completo cuando uno de los bimestres está bloqueado', () => {
      const solicitud = registroVacio();

      expect(() =>
        solicitud.agregar(
          [
            {
              periodo: bimestre(MesReferencia.OCTUBRE),
              montoCapturado: Monto.desdePesos('100.00'),
            },
            {
              periodo: bimestre(MesReferencia.FEBRERO),
              montoCapturado: Monto.desdePesos('100.00'),
            },
          ],
          politicaAlumno,
          hoyEnMexico(5, 1),
        ),
      ).toThrow(BimestreBloqueadoError);

      expect(solicitud.estaVacia).toBe(true);
    });

    it('no deja a medias un registro que ya tenía periodos', () => {
      const solicitud = registroVacio();
      const hoy = hoyEnMexico(1, 15);
      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('100.00') }],
        politicaAlumno,
        hoy,
      );

      expect(() =>
        solicitud.agregar(
          [
            { periodo: bimestre(MesReferencia.ABRIL), montoCapturado: Monto.desdePesos('100.00') },
            {
              periodo: bimestre(MesReferencia.JUNIO),
              montoCapturado: Monto.desdePesos('99999.00'),
            },
          ],
          politicaAlumno,
          hoy,
        ),
      ).toThrow(MontoExcedeLimiteError);

      expect(solicitud.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-02']);
    });
  });

  describe('bloqueo por fecha y cierre de temporada (RN-04, RN-05)', () => {
    it('rechaza un bimestre ya transcurrido con su error específico (EC-01)', () => {
      expect(() =>
        registroVacio().agregar(
          [
            {
              periodo: bimestre(MesReferencia.FEBRERO),
              montoCapturado: Monto.desdePesos('100.00'),
            },
          ],
          politicaAlumno,
          hoyEnMexico(3, 1),
        ),
      ).toThrow(BimestreBloqueadoError);
    });

    it('cuando ya pasó octubre informa de temporada cerrada, no de bimestre vencido (EC-02)', () => {
      expect(() =>
        registroVacio().agregar(
          [
            {
              periodo: bimestre(MesReferencia.OCTUBRE),
              montoCapturado: Monto.desdePesos('100.00'),
            },
          ],
          politicaAlumno,
          hoyEnMexico(11, 1),
        ),
      ).toThrow(PeriodoSolicitudCerradoError);
    });

    it('acepta el bimestre el último día de su periodo', () => {
      const solicitud = registroVacio();

      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('100.00') }],
        politicaAlumno,
        hoyEnMexico(2, 28),
      );

      expect(solicitud.periodosSolicitados).toHaveLength(1);
    });
  });

  describe('beneficio de diciembre (RN-10, RN-11, RN-12)', () => {
    it('el trabajador lo solicita y se acumula junto a sus bimestres', () => {
      const solicitud = registroVacio();
      const hoy = hoyEnMexico(9, 1);

      solicitud.agregar(
        [
          { periodo: bimestre(MesReferencia.OCTUBRE), montoCapturado: null },
          { periodo: diciembre(), montoCapturado: null },
        ],
        politicaTrabajador,
        hoy,
      );

      expect(solicitud.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-10', '2026-12']);
      expect(solicitud.montoVigenteDe(diciembre(), politicaTrabajador)?.aCadena()).toBe('3950.61');
      expect(
        solicitud.montoVigenteDe(bimestre(MesReferencia.OCTUBRE), politicaTrabajador)?.aCadena(),
      ).toBe('1975.31');
    });

    it('sigue disponible con la temporada de bimestres cerrada (RN-11)', () => {
      const solicitud = registroVacio();

      solicitud.agregar(
        [{ periodo: diciembre(), montoCapturado: null }],
        politicaTrabajador,
        hoyEnMexico(11, 15),
      );

      expect(solicitud.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-12']);
    });

    it('se puede solicitar hasta el 31 de diciembre, y no después (EC-08)', () => {
      const solicitud = registroVacio();
      solicitud.agregar(
        [{ periodo: diciembre(), montoCapturado: null }],
        politicaTrabajador,
        hoyEnMexico(12, 31),
      );
      expect(solicitud.periodosSolicitados).toHaveLength(1);

      expect(() =>
        registroVacio().agregar(
          [{ periodo: diciembre(), montoCapturado: null }],
          politicaTrabajador,
          hoyEnMexico(1, 1, 2027),
        ),
      ).toThrow(PeriodoDiciembreCerradoError);
    });

    it('el alumno no puede solicitarlo (EC-07)', () => {
      const solicitud = registroVacio();

      expect(() =>
        solicitud.agregar(
          [{ periodo: diciembre(), montoCapturado: null }],
          politicaAlumno,
          hoyEnMexico(12, 1),
        ),
      ).toThrow(DiciembreExclusivoTrabajadoresError);
      expect(solicitud.estaVacia).toBe(true);
    });
  });

  describe('montos por tipo de usuario', () => {
    it('rechaza que el trabajador capture monto, aunque el periodo sea nuevo (EC-05)', () => {
      expect(() =>
        registroVacio().agregar(
          [
            {
              periodo: bimestre(MesReferencia.FEBRERO),
              montoCapturado: Monto.desdePesos('1975.31'),
            },
          ],
          politicaTrabajador,
          hoyEnMexico(1, 15),
        ),
      ).toThrow(MontoNoCapturableError);
    });

    it('el monto del trabajador NO se guarda: se deriva del sueldo vigente (RN-20)', () => {
      const solicitud = registroVacio();
      solicitud.agregar(
        Bimestre.todosDelAnio(ANIO).map((b) => ({ periodo: b, montoCapturado: null })),
        politicaTrabajador,
        hoyEnMexico(1, 15),
      );

      expect(solicitud.periodosSolicitados.every((p) => p.montoCapturado === null)).toBe(true);
      expect(solicitud.montoTotalVigente(politicaTrabajador).aCadena()).toBe('9876.55');
    });

    it('al cambiar el sueldo cambian los montos del registro, sin tocarlo (CU-B02, RN-13)', () => {
      const solicitud = registroVacio();
      solicitud.agregar(
        [
          { periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: null },
          { periodo: diciembre(), montoCapturado: null },
        ],
        politicaTrabajador,
        hoyEnMexico(1, 15),
      );
      expect(solicitud.montoTotalVigente(politicaTrabajador).aCadena()).toBe('5925.92');

      const conAumento = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('20000.00'));

      // Mismo registro, misma lista de periodos: sólo cambió la política.
      expect(solicitud.montoTotalVigente(conAumento).aCadena()).toBe('9600.00');
      expect(solicitud.periodosSolicitados.map((p) => p.clave)).toEqual(['2026-02', '2026-12']);
    });

    it('el monto del alumno sí se guarda, porque lo eligió él (RN-09)', () => {
      const solicitud = registroVacio();
      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1234.56') }],
        politicaAlumno,
        hoyEnMexico(1, 15),
      );

      expect(solicitud.periodosSolicitados[0]?.montoCapturado?.aCadena()).toBe('1234.56');
    });
  });

  describe('estado de entrega derivado de la fecha (RN-07)', () => {
    it('solicitar por adelantado no adelanta la entrega', () => {
      const solicitud = registroVacio();
      const enero = hoyEnMexico(1, 15);
      solicitud.agregar(
        [
          { periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('100.00') },
          { periodo: bimestre(MesReferencia.OCTUBRE), montoCapturado: Monto.desdePesos('100.00') },
        ],
        politicaAlumno,
        enero,
      );

      // En enero: febrero (1 ene – 28 feb) está en curso; octubre (1 sep – 31 oct) aún no llega.
      expect(solicitud.estadoDeEntregaDe(bimestre(MesReferencia.FEBRERO), enero)).toBe(
        EstadoEntrega.EN_CURSO,
      );
      expect(solicitud.estadoDeEntregaDe(bimestre(MesReferencia.OCTUBRE), enero)).toBe(
        EstadoEntrega.PENDIENTE,
      );
    });

    it('un periodo transcurrido consta como entregado', () => {
      const solicitud = registroVacio();
      solicitud.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('100.00') }],
        politicaAlumno,
        hoyEnMexico(1, 15),
      );

      expect(solicitud.estadoDeEntregaDe(bimestre(MesReferencia.FEBRERO), hoyEnMexico(6, 1))).toBe(
        EstadoEntrega.ENTREGADO,
      );
    });

    it('no dice nada de un periodo que no se solicitó', () => {
      expect(
        registroVacio().estadoDeEntregaDe(bimestre(MesReferencia.ABRIL), hoyEnMexico(5, 1)),
      ).toBeNull();
      expect(
        registroVacio().montoVigenteDe(bimestre(MesReferencia.ABRIL), politicaAlumno),
      ).toBeNull();
    });
  });

  describe('reconstitución desde la persistencia', () => {
    it('conserva periodos, montos capturados y versión', () => {
      const original = registroVacio();
      original.agregar(
        [{ periodo: bimestre(MesReferencia.FEBRERO), montoCapturado: Monto.desdePesos('1000.00') }],
        politicaAlumno,
        hoyEnMexico(1, 15),
      );

      const recuperada = SolicitudPrestamo.reconstituir(ID, ANIO, original.periodosSolicitados, 7);

      expect(recuperada.version).toBe(7);
      expect(recuperada.montoTotalVigente(politicaAlumno).aCadena()).toBe('1000.00');
      expect(recuperada.tieneSolicitado(bimestre(MesReferencia.FEBRERO))).toBe(true);
    });
  });
});
