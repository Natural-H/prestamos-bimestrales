import { SolicitanteId } from '../../domain/value-objects/solicitante-id';

/**
 * **Puerto** de credenciales de acceso.
 *
 * Encapsula por completo el almacenamiento y la verificación de contraseñas: el
 * hashing no aparece en ninguna firma, porque es un detalle del adaptador
 * (CLAUDE.md §9). La aplicación sólo sabe registrar unas credenciales y
 * preguntar si unas dadas son correctas.
 */
export interface CredencialesPort {
  /** `true` si ese correo ya está dado de alta (CU-A01). */
  existeCorreo(correo: string): Promise<boolean>;

  /** Guarda las credenciales del solicitante; el adaptador decide cómo derivar y guardar el hash. */
  registrar(solicitanteId: SolicitanteId, correo: string, contrasena: string): Promise<void>;

  /**
   * Verifica unas credenciales.
   *
   * @returns El identificador del solicitante, o `null` si no son correctas. No
   *   distingue el motivo a propósito (ver `CredencialesInvalidasError`).
   */
  verificar(correo: string, contrasena: string): Promise<SolicitanteId | null>;
}

export const CREDENCIALES_PORT = Symbol('CredencialesPort');
