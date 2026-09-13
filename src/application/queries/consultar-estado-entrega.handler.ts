import { EstadoEntrega } from '../../domain/value-objects/estado-entrega';
import { Monto } from '../../domain/value-objects/monto';
import { SolicitudPrestamoMapper } from '../mappers/solicitud-prestamo.mapper';
import { QueryHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import {
  EntregasReadModel,
  PeriodoSolicitadoReadModel,
} from '../read-models/solicitud-prestamo.read-model';
import { ConsultarEstadoEntregaQuery } from './consultar-estado-entrega.query';

/**
 * Caso de uso **Consultar el estado de entrega de mis periodos** (CU-E01).
 *
 * ## No hay proceso de desembolso
 *
 * El estado no se lee de ninguna columna ni lo escribe nadie: se **deriva de la
 * fecha** comparando el periodo de cada solicitud con el día de hoy (RN-07).
 * El desembolso quedó fuera del alcance del microservicio (RN-16, decisión
 * D-05), así que no existe ningún comando que "marque como entregado".
 *
 * Lo que aporta sobre CU-D04 son los **totales por situación**: cuánto se ha
 * recibido ya y cuánto queda por recibir. Ambos se calculan con los montos
 * **vigentes**, de modo que el total entregado de un trabajador cambia si
 * actualiza su sueldo: nada se congela al entregarse (decisión D-09).
 */
export class ConsultarEstadoEntregaHandler implements QueryHandler<
  ConsultarEstadoEntregaQuery,
  EntregasReadModel
> {
  constructor(private readonly registros: CargadorDelRegistro) {}

  async execute(query: ConsultarEstadoEntregaQuery): Promise<EntregasReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(query.solicitanteId);

    // Sin periodos no hay montos que derivar, y un trabajador sin sueldo base
    // capturado no tiene política (EC-06): su registro sólo puede estar vacío.
    const periodos: PeriodoSolicitadoReadModel[] = solicitud.estaVacia
      ? []
      : SolicitudPrestamoMapper.aPeriodosReadModel(solicitud, solicitante.politicaPrestamo(), hoy);

    return {
      anio: hoy.anio,
      fechaDeConsulta: hoy.toString(),
      periodos,
      totalEntregadoEnPesos: ConsultarEstadoEntregaHandler.sumar(
        periodos.filter((periodo) => periodo.estadoEntrega === EstadoEntrega.ENTREGADO),
      ),
      totalPorRecibirEnPesos: ConsultarEstadoEntregaHandler.sumar(
        periodos.filter((periodo) => periodo.estadoEntrega !== EstadoEntrega.ENTREGADO),
      ),
    };
  }

  /**
   * Suma montos volviendo a pasar por `Monto`.
   *
   * Sumar las cadenas con aritmética de coma flotante aquí tiraría por tierra
   * todo el trabajo del value object (RN-14): el total se calcula en centavos
   * enteros y sólo al final se vuelve a formatear.
   */
  private static sumar(periodos: readonly PeriodoSolicitadoReadModel[]): string {
    return periodos
      .reduce((total, periodo) => total.sumar(Monto.desdePesos(periodo.montoEnPesos)), Monto.CERO)
      .aCadena();
  }
}
