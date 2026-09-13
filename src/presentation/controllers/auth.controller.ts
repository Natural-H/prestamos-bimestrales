import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IniciarSesionCommand } from '../../application/commands/iniciar-sesion.command';
import { IniciarSesionHandler } from '../../application/commands/iniciar-sesion.handler';
import { RegistrarUsuarioCommand } from '../../application/commands/registrar-usuario.command';
import { RegistrarUsuarioHandler } from '../../application/commands/registrar-usuario.handler';
import { TokenDeAcceso } from '../../application/ports/token-issuer.port';
import {
  ObtenerPerfilHandler,
  PerfilReadModel,
} from '../../application/queries/obtener-perfil.handler';
import { ObtenerPerfilQuery } from '../../application/queries/obtener-perfil.query';
import { CurrentUser, UsuarioAutenticado } from '../decorators/current-user.decorator';
import { IniciarSesionDto, RegistrarUsuarioDto } from '../dtos/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * Alta, inicio de sesión y perfil (CU-A01, CU-A02, CU-A03).
 *
 * Las dos primeras rutas son **públicas por necesidad** —quien se registra o
 * inicia sesión todavía no tiene token—, y por eso este controller no lleva
 * `JwtAuthGuard` a nivel de clase: el guard se aplica sólo donde hace falta. Una
 * ruta pública debe verse de un vistazo, no deducirse de una excepción a una
 * regla global.
 */
@Controller()
export class AuthController {
  constructor(
    private readonly registrarUsuario: RegistrarUsuarioHandler,
    private readonly iniciarSesion: IniciarSesionHandler,
    private readonly obtenerPerfil: ObtenerPerfilHandler,
  ) {}

  /**
   * Alta de un usuario (CU-A01). El rol se fija aquí y es inmutable (RN-01).
   *
   * No devuelve token: registrarse e iniciar sesión son operaciones distintas, y
   * mezclarlas obligaría a este endpoint a emitir credenciales de acceso.
   */
  @Post('auth/registro')
  @HttpCode(HttpStatus.CREATED)
  async registrar(@Body() dto: RegistrarUsuarioDto): Promise<PerfilReadModel> {
    return this.registrarUsuario.execute(
      new RegistrarUsuarioCommand(dto.correo, dto.contrasena, dto.tipoUsuario),
    );
  }

  /** Inicio de sesión (CU-A02): devuelve el JWT con identificador y rol (RN-17). */
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: IniciarSesionDto): Promise<TokenDeAcceso> {
    return this.iniciarSesion.execute(new IniciarSesionCommand(dto.correo, dto.contrasena));
  }

  /** Perfil del usuario autenticado (CU-A03). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async perfil(@CurrentUser() usuario: UsuarioAutenticado): Promise<PerfilReadModel> {
    return this.obtenerPerfil.execute(new ObtenerPerfilQuery(usuario.id));
  }
}
