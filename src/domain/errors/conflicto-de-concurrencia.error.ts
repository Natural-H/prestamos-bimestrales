import { DomainError } from './domain.error';

/**
 * Dos operaciones simultáneas sobre el mismo registro se pisaron (RN-15).
 *
 * El planteamiento exige que el registro se comporte de forma segura ante
 * solicitudes repetidas o **simultáneas**, sin duplicar ni sobrescribir. El
 * agregado garantiza la coherencia de una operación; garantizar que dos
 * operaciones concurrentes no se pisen es responsabilidad del adaptador de
 * persistencia (bloqueo optimista por versión), y éste es el error de dominio
 * con el que debe informarlo.
 *
 * Se mapea a `409 Conflict` (EC-13).
 */
export class ConflictoDeConcurrenciaError extends DomainError {
  constructor(descripcionDelRegistro: string) {
    super(
      'CONFLICTO_DE_CONCURRENCIA',
      `El registro ${descripcionDelRegistro} fue modificado por otra operación simultánea; vuelve a intentarlo.`,
    );
  }
}
