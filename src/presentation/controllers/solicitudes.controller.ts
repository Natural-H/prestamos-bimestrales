import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SolicitarBimestresHandler } from '../../application/commands/solicitar-bimestres.handler';
import { SolicitarDiciembreCommand } from '../../application/commands/solicitar-diciembre.command';
import { SolicitarDiciembreHandler } from '../../application/commands/solicitar-diciembre.handler';
import { ConsultarEstadoEntregaHandler } from '../../application/queries/consultar-estado-entrega.handler';
import { ConsultarEstadoEntregaQuery } from '../../application/queries/consultar-estado-entrega.query';
import { ListarPeriodosSolicitadosHandler } from '../../application/queries/listar-periodos-solicitados.handler';
import { ListarPeriodosSolicitadosQuery } from '../../application/queries/listar-periodos-solicitados.query';
import { ObtenerMiSolicitudHandler } from '../../application/queries/obtener-mi-solicitud.handler';
import { ObtenerMiSolicitudQuery } from '../../application/queries/obtener-mi-solicitud.query';
import {
  EntregasReadModel,
  PeriodoSolicitadoReadModel,
  ResultadoSolicitarReadModel,
  SolicitudPrestamoReadModel,
} from '../../application/read-models/solicitud-prestamo.read-model';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';
import { CurrentUser, UsuarioAutenticado } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SolicitarBimestresDto } from '../dtos/solicitar-bimestres.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { SolicitarBimestresMapper } from '../mappers/solicitar-bimestres.mapper';

/**
 * El botón **"Solicitar"** del planteamiento, como endpoints HTTP.
 *
 * No hay pantallas: el alcance es sólo la API REST (planteamiento §7), así que
 * lo que allí se describe como una acción del usuario aquí es un `POST`.
 *
 * El controller no decide nada: traduce DTO a comando, invoca el caso de uso y
 * devuelve su modelo de lectura. Ni una regla de negocio (CLAUDE.md §4.2).
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitudesController {
  constructor(
    private readonly solicitarBimestres: SolicitarBimestresHandler,
    private readonly solicitarDiciembre: SolicitarDiciembreHandler,
    private readonly obtenerMiSolicitud: ObtenerMiSolicitudHandler,
    private readonly listarPeriodos: ListarPeriodosSolicitadosHandler,
    private readonly consultarEntregas: ConsultarEstadoEntregaHandler,
  ) {}

  /**
   * Solicita uno o más bimestres (CU-D01 alumno, CU-D02 trabajador).
   *
   * Responde **200 y no 201** a propósito: la operación es un *upsert
   * acumulativo idempotente* sobre el registro único del año, no la creación de
   * un recurso nuevo cada vez (RN-06, RN-18). Repetir la misma petición devuelve
   * el mismo 200 con el estado actual y la lista de `sinCambios` (EC-10).
   */
  @Post('solicitudes/bimestres')
  @HttpCode(HttpStatus.OK)
  async solicitar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: SolicitarBimestresDto,
  ): Promise<ResultadoSolicitarReadModel> {
    return this.solicitarBimestres.execute(SolicitarBimestresMapper.aComando(usuario.id, dto));
  }

  /**
   * Solicita el beneficio de diciembre (CU-D03).
   *
   * Sin cuerpo: el monto es el 32 % del sueldo base vigente y lo calcula el
   * sistema (RN-10). El `RolesGuard` lo reserva a trabajadores, y la política
   * del dominio lo vuelve a comprobar (RN-12).
   */
  @Post('solicitudes/diciembre')
  @Roles(TipoUsuario.TRABAJADOR)
  @HttpCode(HttpStatus.OK)
  async solicitarBeneficioDiciembre(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ResultadoSolicitarReadModel> {
    return this.solicitarDiciembre.execute(new SolicitarDiciembreCommand(usuario.id));
  }

  /**
   * Consulta el registro acumulado del año en curso (CU-D04).
   *
   * Los montos del trabajador se derivan del sueldo **vigente** en esta misma
   * consulta, así que el total puede cambiar entre dos llamadas si actualizó su
   * sueldo (RN-13, RN-20).
   */
  @Get('solicitudes/me')
  async miSolicitud(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<SolicitudPrestamoReadModel> {
    return this.obtenerMiSolicitud.execute(new ObtenerMiSolicitudQuery(usuario.id));
  }

  /**
   * Desglose periodo a periodo (CU-D05).
   *
   * Pone juntas la fecha en que se solicitó cada periodo y la ventana en que
   * corresponde recibirlo, para que quede explícito que **seleccionar por
   * adelantado no adelanta la entrega** (RN-07).
   */
  @Get('solicitudes/me/periodos')
  async periodos(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PeriodoSolicitadoReadModel[]> {
    return this.listarPeriodos.execute(new ListarPeriodosSolicitadosQuery(usuario.id));
  }

  /**
   * Estado de entrega de los periodos, derivado de la fecha (CU-E01).
   *
   * No hay endpoint para "marcar como entregado": el desembolso está fuera del
   * alcance del microservicio (RN-16) y la entrega es una lectura del calendario
   * (RN-07). Añade los totales de lo ya recibido y lo pendiente.
   */
  @Get('solicitudes/me/entregas')
  async entregas(@CurrentUser() usuario: UsuarioAutenticado): Promise<EntregasReadModel> {
    return this.consultarEntregas.execute(new ConsultarEstadoEntregaQuery(usuario.id));
  }
}
