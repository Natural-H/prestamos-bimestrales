import { SolicitudPrestamo } from '../../domain/entities/solicitud-prestamo.entity';
import { Monto } from '../../domain/value-objects/monto';
import { PoliticaPrestamo } from '../../domain/services/politica-prestamo';
import { FechaCivil } from '../../domain/value-objects/fecha-civil';
import {
  PeriodoSolicitadoReadModel,
  SolicitudPrestamoReadModel,
} from '../read-models/solicitud-prestamo.read-model';

/**
 * Traduce el agregado a su modelo de lectura (CLAUDE.md §7.8).
 *
 * Necesita la **política** y la **fecha** porque el modelo de lectura no es una
 * copia del estado guardado: dos de sus campos se calculan al leer —el monto
 * vigente del trabajador (RN-20) y el estado de entrega (RN-07)—. Eso no es un
 * capricho del mapper, es la consecuencia directa de haber decidido no
 * almacenar ninguno de los dos.
 */
export class SolicitudPrestamoMapper {
  /**
   * Los periodos del registro, en orden cronológico (CU-D05).
   *
   * Es la pieza que comparten la consulta del registro (CU-D04), el desglose
   * (CU-D05) y la vista de entregas (CU-E01): las tres describen el mismo
   * periodo de la misma forma, y tenerlo en un solo sitio evita que sus
   * respuestas se vayan separando con el tiempo.
   */
  static aPeriodosReadModel(
    solicitud: SolicitudPrestamo,
    politica: PoliticaPrestamo,
    hoy: FechaCivil,
  ): PeriodoSolicitadoReadModel[] {
    return solicitud.periodosSolicitados.map((periodoSolicitado) => {
      const { periodo } = periodoSolicitado;
      return {
        clave: periodoSolicitado.clave,
        tipo: periodo.tipo,
        mesReferencia: periodo.periodo.fin.mes,
        inicio: periodo.periodo.inicio.toString(),
        fin: periodo.periodo.fin.toString(),
        montoEnPesos: periodoSolicitado.montoVigente(politica).aCadena(),
        fechaSolicitud: periodoSolicitado.fechaSolicitud.toString(),
        estadoEntrega: periodoSolicitado.estadoDeEntrega(hoy),
      };
    });
  }

  static aReadModel(
    solicitud: SolicitudPrestamo,
    politica: PoliticaPrestamo,
    hoy: FechaCivil,
  ): SolicitudPrestamoReadModel {
    const periodos = SolicitudPrestamoMapper.aPeriodosReadModel(solicitud, politica, hoy);

    return {
      solicitanteId: solicitud.solicitanteId.valor,
      anio: solicitud.anio,
      periodos,
      totalEnPesos: solicitud.montoTotalVigente(politica).aCadena(),
    };
  }

  /**
   * Registro vacío: lo que ve quien todavía no ha solicitado nada este año.
   *
   * Existe para que la consulta no tenga que pedir la política cuando no hay
   * ningún monto que derivar. No es un rodeo: un trabajador que aún no capturó
   * su sueldo base **no tiene política** (EC-06) y, precisamente por eso,
   * tampoco puede tener ningún periodo solicitado. Su registro sólo puede estar
   * vacío, y consultarlo debe responder, no fallar.
   */
  static vacio(solicitanteId: string, anio: number): SolicitudPrestamoReadModel {
    return { solicitanteId, anio, periodos: [], totalEnPesos: Monto.CERO.aCadena() };
  }
}
