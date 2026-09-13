import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../../domain/errors/domain.error';

/**
 * Traduce los errores de dominio a códigos HTTP (CLAUDE.md §7.7).
 *
 * ## Por qué el mapeo vive aquí y no en el dominio
 *
 * El dominio lanza errores **semánticos** (`BimestreBloqueadoError`), no
 * errores HTTP: no sabe que existe HTTP. La aplicación los deja propagar tal
 * cual. Es en la frontera —aquí— donde se decide qué código les corresponde, y
 * el mapeo se hace por el **`codigo` estable** del error, nunca por su mensaje,
 * de modo que reescribir un texto no rompa el contrato de la API.
 *
 * ## Última línea de defensa
 *
 * Captura **todo**, no sólo los errores de dominio, precisamente para garantizar
 * lo que exige CLAUDE.md §7.7: que nunca salgan al cliente errores de TypeORM ni
 * stack traces. Lo que no reconoce se convierte en un `500` genérico y se
 * registra en el log del servidor, donde sí interesa el detalle.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  /**
   * Código HTTP de cada error de dominio (tabla §5 del catálogo de casos de uso).
   *
   * - `400` la petición está mal formada o trae datos que no le tocan.
   * - `401` / `403` no se sabe quién es, o se sabe y no le corresponde.
   * - `404` no existe.
   * - `409` la petición es válida pero choca con el estado actual.
   * - `422` está bien formada pero incumple una regla de negocio.
   * - `500` incoherencia interna: no debería ocurrir con datos sanos.
   */
  private static readonly CODIGOS_HTTP: Readonly<Record<string, HttpStatus>> = {
    /* Calendario y disponibilidad */
    BIMESTRE_INEXISTENTE: HttpStatus.BAD_REQUEST,
    BIMESTRE_BLOQUEADO: HttpStatus.CONFLICT,
    PERIODO_SOLICITUD_CERRADO: HttpStatus.CONFLICT,
    PERIODO_DICIEMBRE_CERRADO: HttpStatus.CONFLICT,

    /* Montos y política de préstamo */
    MONTO_EXCEDE_LIMITE: HttpStatus.UNPROCESSABLE_ENTITY,
    MONTO_MENOR_AL_MINIMO: HttpStatus.UNPROCESSABLE_ENTITY,
    MONTO_INVALIDO: HttpStatus.UNPROCESSABLE_ENTITY,
    MONTO_REQUERIDO: HttpStatus.BAD_REQUEST,
    MONTO_NO_CAPTURABLE: HttpStatus.BAD_REQUEST,
    DICIEMBRE_EXCLUSIVO_TRABAJADORES: HttpStatus.FORBIDDEN,

    /* Sueldo base */
    SUELDO_BASE_NO_REGISTRADO: HttpStatus.CONFLICT,
    SUELDO_BASE_YA_REGISTRADO: HttpStatus.CONFLICT,
    SUELDO_BASE_SOLO_TRABAJADORES: HttpStatus.FORBIDDEN,
    SUELDO_BASE_INVALIDO: HttpStatus.UNPROCESSABLE_ENTITY,

    /* Registro de solicitud */
    PERIODO_DE_OTRO_ANIO: HttpStatus.BAD_REQUEST,
    PERIODO_YA_SOLICITADO_CON_OTRO_MONTO: HttpStatus.CONFLICT,
    CONFLICTO_DE_CONCURRENCIA: HttpStatus.CONFLICT,

    /* Identidad y acceso */
    SOLICITANTE_NO_ENCONTRADO: HttpStatus.NOT_FOUND,
    SOLICITANTE_ID_INVALIDO: HttpStatus.BAD_REQUEST,
    CORREO_YA_REGISTRADO: HttpStatus.CONFLICT,
    CREDENCIALES_INVALIDAS: HttpStatus.UNAUTHORIZED,

    /* Integridad interna: llegan aquí sólo si los datos almacenados son incoherentes */
    FECHA_INVALIDA: HttpStatus.BAD_REQUEST,
    PERIODO_INVALIDO: HttpStatus.INTERNAL_SERVER_ERROR,
    PORCENTAJE_INVALIDO: HttpStatus.INTERNAL_SERVER_ERROR,
    TIPO_USUARIO_INVALIDO: HttpStatus.INTERNAL_SERVER_ERROR,
  };

  /** Código HTTP que corresponde a un error de dominio. */
  static codigoHttpDe(error: DomainError): HttpStatus {
    return DomainExceptionFilter.CODIGOS_HTTP[error.codigo] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<Response>();
    const peticion = contexto.getRequest<Request>();

    const { estado, codigo, mensaje } = this.traducir(excepcion, peticion);

    respuesta.status(estado).json({
      statusCode: estado,
      codigo,
      mensaje,
      path: peticion.url,
      timestamp: new Date().toISOString(),
    });
  }

  private traducir(
    excepcion: unknown,
    peticion: Request,
  ): { estado: HttpStatus; codigo: string; mensaje: string | string[] } {
    if (excepcion instanceof DomainError) {
      return {
        estado: DomainExceptionFilter.codigoHttpDe(excepcion),
        codigo: excepcion.codigo,
        mensaje: excepcion.message,
      };
    }

    if (excepcion instanceof HttpException) {
      // Errores del propio framework: validación de DTOs (ValidationPipe),
      // autenticación y autorización de los guards, rutas inexistentes.
      const cuerpo = excepcion.getResponse();
      const mensaje =
        typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo
          ? ((cuerpo as { message: string | string[] }).message ?? excepcion.message)
          : excepcion.message;
      return {
        estado: excepcion.getStatus(),
        codigo: DomainExceptionFilter.codigoDeHttpException(excepcion.getStatus()),
        mensaje,
      };
    }

    /*
     * Cualquier otra cosa —un fallo de TypeORM, un bug— se registra entera en el
     * servidor y se responde con un mensaje genérico: al cliente no le llega ni
     * el detalle del error ni el stack trace (CLAUDE.md §7.7).
     */
    this.logger.error(
      `Error no controlado en ${peticion.method} ${peticion.url}`,
      excepcion instanceof Error ? excepcion.stack : String(excepcion),
    );
    return {
      estado: HttpStatus.INTERNAL_SERVER_ERROR,
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error interno. Inténtalo de nuevo más tarde.',
    };
  }

  private static codigoDeHttpException(estado: HttpStatus): string {
    switch (estado) {
      case HttpStatus.BAD_REQUEST:
        return 'PETICION_INVALIDA';
      case HttpStatus.UNAUTHORIZED:
        return 'NO_AUTENTICADO';
      case HttpStatus.FORBIDDEN:
        return 'NO_AUTORIZADO';
      case HttpStatus.NOT_FOUND:
        return 'RUTA_NO_ENCONTRADA';
      default:
        return 'ERROR_HTTP';
    }
  }
}
