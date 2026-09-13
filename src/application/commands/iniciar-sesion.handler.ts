import { CredencialesInvalidasError } from '../../domain/errors/credenciales-invalidas.error';
import { SolicitanteNoEncontradoError } from '../../domain/errors/solicitante-no-encontrado.error';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { CredencialesPort } from '../ports/credenciales.port';
import { CommandHandler } from '../ports/handler';
import { TokenDeAcceso, TokenIssuerPort } from '../ports/token-issuer.port';
import { IniciarSesionCommand } from './iniciar-sesion.command';

/**
 * Caso de uso **Iniciar sesión** (CU-A02).
 *
 * Verifica las credenciales contra su puerto y pide un token para el usuario y
 * su **rol de dominio**. El handler no sabe qué es un JWT, ni cómo se firma, ni
 * cuánto dura: eso lo decide el adaptador (CLAUDE.md §9).
 *
 * Es un *Command* aunque no modifique el registro de préstamos: emite un token,
 * que es un efecto.
 */
export class IniciarSesionHandler implements CommandHandler<IniciarSesionCommand, TokenDeAcceso> {
  constructor(
    private readonly credenciales: CredencialesPort,
    private readonly solicitantes: SolicitanteRepository,
    private readonly tokens: TokenIssuerPort,
  ) {}

  async execute(command: IniciarSesionCommand): Promise<TokenDeAcceso> {
    const correo = command.correo.trim().toLowerCase();

    const solicitanteId = await this.credenciales.verificar(correo, command.contrasena);
    if (solicitanteId === null) {
      throw new CredencialesInvalidasError();
    }

    const solicitante = await this.solicitantes.buscarPorId(solicitanteId);
    if (solicitante === null) {
      // Credenciales válidas sin solicitante detrás: datos inconsistentes, no un
      // fallo de autenticación. Se distingue para no enmascarar el problema.
      throw new SolicitanteNoEncontradoError(solicitanteId.valor);
    }

    return this.tokens.emitir(solicitante.id, solicitante.tipoUsuario);
  }
}
