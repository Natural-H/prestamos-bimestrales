import { DomainError } from './domain.error';

/**
 * Las credenciales del inicio de sesión no son válidas (CU-A02).
 *
 * No distingue entre "el correo no existe" y "la contraseña no coincide": decir
 * cuál de las dos falló permitiría averiguar qué correos están dados de alta.
 *
 * Se mapea a `401 Unauthorized`.
 */
export class CredencialesInvalidasError extends DomainError {
  constructor() {
    super('CREDENCIALES_INVALIDAS', 'El correo o la contraseña no son correctos.');
  }
}
