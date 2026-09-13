import { DomainError } from './domain.error';

/**
 * No existe el solicitante al que se refiere la operación.
 *
 * En la práctica no debería ocurrir con un JWT válido, pero el caso de uso no
 * puede darlo por supuesto: el puerto de repositorio devuelve `null` y quien
 * decide qué significa eso es el dominio, no el adaptador.
 *
 * Se mapea a `404 Not Found`.
 */
export class SolicitanteNoEncontradoError extends DomainError {
  constructor(id: string) {
    super('SOLICITANTE_NO_ENCONTRADO', `No existe el solicitante ${id}.`);
  }
}
