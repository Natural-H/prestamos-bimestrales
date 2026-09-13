import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ListarBimestresHandler } from '../../application/queries/listar-bimestres.handler';
import { ListarBimestresQuery } from '../../application/queries/listar-bimestres.query';
import { ObtenerBimestreHandler } from '../../application/queries/obtener-bimestre.handler';
import { ObtenerBimestreQuery } from '../../application/queries/obtener-bimestre.query';
import { ObtenerDisponibilidadDiciembreHandler } from '../../application/queries/obtener-disponibilidad-diciembre.handler';
import { ObtenerDisponibilidadDiciembreQuery } from '../../application/queries/obtener-disponibilidad-diciembre.query';
import {
  BimestreDisponibleReadModel,
  CalendarioDeBimestresReadModel,
  DisponibilidadDiciembreReadModel,
} from '../../application/read-models/calendario.read-model';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';
import { CurrentUser, UsuarioAutenticado } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * "El usuario ingresa y consulta los bimestres disponibles" (planteamiento §1),
 * como endpoints de lectura.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarioController {
  constructor(
    private readonly listarBimestres: ListarBimestresHandler,
    private readonly obtenerBimestre: ObtenerBimestreHandler,
    private readonly disponibilidadDiciembre: ObtenerDisponibilidadDiciembreHandler,
  ) {}

  /**
   * Los cinco bimestres del año con su estado (CU-C01) y la bandera de cierre de
   * temporada (CU-C04).
   *
   * Devuelve **todos**, incluidos los bloqueados: ocultarlos dejaría al cliente
   * sin saber por qué faltan. El bloqueo está protegido de verdad en la
   * escritura, que es donde importa (RN-04).
   */
  @Get('bimestres')
  async bimestres(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<CalendarioDeBimestresReadModel> {
    return this.listarBimestres.execute(new ListarBimestresQuery(usuario.id));
  }

  /**
   * Disponibilidad de un bimestre concreto (CU-C02).
   *
   * Consulta sin efectos: permite comprobar si sigue disponible y cuánto
   * costaría **antes** de solicitarlo, en lugar de intentarlo y ver si falla.
   *
   * `ParseIntPipe` sólo garantiza que el parámetro sea un entero; **cuáles son
   * bimestres es una regla de negocio** (RN-02) y la decide el dominio, que
   * responde `400 BIMESTRE_INEXISTENTE` para marzo o para diciembre, que no es
   * un bimestre (RN-11).
   */
  @Get('bimestres/:mes')
  async bimestre(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('mes', ParseIntPipe) mes: number,
  ): Promise<BimestreDisponibleReadModel> {
    return this.obtenerBimestre.execute(new ObtenerBimestreQuery(usuario.id, mes));
  }

  /**
   * Disponibilidad del beneficio de diciembre y monto que correspondería
   * (CU-C03).
   *
   * Exclusivo de trabajadores (RN-12): para un alumno el `RolesGuard` responde
   * `403` antes de llegar al caso de uso.
   */
  @Get('diciembre')
  @Roles(TipoUsuario.TRABAJADOR)
  async diciembre(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<DisponibilidadDiciembreReadModel> {
    return this.disponibilidadDiciembre.execute(
      new ObtenerDisponibilidadDiciembreQuery(usuario.id),
    );
  }
}
