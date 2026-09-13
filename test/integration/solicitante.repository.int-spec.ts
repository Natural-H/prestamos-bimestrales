import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Solicitante } from '../../src/domain/entities/solicitante.entity';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { CredencialesAdapter } from '../../src/infrastructure/auth/credenciales.adapter';
import { opcionesDeConexion } from '../../src/infrastructure/config/data-source';
import { CredencialesOrmEntity } from '../../src/infrastructure/persistence/typeorm/entities/credenciales.orm-entity';
import { SolicitanteOrmEntity } from '../../src/infrastructure/persistence/typeorm/entities/solicitante.orm-entity';
import { SolicitanteRepositoryImpl } from '../../src/infrastructure/persistence/typeorm/repositories/solicitante.repository.impl';

/**
 * Pruebas de integración del solicitante y sus credenciales, **contra
 * PostgreSQL real**.
 *
 * Lo que aquí se verifica y un doble en memoria no puede demostrar:
 *
 * - que el `numeric` del sueldo base vuelva como **cadena** y conserve los
 *   centavos (RN-14);
 * - que las restricciones de la migración —el `CHECK` de sueldo positivo, la
 *   unicidad del correo— existan de verdad y no sólo en la entidad ORM;
 * - que el hash de scrypt sobreviva a un viaje de ida y vuelta por una columna
 *   `varchar(255)`.
 *
 * Requieren `npm run db:up` y `npm run migration:run`; se ejecutan con
 * `npm run test:int`.
 */
describe('SolicitanteRepositoryImpl y CredencialesAdapter (integración)', () => {
  let dataSource: DataSource;
  let repositorio: SolicitanteRepositoryImpl;
  let credenciales: CredencialesAdapter;
  let tablaSolicitantes: Repository<SolicitanteOrmEntity>;
  const creados: string[] = [];

  const nuevoId = (): SolicitanteId => {
    const id = randomUUID();
    creados.push(id);
    return SolicitanteId.de(id);
  };

  beforeAll(async () => {
    // Sin logging: varias pruebas provocan errores de la base a proposito y
    // su rastro en consola solo estorba.
    dataSource = await new DataSource({ ...opcionesDeConexion(), logging: false }).initialize();
    tablaSolicitantes = dataSource.getRepository(SolicitanteOrmEntity);
    repositorio = new SolicitanteRepositoryImpl(tablaSolicitantes);
    credenciales = new CredencialesAdapter(dataSource.getRepository(CredencialesOrmEntity));
  });

  afterAll(async () => {
    if (creados.length > 0) {
      await tablaSolicitantes.delete(creados);
    }
    await dataSource.destroy();
  });

  describe('ida y vuelta del solicitante', () => {
    it('conserva el tipo de usuario y la ausencia de sueldo de un alumno', async () => {
      const id = nuevoId();

      await repositorio.guardar(Solicitante.registrar(id, TipoUsuario.ALUMNO));
      const recuperado = await repositorio.buscarPorId(id);

      expect(recuperado?.tipoUsuario).toBe(TipoUsuario.ALUMNO);
      expect(recuperado?.sueldoBase).toBeNull();
      expect(recuperado?.tieneSueldoBase).toBe(false);
    });

    it('conserva el sueldo base al centavo, sin pasar por coma flotante (RN-14)', async () => {
      const id = nuevoId();
      const trabajador = Solicitante.registrar(id, TipoUsuario.TRABAJADOR);
      trabajador.capturarSueldoBase(SueldoBase.desdePesos('12345.67'));

      await repositorio.guardar(trabajador);
      const recuperado = await repositorio.buscarPorId(id);

      expect(recuperado?.sueldoBase?.monto.enCentavos).toBe(1234567);
      // Y el monto derivado sigue saliendo igual tras el viaje por la base.
      expect(recuperado?.politicaPrestamo().montoPrevistoParaBimestre()?.aCadena()).toBe('1975.31');
    });

    it('persiste la actualización del sueldo, que es lo que recalcula los montos (CU-B02)', async () => {
      const id = nuevoId();
      const trabajador = Solicitante.registrar(id, TipoUsuario.TRABAJADOR);
      trabajador.capturarSueldoBase(SueldoBase.desdePesos('12345.67'));
      await repositorio.guardar(trabajador);

      const cargado = await repositorio.buscarPorId(id);
      cargado?.actualizarSueldoBase(SueldoBase.desdePesos('20000.00'));
      await repositorio.guardar(cargado as Solicitante);

      const recargado = await repositorio.buscarPorId(id);
      expect(recargado?.sueldoBase?.monto.aCadena()).toBe('20000.00');
      expect(recargado?.politicaPrestamo().montoParaDiciembre().aCadena()).toBe('6400.00');
    });

    it('devuelve null si el solicitante no existe', async () => {
      await expect(repositorio.buscarPorId(SolicitanteId.de(randomUUID()))).resolves.toBeNull();
    });
  });

  describe('restricciones que impone la migración', () => {
    it('rechaza un sueldo base de cero o negativo (CHECK de la tabla)', async () => {
      const id = nuevoId();

      await expect(
        tablaSolicitantes.save({ id: id.valor, tipoUsuario: 'trabajador', sueldoBase: '0.00' }),
      ).rejects.toThrow(/CK_sueldo_base_positivo/);
    });

    it('el enum de la base impide siquiera guardar un tipo de usuario inventado (EC-20)', async () => {
      /*
       * Primera defensa: el tipo enum de la migración. La segunda es
       * `tipoUsuarioDesde`, que el repositorio aplica al leer y que tiene su
       * propia prueba unitaria. Hacen falta las dos: el enum protege de datos
       * corruptos y el traductor protege de que alguien amplíe el enum sin
       * ampliar el dominio.
       */
      await expect(
        dataSource.query(
          "INSERT INTO solicitantes (id, tipo_usuario) VALUES ($1, 'administrador')",
          [randomUUID()],
        ),
      ).rejects.toThrow();
    });
  });

  describe('credenciales contra la base real', () => {
    it('el hash sobrevive al viaje de ida y vuelta y verifica correctamente', async () => {
      const id = nuevoId();
      await repositorio.guardar(Solicitante.registrar(id, TipoUsuario.ALUMNO));
      const correo = `prueba-${id.valor}@tecnm.mx`;

      await credenciales.registrar(id, correo, 'prestamos2026');

      await expect(credenciales.existeCorreo(correo)).resolves.toBe(true);
      await expect(credenciales.verificar(correo, 'prestamos2026')).resolves.toEqual(id);
      await expect(credenciales.verificar(correo, 'otra-cosa')).resolves.toBeNull();
    });

    it('borrar al solicitante se lleva sus credenciales (ON DELETE CASCADE)', async () => {
      const id = SolicitanteId.de(randomUUID());
      await repositorio.guardar(Solicitante.registrar(id, TipoUsuario.ALUMNO));
      const correo = `efimero-${id.valor}@tecnm.mx`;
      await credenciales.registrar(id, correo, 'prestamos2026');

      await tablaSolicitantes.delete(id.valor);

      await expect(credenciales.existeCorreo(correo)).resolves.toBe(false);
    });
  });
});
