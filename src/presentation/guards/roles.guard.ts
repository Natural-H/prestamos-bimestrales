import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';
import { UsuarioAutenticado } from '../decorators/current-user.decorator';
import { ROLES_METADATA } from '../decorators/roles.decorator';

/**
 * Comprueba que el tipo de usuario del token esté entre los permitidos por
 * `@Roles()` (RN-17).
 *
 * Se ejecuta después de `JwtAuthGuard`, así que puede contar con que hay usuario
 * en la petición. Si la ruta no declara roles, no restringe nada.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<TipoUsuario[] | undefined>(
      ROLES_METADATA,
      [contexto.getHandler(), contexto.getClass()],
    );

    if (rolesPermitidos === undefined || rolesPermitidos.length === 0) {
      return true;
    }

    const { user } = contexto.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>();
    if (user === undefined || !rolesPermitidos.includes(user.tipoUsuario)) {
      throw new ForbiddenException(
        `Esta operación es exclusiva de: ${rolesPermitidos.join(', ')}.`,
      );
    }

    return true;
  }
}
