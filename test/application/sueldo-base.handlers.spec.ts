import { ActualizarSueldoBaseCommand } from '../../src/application/commands/actualizar-sueldo-base.command';
import { ActualizarSueldoBaseHandler } from '../../src/application/commands/actualizar-sueldo-base.handler';
import { CapturarSueldoBaseCommand } from '../../src/application/commands/capturar-sueldo-base.command';
import { CapturarSueldoBaseHandler } from '../../src/application/commands/capturar-sueldo-base.handler';
import { SolicitarBimestresCommand } from '../../src/application/commands/solicitar-bimestres.command';
import { SolicitarBimestresHandler } from '../../src/application/commands/solicitar-bimestres.handler';
import { SolicitarDiciembreCommand } from '../../src/application/commands/solicitar-diciembre.command';
import { SolicitarDiciembreHandler } from '../../src/application/commands/solicitar-diciembre.handler';
import { ObtenerMiSolicitudHandler } from '../../src/application/queries/obtener-mi-solicitud.handler';
import { ObtenerMiSolicitudQuery } from '../../src/application/queries/obtener-mi-solicitud.query';
import { CargadorDelRegistro } from '../../src/application/services/cargador-del-registro';
import { Solicitante } from '../../src/domain/entities/solicitante.entity';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { SueldoBaseInvalidoError } from '../../src/domain/errors/sueldo-base-invalido.error';
import { SueldoBaseNoRegistradoError } from '../../src/domain/errors/sueldo-base-no-registrado.error';
import { SueldoBaseSoloTrabajadoresError } from '../../src/domain/errors/sueldo-base-solo-trabajadores.error';
import { SueldoBaseYaRegistradoError } from '../../src/domain/errors/sueldo-base-ya-registrado.error';
import {
  RepositorioSolicitantesEnMemoria,
  RepositorioSolicitudesEnMemoria,
} from '../support/repositorios-en-memoria';
import { RelojFijo } from '../support/reloj-fijo';

const ID_ALUMNO = 'alumno-1';
const ID_TRABAJADOR = 'trabajador-1';

const escenario = (sueldoInicial: string | null) => {
  const reloj = RelojFijo.enMexico(2026, 1, 15);
  const repoSolicitantes = new RepositorioSolicitantesEnMemoria(
    Solicitante.registrar(SolicitanteId.de(ID_ALUMNO), TipoUsuario.ALUMNO),
    Solicitante.reconstituir(
      SolicitanteId.de(ID_TRABAJADOR),
      TipoUsuario.TRABAJADOR,
      sueldoInicial === null ? null : SueldoBase.desdePesos(sueldoInicial),
    ),
  );
  const repoSolicitudes = new RepositorioSolicitudesEnMemoria();
  const registros = new CargadorDelRegistro(reloj, repoSolicitantes, repoSolicitudes);
  return {
    capturar: new CapturarSueldoBaseHandler(repoSolicitantes),
    actualizar: new ActualizarSueldoBaseHandler(repoSolicitantes),
    solicitarBimestres: new SolicitarBimestresHandler(registros, repoSolicitudes),
    solicitarDiciembre: new SolicitarDiciembreHandler(registros, repoSolicitudes),
    consultar: new ObtenerMiSolicitudHandler(registros),
    repoSolicitudes,
  };
};

describe('CapturarSueldoBaseHandler (CU-B01)', () => {
  it('captura el sueldo y lo devuelve en forma canónica', async () => {
    const { capturar } = escenario(null);

    const resultado = await capturar.execute(
      new CapturarSueldoBaseCommand(ID_TRABAJADOR, '12345.6'),
    );

    expect(resultado).toEqual({ solicitanteId: ID_TRABAJADOR, sueldoBaseEnPesos: '12345.60' });
  });

  it('habilita solicitar, que antes fallaba (EC-06)', async () => {
    const { capturar, solicitarBimestres } = escenario(null);
    const comando = new SolicitarBimestresCommand(ID_TRABAJADOR, [
      { mesReferencia: 2, montoEnPesos: null },
    ]);

    await expect(solicitarBimestres.execute(comando)).rejects.toThrow(SueldoBaseNoRegistradoError);

    await capturar.execute(new CapturarSueldoBaseCommand(ID_TRABAJADOR, '12345.67'));

    await expect(solicitarBimestres.execute(comando)).resolves.toMatchObject({
      agregados: ['2026-02'],
    });
  });

  it('no deja capturarlo dos veces: cambiarlo es otro caso de uso', async () => {
    const { capturar } = escenario('10000.00');

    await expect(
      capturar.execute(new CapturarSueldoBaseCommand(ID_TRABAJADOR, '20000.00')),
    ).rejects.toThrow(SueldoBaseYaRegistradoError);
  });

  it('no existe sueldo base para los alumnos', async () => {
    const { capturar } = escenario(null);

    await expect(
      capturar.execute(new CapturarSueldoBaseCommand(ID_ALUMNO, '10000.00')),
    ).rejects.toThrow(SueldoBaseSoloTrabajadoresError);
  });

  it('rechaza un sueldo de cero (EC-19)', async () => {
    const { capturar } = escenario(null);

    await expect(
      capturar.execute(new CapturarSueldoBaseCommand(ID_TRABAJADOR, '0.00')),
    ).rejects.toThrow(SueldoBaseInvalidoError);
  });
});

describe('ActualizarSueldoBaseHandler (CU-B02): el recálculo por construcción', () => {
  it('los montos del registro cambian sin tocar ningún periodo (RN-13, RN-20)', async () => {
    const { actualizar, solicitarBimestres, solicitarDiciembre, consultar, repoSolicitudes } =
      escenario('12345.67');

    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [
        { mesReferencia: 2, montoEnPesos: null },
        { mesReferencia: 4, montoEnPesos: null },
      ]),
    );
    await solicitarDiciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR));
    const escriturasAntes = repoSolicitudes.guardados;

    const antes = await consultar.execute(new ObtenerMiSolicitudQuery(ID_TRABAJADOR));
    expect(antes.periodos.map((p) => p.montoEnPesos)).toEqual(['1975.31', '1975.31', '3950.61']);
    expect(antes.totalEnPesos).toBe('7901.23');

    await actualizar.execute(new ActualizarSueldoBaseCommand(ID_TRABAJADOR, '20000.00'));

    const despues = await consultar.execute(new ObtenerMiSolicitudQuery(ID_TRABAJADOR));
    expect(despues.periodos.map((p) => p.montoEnPesos)).toEqual(['3200.00', '3200.00', '6400.00']);
    expect(despues.totalEnPesos).toBe('12800.00');

    // La clave del asunto: el registro de solicitud no se reescribió ni una vez.
    expect(repoSolicitudes.guardados).toBe(escriturasAntes);
    expect(despues.periodos.map((p) => p.clave)).toEqual(antes.periodos.map((p) => p.clave));
  });

  it('acepta bajar el sueldo y recalcula igual (RN-13, decisión D-07)', async () => {
    const { actualizar, solicitarBimestres, consultar } = escenario('20000.00');
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 2, montoEnPesos: null }]),
    );

    await actualizar.execute(new ActualizarSueldoBaseCommand(ID_TRABAJADOR, '10000.00'));

    const registro = await consultar.execute(new ObtenerMiSolicitudQuery(ID_TRABAJADOR));
    expect(registro.totalEnPesos).toBe('1600.00');
  });

  it('afecta también a bimestres ya transcurridos: no hay snapshots (decisión D-09)', async () => {
    const { actualizar, solicitarBimestres, repoSolicitudes } = escenario('12345.67');
    // Se solicita en enero (reloj del escenario) y se consulta en junio, con
    // febrero ya transcurrido.
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 2, montoEnPesos: null }]),
    );
    await actualizar.execute(new ActualizarSueldoBaseCommand(ID_TRABAJADOR, '20000.00'));

    // El mismo registro consultado en junio: sólo cambia el reloj del cargador.
    const enJunio = new CargadorDelRegistro(
      RelojFijo.enMexico(2026, 6, 1),
      new RepositorioSolicitantesEnMemoria(
        Solicitante.reconstituir(
          SolicitanteId.de(ID_TRABAJADOR),
          TipoUsuario.TRABAJADOR,
          SueldoBase.desdePesos('20000.00'),
        ),
      ),
      repoSolicitudes,
    );
    const consultaEnJunio = new ObtenerMiSolicitudHandler(enJunio);
    const registro = await consultaEnJunio.execute(new ObtenerMiSolicitudQuery(ID_TRABAJADOR));

    expect(registro.periodos[0]).toMatchObject({
      clave: '2026-02',
      montoEnPesos: '3200.00',
      estadoEntrega: 'entregado',
    });
  });

  it('no se puede actualizar lo que nunca se capturó (EC-17)', async () => {
    const { actualizar } = escenario(null);

    await expect(
      actualizar.execute(new ActualizarSueldoBaseCommand(ID_TRABAJADOR, '20000.00')),
    ).rejects.toThrow(SueldoBaseNoRegistradoError);
  });
});

describe('ObtenerMiSolicitudHandler (CU-D04)', () => {
  it('devuelve un registro vacío a quien no ha solicitado nada, sin fallar', async () => {
    const { consultar } = escenario(null);

    const registro = await consultar.execute(new ObtenerMiSolicitudQuery(ID_ALUMNO));

    expect(registro).toEqual({
      solicitanteId: ID_ALUMNO,
      anio: 2026,
      periodos: [],
      totalEnPesos: '0.00',
    });
  });

  it('responde también al trabajador que aún no capturó su sueldo base', async () => {
    const { consultar } = escenario(null);

    await expect(
      consultar.execute(new ObtenerMiSolicitudQuery(ID_TRABAJADOR)),
    ).resolves.toMatchObject({ periodos: [], totalEnPesos: '0.00' });
  });

  it('no escribe nada: es una Query', async () => {
    const { consultar, solicitarBimestres, repoSolicitudes } = escenario('12345.67');
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 2, montoEnPesos: null }]),
    );
    const escrituras = repoSolicitudes.guardados;

    await consultar.execute(new ObtenerMiSolicitudQuery(ID_TRABAJADOR));

    expect(repoSolicitudes.guardados).toBe(escrituras);
  });
});
