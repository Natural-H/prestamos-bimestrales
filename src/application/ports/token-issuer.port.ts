import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';

/** Token de acceso emitido tras un inicio de sesión correcto. */
export interface TokenDeAcceso {
  readonly token: string;
  /** Segundos de validez, para que el cliente sepa cuándo renovar. */
  readonly expiraEnSegundos: number;
}

/**
 * **Puerto** de emisión de tokens de acceso.
 *
 * La aplicación pide "un token para este usuario con este rol"; que sea un JWT
 * firmado con tal algoritmo y tal secreto es cosa del adaptador (CLAUDE.md §9).
 * Por eso la firma habla de `SolicitanteId` y `TipoUsuario`, conceptos del
 * dominio, y no de claims ni de `sub`.
 */
export interface TokenIssuerPort {
  emitir(solicitanteId: SolicitanteId, tipoUsuario: TipoUsuario): Promise<TokenDeAcceso>;
}

export const TOKEN_ISSUER_PORT = Symbol('TokenIssuerPort');
