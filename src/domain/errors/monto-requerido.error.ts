import { DomainError } from './domain.error';

/**
 * El alumno solicitó un bimestre sin indicar cuánto quiere (RN-09).
 *
 * El alumno **elige** el monto dentro de un rango con tope; no hay un valor por
 * defecto que el sistema pueda suponer sin inventarse una regla de negocio. Es
 * el reverso exacto de `MontoNoCapturableError`, que se lanza cuando un
 * trabajador —cuyo monto **calcula** el sistema— sí manda uno.
 *
 * Se mapea a `400 Bad Request` (EC-18): falta un dato obligatorio de la petición.
 */
export class MontoRequeridoError extends DomainError {
  constructor() {
    super('MONTO_REQUERIDO', 'El alumno debe indicar el monto de cada bimestre que solicita.');
  }
}
