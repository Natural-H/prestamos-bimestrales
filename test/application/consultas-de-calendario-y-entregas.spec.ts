import { SolicitarBimestresCommand } from '../../src/application/commands/solicitar-bimestres.command';
import { SolicitarBimestresHandler } from '../../src/application/commands/solicitar-bimestres.handler';
import { SolicitarDiciembreCommand } from '../../src/application/commands/solicitar-diciembre.command';
import { SolicitarDiciembreHandler } from '../../src/application/commands/solicitar-diciembre.handler';
import { ConsultarEstadoEntregaHandler } from '../../src/application/queries/consultar-estado-entrega.handler';
import { ConsultarEstadoEntregaQuery } from '../../src/application/queries/consultar-estado-entrega.query';
import { ListarPeriodosSolicitadosHandler } from '../../src/application/queries/listar-periodos-solicitados.handler';
import { ListarPeriodosSolicitadosQuery } from '../../src/application/queries/listar-periodos-solicitados.query';
import { ObtenerBimestreHandler } from '../../src/application/queries/obtener-bimestre.handler';
import { ObtenerBimestreQuery } from '../../src/application/queries/obtener-bimestre.query';
import { CargadorDelRegistro } from '../../src/application/services/cargador-del-registro';
import { Solicitante } from '../../src/domain/entities/solicitante.entity';
import { EstadoEntrega } from '../../src/domain/value-objects/estado-entrega';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { BimestreInexistenteError } from '../../src/domain/errors/bimestre-inexistente.error';
import { SolicitanteNoEncontradoError } from '../../src/domain/errors/solicitante-no-encontrado.error';
import {
  RepositorioSolicitantesEnMemoria,
  RepositorioSolicitudesEnMemoria,
} from '../support/repositorios-en-memoria';
import { RelojFijo } from '../support/reloj-fijo';

const ID_ALUMNO = 'alumno-1';
const ID_TRABAJADOR = 'trabajador-1';
const ID_SIN_SUELDO = 'trabajador-sin-sueldo';

/** Monta los casos de uso con el reloj plantado en una fecha de México. */
const escenario = (mes: number, dia: number, anio = 2026) => {
  const reloj = RelojFijo.enMexico(anio, mes, dia);
  const solicitantes = new RepositorioSolicitantesEnMemoria(
    Solicitante.registrar(SolicitanteId.de(ID_ALUMNO), TipoUsuario.ALUMNO),
    Solicitante.reconstituir(
      SolicitanteId.de(ID_TRABAJADOR),
      TipoUsuario.TRABAJADOR,
      SueldoBase.desdePesos('12345.67'),
    ),
    Solicitante.registrar(SolicitanteId.de(ID_SIN_SUELDO), TipoUsuario.TRABAJADOR),
  );
  const solicitudes = new RepositorioSolicitudesEnMemoria();
  const registros = new CargadorDelRegistro(reloj, solicitantes, solicitudes);
  return {
    obtenerBimestre: new ObtenerBimestreHandler(registros),
    listarPeriodos: new ListarPeriodosSolicitadosHandler(registros),
    entregas: new ConsultarEstadoEntregaHandler(registros),
    solicitarBimestres: new SolicitarBimestresHandler(registros, solicitudes),
    solicitarDiciembre: new SolicitarDiciembreHandler(registros, solicitudes),
    solicitantes,
    solicitudes,
  };
};

describe('ObtenerBimestreHandler (CU-C02)', () => {
  it('informa del estado de un bimestre disponible y del monto que costaría', async () => {
    const { obtenerBimestre } = escenario(9, 12);

    const bimestre = await obtenerBimestre.execute(new ObtenerBimestreQuery(ID_TRABAJADOR, 10));

    expect(bimestre).toEqual({
      clave: '2026-10',
      mesReferencia: 10,
      inicio: '2026-09-01',
      fin: '2026-10-31',
      estado: 'DISPONIBLE',
      motivoBloqueo: null,
      yaSolicitado: false,
      montoEnPesos: '1975.31',
    });
  });

  it('explica el bloqueo de un bimestre transcurrido (RN-04)', async () => {
    const { obtenerBimestre } = escenario(9, 12);

    const bimestre = await obtenerBimestre.execute(new ObtenerBimestreQuery(ID_TRABAJADOR, 2));

    expect(bimestre.estado).toBe('BLOQUEADO');
    expect(bimestre.motivoBloqueo).toContain('2026-02-28');
  });

  it('no dice monto al alumno, porque lo elige él (RN-09)', async () => {
    const { obtenerBimestre } = escenario(9, 12);

    const bimestre = await obtenerBimestre.execute(new ObtenerBimestreQuery(ID_ALUMNO, 10));

    expect(bimestre.montoEnPesos).toBeNull();
  });

  it('responde al trabajador sin sueldo base, con el monto en null', async () => {
    const { obtenerBimestre } = escenario(9, 12);

    const bimestre = await obtenerBimestre.execute(new ObtenerBimestreQuery(ID_SIN_SUELDO, 10));

    expect(bimestre.estado).toBe('DISPONIBLE');
    expect(bimestre.montoEnPesos).toBeNull();
  });

  it('marca el bimestre que el usuario ya solicitó, con su monto vigente', async () => {
    const { obtenerBimestre, solicitarBimestres } = escenario(9, 12);
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 10, montoEnPesos: '500.00' }]),
    );

    const bimestre = await obtenerBimestre.execute(new ObtenerBimestreQuery(ID_ALUMNO, 10));

    expect(bimestre.yaSolicitado).toBe(true);
    expect(bimestre.montoEnPesos).toBe('500.00');
  });

  it('rechaza un mes que no es bimestre, igual que al solicitarlo (RN-02, RN-11)', async () => {
    const { obtenerBimestre } = escenario(9, 12);

    await expect(obtenerBimestre.execute(new ObtenerBimestreQuery(ID_ALUMNO, 3))).rejects.toThrow(
      BimestreInexistenteError,
    );
    await expect(obtenerBimestre.execute(new ObtenerBimestreQuery(ID_ALUMNO, 12))).rejects.toThrow(
      BimestreInexistenteError,
    );
  });

  it('falla si el solicitante no existe', async () => {
    const { obtenerBimestre } = escenario(9, 12);

    await expect(obtenerBimestre.execute(new ObtenerBimestreQuery('fantasma', 10))).rejects.toThrow(
      SolicitanteNoEncontradoError,
    );
  });
});

describe('ListarPeriodosSolicitadosHandler (CU-D05)', () => {
  it('devuelve lista vacía a quien no ha solicitado nada', async () => {
    const { listarPeriodos } = escenario(9, 12);

    await expect(
      listarPeriodos.execute(new ListarPeriodosSolicitadosQuery(ID_ALUMNO)),
    ).resolves.toEqual([]);
  });

  it('distingue la fecha de solicitud de la ventana de entrega (RN-07)', async () => {
    // Se solicita en enero un bimestre que se recibe en septiembre-octubre.
    const { listarPeriodos, solicitarBimestres } = escenario(1, 15);
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_ALUMNO, [{ mesReferencia: 10, montoEnPesos: '500.00' }]),
    );

    const periodos = await listarPeriodos.execute(new ListarPeriodosSolicitadosQuery(ID_ALUMNO));

    expect(periodos).toEqual([
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

  it('ordena bimestres y diciembre cronológicamente', async () => {
    const { listarPeriodos, solicitarBimestres, solicitarDiciembre } = escenario(9, 1);
    await solicitarDiciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR));
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [{ mesReferencia: 10, montoEnPesos: null }]),
    );

    const periodos = await listarPeriodos.execute(
      new ListarPeriodosSolicitadosQuery(ID_TRABAJADOR),
    );

    expect(periodos.map((p) => p.clave)).toEqual(['2026-10', '2026-12']);
  });
});

describe('ConsultarEstadoEntregaHandler (CU-E01)', () => {
  it('deriva el estado de cada periodo de la fecha, sin escribir nada (RN-07)', async () => {
    const { entregas, solicitarBimestres, solicitarDiciembre, solicitudes } = escenario(1, 15);
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_TRABAJADOR, [
        { mesReferencia: 2, montoEnPesos: null },
        { mesReferencia: 10, montoEnPesos: null },
      ]),
    );
    await solicitarDiciembre.execute(new SolicitarDiciembreCommand(ID_TRABAJADOR));
    const escrituras = solicitudes.guardados;

    const vista = await entregas.execute(new ConsultarEstadoEntregaQuery(ID_TRABAJADOR));

    // En enero: febrero (1 ene – 28 feb) está en curso, el resto aún no llega.
    expect(vista.periodos.map((p) => [p.clave, p.estadoEntrega])).toEqual([
      ['2026-02', EstadoEntrega.EN_CURSO],
      ['2026-10', EstadoEntrega.PENDIENTE],
      ['2026-12', EstadoEntrega.PENDIENTE],
    ]);
    expect(solicitudes.guardados).toBe(escrituras);
  });

  it('separa el total entregado del total por recibir segun avanza el ano', async () => {
    const { entregas, solicitarBimestres, solicitantes, solicitudes } = escenario(1, 15);
    await solicitarBimestres.execute(
      new SolicitarBimestresCommand(ID_ALUMNO, [
        { mesReferencia: 2, montoEnPesos: '1000.00' },
        { mesReferencia: 6, montoEnPesos: '500.00' },
        { mesReferencia: 10, montoEnPesos: '250.00' },
      ]),
    );

    const enEnero = await entregas.execute(new ConsultarEstadoEntregaQuery(ID_ALUMNO));
    expect(enEnero.fechaDeConsulta).toBe('2026-01-15');
    expect(enEnero.totalEntregadoEnPesos).toBe('0.00');
    expect(enEnero.totalPorRecibirEnPesos).toBe('1750.00');

    /*
     * El MISMO registro consultado en julio: sólo cambia el reloj, no los datos.
     * Febrero (1 ene – 28 feb) y junio (1 may – 30 jun) ya transcurrieron; el de
     * octubre todavía no. Es la demostración de que la entrega es estado
     * derivado y no una marca que alguien escriba (RN-07).
     */
    const entregasEnJulio = new ConsultarEstadoEntregaHandler(
      new CargadorDelRegistro(RelojFijo.enMexico(2026, 7, 1), solicitantes, solicitudes),
    );

    const enJulio = await entregasEnJulio.execute(new ConsultarEstadoEntregaQuery(ID_ALUMNO));

    expect(enJulio.periodos.map((p) => [p.clave, p.estadoEntrega])).toEqual([
      ['2026-02', EstadoEntrega.ENTREGADO],
      ['2026-06', EstadoEntrega.ENTREGADO],
      ['2026-10', EstadoEntrega.PENDIENTE],
    ]);
    expect(enJulio.totalEntregadoEnPesos).toBe('1500.00');
    expect(enJulio.totalPorRecibirEnPesos).toBe('250.00');
  });

  it('devuelve totales en cero a quien no ha solicitado nada', async () => {
    const { entregas } = escenario(9, 12);

    const vista = await entregas.execute(new ConsultarEstadoEntregaQuery(ID_SIN_SUELDO));

    expect(vista.periodos).toEqual([]);
    expect(vista.totalEntregadoEnPesos).toBe('0.00');
    expect(vista.totalPorRecibirEnPesos).toBe('0.00');
  });
});
