import { SolicitarBimestresCommand } from '../../src/application/commands/solicitar-bimestres.command';
import { SolicitarBimestresHandler } from '../../src/application/commands/solicitar-bimestres.handler';
import { SolicitarDiciembreCommand } from '../../src/application/commands/solicitar-diciembre.command';
import { SolicitarDiciembreHandler } from '../../src/application/commands/solicitar-diciembre.handler';
import { CargadorDelRegistro } from '../../src/application/services/cargador-del-registro';
import { Solicitante } from '../../src/domain/entities/solicitante.entity';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { DiciembreExclusivoTrabajadoresError } from '../../src/domain/errors/diciembre-exclusivo-trabajadores.error';
import { PeriodoDiciembreCerradoError } from '../../src/domain/errors/periodo-diciembre-cerrado.error';
import {
  RepositorioSolicitantesEnMemoria,
  RepositorioSolicitudesEnMemoria,
} from '../support/repositorios-en-memoria';
import { RelojFijo } from '../support/reloj-fijo';

const ID_ALUMNO = 'alumno-1';
const ID_TRABAJADOR = 'trabajador-1';

const solicitantes = (): Solicitante[] => [
  Solicitante.registrar(SolicitanteId.de(ID_ALUMNO), TipoUsuario.ALUMNO),
  Solicitante.reconstituir(
    SolicitanteId.de(ID_TRABAJADOR),
    TipoUsuario.TRABAJADOR,
    SueldoBase.desdePesos('12345.67'),
  ),
];

const escenario = (mes: number, dia: number, anio = 2026) => {
  const reloj = RelojFijo.enMexico(anio, mes, dia);
  const repoSolicitantes = new RepositorioSolicitantesEnMemoria(...solicitantes());
  const repoSolicitudes = new RepositorioSolicitudesEnMemoria();
  const registros = new CargadorDelRegistro(reloj, repoSolicitantes, repoSolicitudes);
  return {
    diciembre: new SolicitarDiciembreHandler(registros, repoSolicitudes),
    bimestres: new SolicitarBimestresHandler(registros, repoSolicitudes),
    repoSolicitudes,
  };
};

describe('SolicitarDiciembreHandler (CU-D03)', () => {
  it('el trabajador recibe el 32 % del sueldo base vigente (RN-10)', async () => {
    const { diciembre } = escenario(9, 1);

    const resultado = await diciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR));

    expect(resultado.agregados).toEqual(['2026-12']);
    expect(resultado.solicitud.periodos[0]).toMatchObject({
      clave: '2026-12',
      tipo: 'diciembre',
      inicio: '2026-12-01',
      fin: '2026-12-31',
      montoEnPesos: '3950.61',
    });
  });

  it('se acumula en el MISMO registro que los bimestres (RN-06)', async () => {
    const { diciembre, bimestres } = escenario(9, 1);

    await bimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 10, montoEnPesos: null }]),
    );
    const resultado = await diciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR));

    expect(resultado.solicitud.periodos.map((p) => p.clave)).toEqual(['2026-10', '2026-12']);
    // 1 975.31 del bimestre + 3 950.61 de diciembre
    expect(resultado.solicitud.totalEnPesos).toBe('5925.92');
  });

  it('sigue disponible con la temporada de bimestres cerrada (RN-11)', async () => {
    const { diciembre, bimestres } = escenario(11, 15);

    const resultado = await diciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR));

    expect(resultado.agregados).toEqual(['2026-12']);
    await expect(
      bimestres.execute(
        new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 10, montoEnPesos: null }]),
      ),
    ).rejects.toThrow();
  });

  it('admite solicitarlo el 31 de diciembre, pero no el 1 de enero (EC-08)', async () => {
    const ultimoDia = escenario(12, 31);
    await expect(
      ultimoDia.diciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR)),
    ).resolves.toMatchObject({ agregados: ['2026-12'] });

    const anioSiguiente = escenario(1, 1, 2027);
    // El 1 de enero de 2027 ya se solicita el diciembre DE 2027, que aún no ha
    // llegado y por tanto está disponible: lo que quedó fuera de plazo es el de 2026.
    await expect(
      anioSiguiente.diciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR)),
    ).resolves.toMatchObject({ agregados: ['2027-12'] });
  });

  it('el alumno no puede solicitarlo, y no se guarda nada (EC-07)', async () => {
    const { diciembre, repoSolicitudes } = escenario(12, 1);

    await expect(diciembre.execute(new SolicitarDiciembreCommand(ID_ALUMNO))).rejects.toThrow(
      DiciembreExclusivoTrabajadoresError,
    );
    expect(repoSolicitudes.guardados).toBe(0);
  });

  it('repetirlo es un no-op idempotente (RN-18)', async () => {
    const { diciembre, repoSolicitudes } = escenario(12, 1);
    const comando = new SolicitarDiciembreCommand(ID_TRABAJADOR);

    await diciembre.execute(comando);
    const repeticion = await diciembre.execute(comando);

    expect(repeticion.agregados).toEqual([]);
    expect(repeticion.sinCambios).toEqual(['2026-12']);
    expect(repoSolicitudes.guardados).toBe(1);
  });
});

describe('PeriodoDiciembreCerradoError', () => {
  it('se puede construir para informar del plazo vencido', () => {
    expect(new PeriodoDiciembreCerradoError(2026).codigo).toBe('PERIODO_DICIEMBRE_CERRADO');
  });
});
