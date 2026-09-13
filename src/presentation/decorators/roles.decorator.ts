import { SetMetadata } from '@nestjs/common';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';

export const ROLES_METADATA = 'roles';

/**
 * Restringe una ruta a ciertos tipos de usuario (RN-01, RN-17).
 *
 * Trabaja con el `TipoUsuario` del dominio, no con cadenas sueltas, para que un
 * rol mal escrito sea un error de compilación y no un `403` silencioso.
 *
 * El guard es **la primera** defensa, no la única: reglas como "diciembre es
 * exclusivo de trabajadores" (RN-12) se vuelven a comprobar en el dominio, que
 * es donde viven.
 */
export const Roles = (...roles: TipoUsuario[]) => SetMetadata(ROLES_METADATA, roles);
