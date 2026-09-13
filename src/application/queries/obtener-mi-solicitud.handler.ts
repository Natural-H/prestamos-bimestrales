import { SolicitudPrestamoMapper } from '../mappers/solicitud-prestamo.mapper';
import { QueryHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { SolicitudPrestamoReadModel } from '../read-models/solicitud-prestamo.read-model';
import { ObtenerMiSolicitudQuery } from './obtener-mi-solicitud.query';

/**
 * Caso de uso **Consultar mi solicitud** (CU-D04).
 *
 * Devuelve el registro del año en curso con el monto **vigente** de cada periodo
 * y el total acumulado. Si el usuario aún no ha solicitado nada, responde con un
 * registro vacío en vez de un error: "todavía no tengo nada" es una respuesta
 * legítima, no un fallo (RN-06).
 *
 * El total de un trabajador puede **variar entre dos consultas** si entretanto
 * actualizó su sueldo, incluso para bimestres ya transcurridos. No es un
 * defecto: es la consecuencia aceptada de que el monto flote con el sueldo
 * vigente y de que no exista historial (RN-13, RN-20).
 */
export class ObtenerMiSolicitudHandler implements QueryHandler<
  ObtenerMiSolicitudQuery,
  SolicitudPrestamoReadModel
> {
  constructor(private readonly registros: CargadorDelRegistro) {}

  async execute(query: ObtenerMiSolicitudQuery): Promise<SolicitudPrestamoReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(query.solicitanteId);

    if (solicitud.estaVacia) {
      return SolicitudPrestamoMapper.vacio(solicitante.id.valor, hoy.anio);
    }

    return SolicitudPrestamoMapper.aReadModel(solicitud, solicitante.politicaPrestamo(), hoy);
  }
}
