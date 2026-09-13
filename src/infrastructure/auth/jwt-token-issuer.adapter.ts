import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenDeAcceso, TokenIssuerPort } from '../../application/ports/token-issuer.port';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';

/**
 * Adaptador del puerto {@link TokenIssuerPort}: emite el JWT (RN-17).
 *
 * El token lleva el identificador del solicitante (`sub`) y su rol, que es lo
 * que necesitan el guard de autenticación y el de autorización. El secreto y la
 * expiración salen de la configuración, nunca del código (CLAUDE.md §9).
 */
@Injectable()
export class JwtTokenIssuerAdapter implements TokenIssuerPort {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async emitir(solicitanteId: SolicitanteId, tipoUsuario: TipoUsuario): Promise<TokenDeAcceso> {
    const expiraEnSegundos = this.config.getOrThrow<number>('JWT_EXPIRES_IN');
    const token = await this.jwt.signAsync(
      { sub: solicitanteId.valor, rol: tipoUsuario },
      { expiresIn: expiraEnSegundos },
    );

    return { token, expiraEnSegundos };
  }
}
