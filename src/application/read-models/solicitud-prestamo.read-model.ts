import { EstadoEntrega } from '../../domain/value-objects/estado-entrega';
import { TipoPeriodo } from '../../domain/value-objects/periodo-solicitable';

/**
 * Modelos de lectura de la solicitud.
 *
 * Son el resultado que devuelven los casos de uso, y el material del que la capa
 * de presentación construirá su DTO de respuesta. Están hechos de **primitivos**
 * a propósito: los value objects del dominio no salen de él, y el monto viaja
 * como cadena decimal exacta (`'1975.31'`) para no reintroducir por el camino el
 * error de coma flotante que `Monto` existe para evitar (RN-14).
 */

/** Un periodo del registro, con su monto **vigente** y su estado de entrega. */
export interface PeriodoSolicitadoReadModel {
  /** Clave del periodo (`'2026-02'`, `'2026-12'`). */
  readonly clave: string;
  readonly tipo: TipoPeriodo;
  /** Mes de referencia del periodo, en base 1. */
  readonly mesReferencia: number;
  /** Rango del periodo en formato `YYYY-MM-DD`. */
  readonly inicio: string;
  readonly fin: string;
  /**
   * Monto vigente en pesos, como cadena decimal exacta.
   *
   * Para el trabajador **se deriva del sueldo vigente en esta misma consulta**
   * (RN-20): puede cambiar entre dos lecturas si entretanto actualizó su sueldo.
   */
  readonly montoEnPesos: string;
  /** Día en que se solicitó (`YYYY-MM-DD`). */
  readonly fechaSolicitud: string;
  /** Estado derivado de la fecha, no almacenado (RN-07). */
  readonly estadoEntrega: EstadoEntrega;
}

/** El registro completo del usuario para un año (CU-D04). */
export interface SolicitudPrestamoReadModel {
  readonly solicitanteId: string;
  readonly anio: number;
  readonly periodos: readonly PeriodoSolicitadoReadModel[];
  /** Suma de los montos vigentes, como cadena decimal exacta. */
  readonly totalEnPesos: string;
}

/**
 * Resultado de "Solicitar" (CU-D01, CU-D02, CU-D03).
 *
 * Distingue lo que se agregó de lo que ya estaba igual, para que presentación
 * pueda responder con precisión a una repetición idempotente (RN-18, EC-10) sin
 * mentir diciendo que creó algo.
 */
export interface ResultadoSolicitarReadModel {
  readonly agregados: readonly string[];
  readonly sinCambios: readonly string[];
  /** Estado del registro después de la operación. */
  readonly solicitud: SolicitudPrestamoReadModel;
}

/**
 * Vista de entregas del registro (CU-E01).
 *
 * Añade a la lista de periodos los **totales por situación**, que es lo que
 * ninguna otra consulta responde: cuánto se ha recibido ya y cuánto queda por
 * recibir. Los montos siguen siendo los **vigentes**, así que el total
 * entregado de un trabajador cambia si actualiza su sueldo: nada se congela al
 * entregarse (RN-13, RN-20, decisión D-09).
 */
export interface EntregasReadModel {
  readonly anio: number;
  /** Fecha civil con la que se derivó cada estado, en la zona del TECNM. */
  readonly fechaDeConsulta: string;
  readonly periodos: readonly PeriodoSolicitadoReadModel[];
  /** Suma de los periodos cuyo periodo ya transcurrió (`ENTREGADO`). */
  readonly totalEntregadoEnPesos: string;
  /** Suma de los que aún no han transcurrido (`PENDIENTE` o `EN_CURSO`). */
  readonly totalPorRecibirEnPesos: string;
}
