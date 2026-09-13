import { Bimestre } from '../../domain/value-objects/bimestre';
import { CalendarioMapper } from '../mappers/calendario.mapper';
import { QueryHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { CalendarioDeBimestresReadModel } from '../read-models/calendario.read-model';
import { ListarBimestresQuery } from './listar-bimestres.query';

/**
 * Caso de uso **Consultar los bimestres del año con su estado** (CU-C01), que
 * incluye el escenario de **cierre de temporada** (CU-C04).
 *
 * Es el equivalente HTTP de "el usuario ingresa y consulta los bimestres
 * disponibles" del planteamiento §1. Devuelve **los cinco siempre** (RN-02),
 * cada uno marcado como disponible o bloqueado (RN-04), más la bandera de
 * temporada cerrada (RN-05): ocultar los bloqueados dejaría al cliente sin saber
 * por qué faltan, y el bloqueo ya está protegido de verdad en la escritura.
 *
 * El `montoEnPesos` de cada bimestre sale de la política sin ningún `if` sobre
 * el tipo de usuario: es el monto ya solicitado si lo está, el que le
 * correspondería al trabajador si no (`montoPrevistoParaBimestre`), o `null`
 * para el alumno, que es quien lo elige (RN-09).
 */
export class ListarBimestresHandler implements QueryHandler<
  ListarBimestresQuery,
  CalendarioDeBimestresReadModel
> {
  constructor(private readonly registros: CargadorDelRegistro) {}

  async execute(query: ListarBimestresQuery): Promise<CalendarioDeBimestresReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(query.solicitanteId);

    /*
     * Un trabajador sin sueldo base capturado no tiene política (EC-06), pero sí
     * tiene derecho a consultar el calendario: verá los bimestres disponibles y
     * el monto en `null`, que es información suficiente para saber que le falta
     * capturar su sueldo antes de solicitar.
     */
    const politica = solicitante.politicaPrestamoSiEstaDefinida();

    const bimestres = Bimestre.todosDelAnio(hoy.anio).map((bimestre) =>
      CalendarioMapper.aBimestreReadModel(bimestre, solicitud, politica, hoy),
    );

    return {
      anio: hoy.anio,
      fechaDeConsulta: hoy.toString(),
      temporadaCerrada: Bimestre.temporadaCerrada(hoy.anio, hoy),
      bimestres,
    };
  }
}
