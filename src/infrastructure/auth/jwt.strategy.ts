import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TipoUsuarioInvalidoError } from '../../domain/errors/tipo-usuario-invalido.error';
import { tipoUsuarioDesde } from '../../domain/value-objects/tipo-usuario';
import { UsuarioAutenticado } from '../../presentation/decorators/current-user.decorator';

/** Contenido del JWT que emite este servicio (RN-17). */
interface PayloadJwt {
  /** Identificador del solicitante. */
  sub: string;
  /** Rol: `alumno` o `trabajador`. */
  rol: string;
}

/**
 * Estrategia de verificación del JWT (CLAUDE.md §9).
 *
 * Es la **única** clase que sabe cómo se lee un token: extrae el `Bearer`,
 * verifica la firma con el secreto de configuración y traduce el payload a un
 * {@link UsuarioAutenticado}, que ya habla en conceptos de dominio.
 *
 * Convierte el rol con `tipoUsuarioDesde`: un token firmado con un rol que no
 * existe se rechaza aquí y no llega a los guards ni al dominio.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Passport deja lo que devuelve este método en `request.user`. */
  validate(payload: PayloadJwt): UsuarioAutenticado {
    try {
      return { id: payload.sub, tipoUsuario: tipoUsuarioDesde(payload.rol) };
    } catch (error) {
      if (error instanceof TipoUsuarioInvalidoError) {
        throw new UnauthorizedException('El token no contiene un rol válido.');
      }
      throw error;
    }
  }
}
