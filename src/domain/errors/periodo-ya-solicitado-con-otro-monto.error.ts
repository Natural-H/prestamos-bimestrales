import { DomainError } from './domain.error';

/**
 * El alumno volvió a solicitar un periodo que ya tenía registrado, pero con un
 * monto distinto (RN-18).
 *
 * "Solicitar" **agrega, nunca reemplaza** (RN-06): repetir un periodo con los
 * mismos datos es un no-op idempotente, pero cambiar el monto por esta vía sería
 * una modificación encubierta. Se rechaza **sin tocar nada**, y como la
 * operación es atómica, tampoco se persiste el resto de periodos del mismo
 * request.
 *
 * Se mapea a `409 Conflict` (EC-11).
 */
export class PeriodoYaSolicitadoConOtroMontoError extends DomainError {
  constructor(clave: string, montoRegistrado: string, montoSolicitado: string) {
    super(
      'PERIODO_YA_SOLICITADO_CON_OTRO_MONTO',
      `El periodo ${clave} ya está solicitado por MXN ${montoRegistrado}; no puede volver a solicitarse por MXN ${montoSolicitado}.`,
    );
  }
}
