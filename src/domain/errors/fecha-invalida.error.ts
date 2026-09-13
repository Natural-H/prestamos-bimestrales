import { DomainError } from './domain.error';

/**
 * La fecha civil recibida no existe en el calendario (p. ej. 30 de febrero) o
 * sus componentes están fuera de rango.
 *
 * Es un error de integridad del value object `FechaCivil`, no una regla de
 * préstamo: el bloqueo de un bimestre por fecha (RN-04) tiene su propio error.
 */
export class FechaInvalidaError extends DomainError {
  constructor(motivo: string) {
    super('FECHA_INVALIDA', `Fecha inválida: ${motivo}.`);
  }
}
