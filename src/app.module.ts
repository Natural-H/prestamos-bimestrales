import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActualizarSueldoBaseHandler } from './application/commands/actualizar-sueldo-base.handler';
import { CapturarSueldoBaseHandler } from './application/commands/capturar-sueldo-base.handler';
import { IniciarSesionHandler } from './application/commands/iniciar-sesion.handler';
import { RegistrarUsuarioHandler } from './application/commands/registrar-usuario.handler';
import { SolicitarBimestresHandler } from './application/commands/solicitar-bimestres.handler';
import { SolicitarDiciembreHandler } from './application/commands/solicitar-diciembre.handler';
import { CREDENCIALES_PORT, CredencialesPort } from './application/ports/credenciales.port';
import { ID_GENERATOR_PORT, IdGeneratorPort } from './application/ports/id-generator.port';
import { TOKEN_ISSUER_PORT, TokenIssuerPort } from './application/ports/token-issuer.port';
import { ConsultarEstadoEntregaHandler } from './application/queries/consultar-estado-entrega.handler';
import { ListarBimestresHandler } from './application/queries/listar-bimestres.handler';
import { ListarPeriodosSolicitadosHandler } from './application/queries/listar-periodos-solicitados.handler';
import { ObtenerBimestreHandler } from './application/queries/obtener-bimestre.handler';
import { ObtenerDisponibilidadDiciembreHandler } from './application/queries/obtener-disponibilidad-diciembre.handler';
import { ObtenerMiSolicitudHandler } from './application/queries/obtener-mi-solicitud.handler';
import { ObtenerPerfilHandler } from './application/queries/obtener-perfil.handler';
import { ObtenerSueldoBaseHandler } from './application/queries/obtener-sueldo-base.handler';

import { CargadorDelRegistro } from './application/services/cargador-del-registro';

import { CLOCK_PORT, ClockPort } from './domain/ports/clock.port';
import {
  SOLICITANTE_REPOSITORY,
  SolicitanteRepository,
} from './domain/repositories/solicitante.repository';
import {
  SOLICITUD_PRESTAMO_REPOSITORY,
  SolicitudPrestamoRepository,
} from './domain/repositories/solicitud-prestamo.repository';

import { CredencialesAdapter } from './infrastructure/auth/credenciales.adapter';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { JwtTokenIssuerAdapter } from './infrastructure/auth/jwt-token-issuer.adapter';
import { SystemClock } from './infrastructure/clock/system-clock';
import { opcionesDeConexion } from './infrastructure/config/data-source';
import { validarEnv } from './infrastructure/config/env.config';
import { UuidGeneratorAdapter } from './infrastructure/id/uuid-generator.adapter';
import { CredencialesOrmEntity } from './infrastructure/persistence/typeorm/entities/credenciales.orm-entity';
import { SolicitanteOrmEntity } from './infrastructure/persistence/typeorm/entities/solicitante.orm-entity';
import {
  PeriodoSolicitadoOrmEntity,
  SolicitudPrestamoOrmEntity,
} from './infrastructure/persistence/typeorm/entities/solicitud-prestamo.orm-entity';
import { SolicitanteRepositoryImpl } from './infrastructure/persistence/typeorm/repositories/solicitante.repository.impl';
import { SolicitudPrestamoRepositoryImpl } from './infrastructure/persistence/typeorm/repositories/solicitud-prestamo.repository.impl';

import { AuthController } from './presentation/controllers/auth.controller';
import { CalendarioController } from './presentation/controllers/calendario.controller';
import { SolicitudesController } from './presentation/controllers/solicitudes.controller';
import { SueldoBaseController } from './presentation/controllers/sueldo-base.controller';
import { DomainExceptionFilter } from './presentation/filters/domain-exception.filter';

/**
 * Cableado de la aplicación: **el único sitio donde se dice qué implementación
 * satisface qué puerto** (CLAUDE.md §4.1).
 *
 * ## Por qué los handlers se registran con `useFactory`
 *
 * Los casos de uso son clases planas, sin `@Injectable` ni decoradores: la capa
 * de aplicación está libre de framework a propósito, para poder probarse
 * instanciándola con dobles. El precio de esa decisión es declarar aquí sus
 * dependencias a mano, y es un precio barato: estas fábricas son la
 * documentación ejecutable de qué necesita cada caso de uso.
 *
 * Las dependencias se declaran contra **tokens de interfaz** (`CLOCK_PORT`,
 * `SOLICITUD_PRESTAMO_REPOSITORY`), nunca contra la clase concreta: cambiar
 * TypeORM por otra cosa es cambiar una línea de este archivo (§5-D).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    TypeOrmModule.forRoot(opcionesDeConexion()),
    TypeOrmModule.forFeature([
      SolicitanteOrmEntity,
      SolicitudPrestamoOrmEntity,
      PeriodoSolicitadoOrmEntity,
      CredencialesOrmEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController, CalendarioController, SolicitudesController, SueldoBaseController],
  providers: [
    /* --- Adaptadores de los puertos --- */
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: SOLICITANTE_REPOSITORY, useClass: SolicitanteRepositoryImpl },
    { provide: SOLICITUD_PRESTAMO_REPOSITORY, useClass: SolicitudPrestamoRepositoryImpl },
    { provide: CREDENCIALES_PORT, useClass: CredencialesAdapter },
    { provide: TOKEN_ISSUER_PORT, useClass: JwtTokenIssuerAdapter },
    { provide: ID_GENERATOR_PORT, useClass: UuidGeneratorAdapter },
    JwtStrategy,

    /*
     * Colaborador compartido: carga el contexto (hoy + solicitante + registro
     * del año) que necesitan los ocho casos de uso del registro.
     */
    {
      provide: CargadorDelRegistro,
      inject: [CLOCK_PORT, SOLICITANTE_REPOSITORY, SOLICITUD_PRESTAMO_REPOSITORY],
      useFactory: (
        clock: ClockPort,
        solicitantes: SolicitanteRepository,
        solicitudes: SolicitudPrestamoRepository,
      ) => new CargadorDelRegistro(clock, solicitantes, solicitudes),
    },

    /* --- Casos de uso: comandos --- */
    {
      provide: SolicitarBimestresHandler,
      inject: [CargadorDelRegistro, SOLICITUD_PRESTAMO_REPOSITORY],
      useFactory: (registros: CargadorDelRegistro, solicitudes: SolicitudPrestamoRepository) =>
        new SolicitarBimestresHandler(registros, solicitudes),
    },
    {
      provide: SolicitarDiciembreHandler,
      inject: [CargadorDelRegistro, SOLICITUD_PRESTAMO_REPOSITORY],
      useFactory: (registros: CargadorDelRegistro, solicitudes: SolicitudPrestamoRepository) =>
        new SolicitarDiciembreHandler(registros, solicitudes),
    },
    {
      provide: CapturarSueldoBaseHandler,
      inject: [SOLICITANTE_REPOSITORY],
      useFactory: (solicitantes: SolicitanteRepository) =>
        new CapturarSueldoBaseHandler(solicitantes),
    },
    {
      provide: ActualizarSueldoBaseHandler,
      inject: [SOLICITANTE_REPOSITORY],
      useFactory: (solicitantes: SolicitanteRepository) =>
        new ActualizarSueldoBaseHandler(solicitantes),
    },
    {
      provide: RegistrarUsuarioHandler,
      inject: [ID_GENERATOR_PORT, SOLICITANTE_REPOSITORY, CREDENCIALES_PORT],
      useFactory: (
        ids: IdGeneratorPort,
        solicitantes: SolicitanteRepository,
        credenciales: CredencialesPort,
      ) => new RegistrarUsuarioHandler(ids, solicitantes, credenciales),
    },
    {
      provide: IniciarSesionHandler,
      inject: [CREDENCIALES_PORT, SOLICITANTE_REPOSITORY, TOKEN_ISSUER_PORT],
      useFactory: (
        credenciales: CredencialesPort,
        solicitantes: SolicitanteRepository,
        tokens: TokenIssuerPort,
      ) => new IniciarSesionHandler(credenciales, solicitantes, tokens),
    },

    /* --- Casos de uso: consultas --- */
    {
      provide: ObtenerMiSolicitudHandler,
      inject: [CargadorDelRegistro],
      useFactory: (registros: CargadorDelRegistro) => new ObtenerMiSolicitudHandler(registros),
    },
    {
      provide: ListarBimestresHandler,
      inject: [CargadorDelRegistro],
      useFactory: (registros: CargadorDelRegistro) => new ListarBimestresHandler(registros),
    },
    {
      provide: ObtenerBimestreHandler,
      inject: [CargadorDelRegistro],
      useFactory: (registros: CargadorDelRegistro) => new ObtenerBimestreHandler(registros),
    },
    {
      provide: ListarPeriodosSolicitadosHandler,
      inject: [CargadorDelRegistro],
      useFactory: (registros: CargadorDelRegistro) =>
        new ListarPeriodosSolicitadosHandler(registros),
    },
    {
      provide: ConsultarEstadoEntregaHandler,
      inject: [CargadorDelRegistro],
      useFactory: (registros: CargadorDelRegistro) => new ConsultarEstadoEntregaHandler(registros),
    },
    {
      provide: ObtenerDisponibilidadDiciembreHandler,
      inject: [CargadorDelRegistro],
      useFactory: (registros: CargadorDelRegistro) =>
        new ObtenerDisponibilidadDiciembreHandler(registros),
    },
    {
      provide: ObtenerSueldoBaseHandler,
      inject: [SOLICITANTE_REPOSITORY],
      useFactory: (solicitantes: SolicitanteRepository) =>
        new ObtenerSueldoBaseHandler(solicitantes),
    },
    {
      provide: ObtenerPerfilHandler,
      inject: [SOLICITANTE_REPOSITORY],
      useFactory: (solicitantes: SolicitanteRepository) => new ObtenerPerfilHandler(solicitantes),
    },

    /* --- Transversales de presentación --- */
    {
      // Validación de forma de todos los DTOs (CLAUDE.md §7.6).
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
    {
      // Traducción de errores de dominio a HTTP (CLAUDE.md §7.7).
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class AppModule {}
