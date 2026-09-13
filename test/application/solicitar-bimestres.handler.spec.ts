import { SolicitarBimestresCommand } from '../../src/application/commands/solicitar-bimestres.command';
import { SolicitarBimestresHandler } from '../../src/application/commands/solicitar-bimestres.handler';
import { CargadorDelRegistro } from '../../src/application/services/cargador-del-registro';
import { Solicitante } from '../../src/domain/entities/solicitante.entity';
import { EstadoEntrega } from '../../src/domain/value-objects/estado-entrega';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { BimestreBloqueadoError } from '../../src/domain/errors/bimestre-bloqueado.error';
import { BimestreInexistenteError } from '../../src/domain/errors/bimestre-inexistente.error';
import { MontoExcedeLimiteError } from '../../src/domain/errors/monto-excede-limite.error';
import { MontoNoCapturableError } from '../../src/domain/errors/monto-no-capturable.error';
import { MontoRequeridoError } from '../../src/domain/errors/monto-requerido.error';
import { PeriodoSolicitudCerradoError } from '../../src/domain/errors/periodo-solicitud-cerrado.error';
import { PeriodoYaSolicitadoConOtroMontoError } from '../../src/domain/errors/periodo-ya-solicitado-con-otro-monto.error';
import { SolicitanteNoEncontradoError } from '../../src/domain/errors/solicitante-no-encontrado.error';
import { SueldoBaseNoRegistradoError } from '../../src/domain/errors/sueldo-base-no-registrado.error';
import {
  RepositorioSolicitantesEnMemoria,
  RepositorioSolicitudesEnMemoria,
} from '../support/repositorios-en-memoria';
import { RelojFijo } from '../support/reloj-fijo';

const ID_ALUMNO = 'alumno-1';
const ID_TRABAJADOR = 'trabajador-1';

const alumno = (): Solicitante =>
  Solicitante.registrar(SolicitanteId.de(ID_ALUMNO), TipoUsuario.ALUMNO);

const trabajador = (sueldo: string | null = '12345.67'): Solicitante =>
  Solicitante.reconstituir(
    SolicitanteId.de(ID_TRABAJADOR),
    TipoUsuario.TRABAJADOR,
    sueldo === null ? null : SueldoBase.desdePesos(sueldo),
  );

/** Monta el caso de uso con el reloj plantado en una fecha de México. */
const escenario = (
  solicitantes: Solicitante[],
  fecha: { mes: number; dia: number; anio?: number } = { mes: 1, dia: 15 },
) => {
  const reloj = RelojFijo.enMexico(fecha.anio ?? 2026, fecha.mes, fecha.dia);
  const repoSolicitantes = new RepositorioSolicitantesEnMemoria(...solicitantes);
  const repoSolicitudes = new RepositorioSolicitudesEnMemoria();
  const registros = new CargadorDelRegistro(reloj, repoSolicitantes, repoSolicitudes);
  return {
    handler: new SolicitarBimestresHandler(registros, repoSolicitudes),
    repoSolicitudes,
  };
};

describe('SolicitarBimestresHandler (CU-D01, CU-D02)', () => {
  describe('alumno: monto elegido y validado (RN-09)', () => {
    it('registra los bimestres pedidos y devuelve el estado del registro', async () => {
      const { handler, repoSolicitudes } = escenario([alumno()]);

      const resultado = await handler.execute(
        new SolicitarBimestresCommand(ID_ALUMNO, [
          { mesReferencia: 2, montoEnPesos: '1000.00' },
          { mesReferencia: 10, montoEnPesos: '3500.00' },
        ]),
      );

      expect(resultado.agregados).toEqual(['2026-02', '2026-10']);
      expect(resultado.sinCambios).toEqual([]);
      expect(resultado.solicitud.totalEnPesos).toBe('4500.00');
      expect(resultado.solicitud.anio).toBe(2026);
      expect(repoSolicitudes.guardados).toBe(1);
    });

    it('el modelo de lectura trae el periodo, el monto y el estado de entrega derivado', async () => {
      const { handler } = escenario([alumno()]);

      const resultado = await handler.execute(
        new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 10, montoEnPesos: '500.00' }]),
      );

      expect(resultado.solicitud.periodos).toEqual([
        {
          clave: '2026-10',
          tipo: 'bimestre',
          mesReferencia: 10,
          inicio: '2026-09-01',
          fin: '2026-10-31',
          montoEnPesos: '500.00',
          fechaSolicitud: '2026-01-15',
          estadoEntrega: EstadoEntrega.PENDIENTE,
        },
      ]);
    });

    it('rechaza el lote entero si un monto excede el tope, sin guardar nada (RN-18)', async () => {
      const { handler, repoSolicitudes } = escenario([alumno()]);

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_ALUMNO, [
            { mesReferencia: 2, montoEnPesos: '1000.00' },
            { mesReferencia: 4, montoEnPesos: '3500.01' },
          ]),
        ),
      ).rejects.toThrow(MontoExcedeLimiteError);
      expect(repoSolicitudes.guardados).toBe(0);
    });

    it('exige que el alumno indique monto (EC-18)', async () => {
      const { handler } = escenario([alumno()]);

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 2, montoEnPesos: null }]),
        ),
      ).rejects.toThrow(MontoRequeridoError);
    });
  });

  describe('trabajador: monto calculado (RN-08)', () => {
    it('calcula el 16 % del sueldo vigente sin que el usuario capture nada', async () => {
      const { handler } = escenario([trabajador()]);

      const resultado = await handler.execute(
        new SolicitarBimestresCommand(ID_TRABAJADOR, [
          { mesReferencia: 2, montoEnPesos: null },
          { mesReferencia: 4, montoEnPesos: null },
        ]),
      );

      expect(resultado.solicitud.periodos.map((p) => p.montoEnPesos)).toEqual([
        '1975.31',
        '1975.31',
      ]);
      expect(resultado.solicitud.totalEnPesos).toBe('3950.62');
    });

    it('rechaza que capture el monto (EC-05)', async () => {
      const { handler } = escenario([trabajador()]);

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_TRABAJADOR, [
            { mesReferencia: 2, montoEnPesos: '1975.31' },
          ]),
        ),
      ).rejects.toThrow(MontoNoCapturableError);
    });

    it('no deja solicitar sin sueldo base capturado (EC-06)', async () => {
      const { handler } = escenario([trabajador(null)]);

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 2, montoEnPesos: null }]),
        ),
      ).rejects.toThrow(SueldoBaseNoRegistradoError);
    });
  });

  describe('calendario (RN-04, RN-05)', () => {
    it('rechaza un bimestre ya transcurrido (EC-01)', async () => {
      const { handler } = escenario([alumno()], { mes: 3, dia: 1 });

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 2, montoEnPesos: '100.00' }]),
        ),
      ).rejects.toThrow(BimestreBloqueadoError);
    });

    it('informa de temporada cerrada una vez pasado octubre (EC-02)', async () => {
      const { handler } = escenario([alumno()], { mes: 11, dia: 1 });

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 10, montoEnPesos: '100.00' }]),
        ),
      ).rejects.toThrow(PeriodoSolicitudCerradoError);
    });

    it('rechaza un mes que no es bimestre (EC-09)', async () => {
      const { handler } = escenario([alumno()]);

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 3, montoEnPesos: '100.00' }]),
        ),
      ).rejects.toThrow(BimestreInexistenteError);
    });

    it('usa el año del reloj, no uno que mande el cliente (RN-06)', async () => {
      const { handler } = escenario([alumno()], { mes: 1, dia: 15, anio: 2027 });

      const resultado = await handler.execute(
        new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 2, montoEnPesos: '100.00' }]),
      );

      expect(resultado.agregados).toEqual(['2027-02']);
      expect(resultado.solicitud.anio).toBe(2027);
    });
  });

  describe('idempotencia y acumulación (RN-06, RN-18)', () => {
    it('acumula entre llamadas sin reemplazar lo anterior', async () => {
      const { handler } = escenario([alumno()]);

      await handler.execute(
        new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 2, montoEnPesos: '100.00' }]),
      );
      const segunda = await handler.execute(
        new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 6, montoEnPesos: '200.00' }]),
      );

      expect(segunda.agregados).toEqual(['2026-06']);
      expect(segunda.solicitud.periodos.map((p) => p.clave)).toEqual(['2026-02', '2026-06']);
      expect(segunda.solicitud.totalEnPesos).toBe('300.00');
    });

    it('repetir la misma petición no duplica NI GUARDA de nuevo (EC-10)', async () => {
      const { handler, repoSolicitudes } = escenario([alumno()]);
      const comando = new SolicitarBimestresCommand(ID_ALUMNO, [
        { mesReferencia: 2, montoEnPesos: '100.00' },
      ]);

      await handler.execute(comando);
      const repeticion = await handler.execute(comando);

      expect(repeticion.agregados).toEqual([]);
      expect(repeticion.sinCambios).toEqual(['2026-02']);
      expect(repeticion.solicitud.periodos).toHaveLength(1);
      // Una escritura inútil haría avanzar la versión del registro y provocaría
      // conflictos de concurrencia artificiales (RN-15).
      expect(repoSolicitudes.guardados).toBe(1);
    });

    it('repetir con otro monto es conflicto (EC-11)', async () => {
      const { handler } = escenario([alumno()]);
      await handler.execute(
        new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 2, montoEnPesos: '100.00' }]),
      );

      await expect(
        handler.execute(
          new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 2, montoEnPesos: '200.00' }]),
        ),
      ).rejects.toThrow(PeriodoYaSolicitadoConOtroMontoError);
    });
  });

  it('falla si el solicitante no existe', async () => {
    const { handler } = escenario([]);

    await expect(
      handler.execute(
        new SolicitarBimestresCommand('fantasma', [{ mesReferencia: 2, montoEnPesos: '100.00' }]),
      ),
    ).rejects.toThrow(SolicitanteNoEncontradoError);
  });
});
