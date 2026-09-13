import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exige un JWT válido (RN-17, CLAUDE.md §9).
 *
 * Delega en la estrategia `jwt` de Passport, que vive en
 * `infrastructure/auth`: aquí sólo se declara que la ruta necesita
 * autenticación, no cómo se verifica el token.
 *
 * Se aplica **explícitamente en cada controller protegido** en lugar de
 * globalmente, para que las rutas públicas —alta y login— no dependan de una
 * excepción a una regla global, que es la clase de descuido con el que se
 * publica un endpoint sin querer.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
