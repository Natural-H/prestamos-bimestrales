import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ActualizarSueldoBaseCommand } from '../../application/commands/actualizar-sueldo-base.command';
import { ActualizarSueldoBaseHandler } from '../../application/commands/actualizar-sueldo-base.handler';
import { CapturarSueldoBaseCommand } from '../../application/commands/capturar-sueldo-base.command';
import {
  CapturarSueldoBaseHandler,
  SueldoBaseReadModel,
} from '../../application/commands/capturar-sueldo-base.handler';
import { ObtenerSueldoBaseHandler } from '../../application/queries/obtener-sueldo-base.handler';
import { ObtenerSueldoBaseQuery } from '../../application/queries/obtener-sueldo-base.query';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';
import { CurrentUser, UsuarioAutenticado } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SueldoBaseDto } from '../dtos/sueldo-base.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * Sueldo base del trabajador (CU-B01, CU-B02, CU-B03).
 *
 * Todo el controller es exclusivo de trabajadores: el sueldo base sólo existe en
 * su modelo (RN-13). El dominio lo vuelve a comprobar con
 * `SueldoBaseSoloTrabajadoresError`, porque el guard protege la ruta pero la
 * regla es del negocio.
 */
@Controller('trabajadores/me/sueldo-base')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TipoUsuario.TRABAJADOR)
export class SueldoBaseController {
  constructor(
    private readonly capturarSueldoBase: CapturarSueldoBaseHandler,
    private readonly actualizarSueldoBase: ActualizarSueldoBaseHandler,
    private readonly obtenerSueldoBase: ObtenerSueldoBaseHandler,
  ) {}

  /**
   * Captura inicial (CU-B01). Responde `201`: es el alta de un dato que antes no
   * existía. Repetirla da `409` (`SUELDO_BASE_YA_REGISTRADO`), porque cambiarlo
   * es la otra operación.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async capturar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: SueldoBaseDto,
  ): Promise<SueldoBaseReadModel> {
    return this.capturarSueldoBase.execute(
      new CapturarSueldoBaseCommand(usuario.id, dto.sueldoBaseEnPesos),
    );
  }

  /**
   * Actualización con recálculo de montos (CU-B02, RN-13).
   *
   * `PUT` porque sustituye el sueldo vigente y el efecto es idempotente: mandar
   * dos veces el mismo sueldo deja el sistema igual. Tras esta llamada,
   * `GET /solicitudes/me` ya devuelve los montos nuevos **sin que se haya
   * reescrito ningún periodo** (RN-20).
   */
  @Put()
  async actualizar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: SueldoBaseDto,
  ): Promise<SueldoBaseReadModel> {
    return this.actualizarSueldoBase.execute(
      new ActualizarSueldoBaseCommand(usuario.id, dto.sueldoBaseEnPesos),
    );
  }

  /** Sueldo base vigente (CU-B03). */
  @Get()
  async consultar(@CurrentUser() usuario: UsuarioAutenticado): Promise<SueldoBaseReadModel> {
    return this.obtenerSueldoBase.execute(new ObtenerSueldoBaseQuery(usuario.id));
  }
}
