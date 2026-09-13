import { DomainError } from './domain.error';

/**
 * El identificador de solicitante recibido está vacío o en blanco.
 *
 * El dominio **no genera** identificadores ni los espera de la base de datos
 * (CLAUDE.md §2.3): los recibe ya formados desde fuera, así que lo único que le
 * toca es no dejar entrar uno vacío.
 */
export class SolicitanteIdInvalidoError extends DomainError {
  constructor() {
    super('SOLICITANTE_ID_INVALIDO', 'El identificador del solicitante no puede estar vacío.');
  }
}
