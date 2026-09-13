import { SolicitudPrestamoMapper } from '../mappers/solicitud-prestamo.mapper';
import { QueryHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { PeriodoSolicitadoReadModel } from '../read-models/solicitud-prestamo.read-model';
import { ListarPeriodosSolicitadosQuery } from './listar-periodos-solicitados.query';

/**
 * Caso de uso **Consultar el desglose por periodo** (CU-D05).
 *
 * Cada periodo trae dos fechas que conviene no confundir y que este endpoint
 * pone una al lado de la otra a propósito (RN-07):
 *
 * - `fechaSolicitud`: cuándo lo pidió el usuario, que puede ser con meses de
 *   antelación (RN-03);
 * - `inicio` y `fin`: cuándo le corresponde **recibirlo**, que no se adelanta
 *   por haberlo pedido antes.
 *
 * Devuelve la lista sin envoltorio ni total; el registro completo con su total
 * acumulado es CU-D04.
 */
export class ListarPeriodosSolicitadosHandler implements QueryHandler<
  ListarPeriodosSolicitadosQuery,
  PeriodoSolicitadoReadModel[]
> {
  constructor(private readonly registros: CargadorDelRegistro) {}

  async execute(query: ListarPeriodosSolicitadosQuery): Promise<PeriodoSolicitadoReadModel[]> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(query.solicitanteId);

    if (solicitud.estaVacia) {
      return [];
    }

    return SolicitudPrestamoMapper.aPeriodosReadModel(
      solicitud,
      solicitante.politicaPrestamo(),
      hoy,
    );
  }
}
