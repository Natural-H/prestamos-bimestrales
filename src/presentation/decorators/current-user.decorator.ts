import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';

/**
 * Usuario autenticado, tal como lo deja la estrategia JWT en la petición.
 *
 * Es lo único que la capa HTTP conserva del token: un identificador y un tipo de
 * usuario **de dominio**. El resto de claims no sale de infraestructura, porque
 * el dominio no sabe qué es un JWT (CLAUDE.md §9).
 */
export interface UsuarioAutenticado {
  readonly id: string;
  readonly tipoUsuario: TipoUsuario;
}

/**
 * Inyecta el usuario autenticado en un parámetro del controller.
 *
 * Evita que cada handler HTTP hurgue en `request.user` y, sobre todo, evita que
 * el identificador del solicitante llegue por el cuerpo de la petición: quien
 * solicita es siempre quien va firmado en el token, nunca quien diga el JSON.
 */
export const CurrentUser = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const peticion = contexto.switchToHttp().getRequest<{ user: UsuarioAutenticado }>();
    return peticion.user;
  },
);
