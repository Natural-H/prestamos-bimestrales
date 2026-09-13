import { ArgumentsHost, BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { DomainExceptionFilter } from '../../src/presentation/filters/domain-exception.filter';
import { DomainError } from '../../src/domain/errors/domain.error';
import { BimestreBloqueadoError } from '../../src/domain/errors/bimestre-bloqueado.error';
import { BimestreInexistenteError } from '../../src/domain/errors/bimestre-inexistente.error';
import { ConflictoDeConcurrenciaError } from '../../src/domain/errors/conflicto-de-concurrencia.error';
import { CorreoYaRegistradoError } from '../../src/domain/errors/correo-ya-registrado.error';
import { CredencialesInvalidasError } from '../../src/domain/errors/credenciales-invalidas.error';
import { DiciembreExclusivoTrabajadoresError } from '../../src/domain/errors/diciembre-exclusivo-trabajadores.error';
import { MontoExcedeLimiteError } from '../../src/domain/errors/monto-excede-limite.error';
import { MontoMenorAlMinimoError } from '../../src/domain/errors/monto-menor-al-minimo.error';
import { MontoNoCapturableError } from '../../src/domain/errors/monto-no-capturable.error';
import { MontoRequeridoError } from '../../src/domain/errors/monto-requerido.error';
import { PeriodoDiciembreCerradoError } from '../../src/domain/errors/periodo-diciembre-cerrado.error';
import { PeriodoSolicitudCerradoError } from '../../src/domain/errors/periodo-solicitud-cerrado.error';
import { PeriodoYaSolicitadoConOtroMontoError } from '../../src/domain/errors/periodo-ya-solicitado-con-otro-monto.error';
import { SolicitanteNoEncontradoError } from '../../src/domain/errors/solicitante-no-encontrado.error';
import { SueldoBaseInvalidoError } from '../../src/domain/errors/sueldo-base-invalido.error';
import { SueldoBaseNoRegistradoError } from '../../src/domain/errors/sueldo-base-no-registrado.error';
import { SueldoBaseSoloTrabajadoresError } from '../../src/domain/errors/sueldo-base-solo-trabajadores.error';
import { SueldoBaseYaRegistradoError } from '../../src/domain/errors/sueldo-base-ya-registrado.error';

/** Doble de `ArgumentsHost` con una respuesta HTTP espiable. */
const contextoHttp = () => {
  const respuesta = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => respuesta,
      getRequest: () => ({ url: '/solicitudes/bimestres', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, respuesta };
};

const cuerpoDeLaRespuesta = (respuesta: { json: jest.Mock }): Record<string, unknown> => {
  const llamadas = respuesta.json.mock.calls as Record<string, unknown>[][];
  return llamadas[0]?.[0] ?? {};
};

describe('DomainExceptionFilter', () => {
  const filtro = new DomainExceptionFilter();

  describe('mapeo de errores de dominio a HTTP (tabla §5 del catálogo)', () => {
    it.each<[DomainError, HttpStatus]>([
      [new BimestreBloqueadoError('2026-02', '2026-02-28'), HttpStatus.CONFLICT],
      [new PeriodoSolicitudCerradoError(2026), HttpStatus.CONFLICT],
      [new PeriodoDiciembreCerradoError(2026), HttpStatus.CONFLICT],
      [
        new PeriodoYaSolicitadoConOtroMontoError('2026-02', '100.00', '200.00'),
        HttpStatus.CONFLICT,
      ],
      [new ConflictoDeConcurrenciaError('usuario-1:2026'), HttpStatus.CONFLICT],
      [new SueldoBaseNoRegistradoError(), HttpStatus.CONFLICT],
      [new SueldoBaseYaRegistradoError(), HttpStatus.CONFLICT],
      [new CorreoYaRegistradoError('a@b.mx'), HttpStatus.CONFLICT],
      [new MontoExcedeLimiteError('3500.01', '3500.00'), HttpStatus.UNPROCESSABLE_ENTITY],
      [new MontoMenorAlMinimoError('0.00', '0.01'), HttpStatus.UNPROCESSABLE_ENTITY],
      [new SueldoBaseInvalidoError('debe ser mayor que cero'), HttpStatus.UNPROCESSABLE_ENTITY],
      [new MontoRequeridoError(), HttpStatus.BAD_REQUEST],
      [new MontoNoCapturableError(), HttpStatus.BAD_REQUEST],
      [new BimestreInexistenteError(3), HttpStatus.BAD_REQUEST],
      [new DiciembreExclusivoTrabajadoresError(), HttpStatus.FORBIDDEN],
      [new SueldoBaseSoloTrabajadoresError(), HttpStatus.FORBIDDEN],
      [new CredencialesInvalidasError(), HttpStatus.UNAUTHORIZED],
      [new SolicitanteNoEncontradoError('usuario-1'), HttpStatus.NOT_FOUND],
    ])('$codigo → %i', (error, esperado) => {
      expect(DomainExceptionFilter.codigoHttpDe(error)).toBe(esperado);
    });
  });

  it('responde con el código estable del error, no con su mensaje', () => {
    const { host, respuesta } = contextoHttp();

    filtro.catch(new BimestreBloqueadoError('2026-02', '2026-02-28'), host);

    expect(respuesta.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(cuerpoDeLaRespuesta(respuesta)).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      codigo: 'BIMESTRE_BLOQUEADO',
      path: '/solicitudes/bimestres',
    });
  });

  it('deja pasar los errores del framework con su propio código', () => {
    const { host, respuesta } = contextoHttp();

    filtro.catch(new BadRequestException(['mesReferencia debe ser un número entero.']), host);

    expect(respuesta.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(cuerpoDeLaRespuesta(respuesta)).toMatchObject({
      codigo: 'PETICION_INVALIDA',
      mensaje: ['mesReferencia debe ser un número entero.'],
    });
  });

  describe('última línea de defensa (CLAUDE.md §7.7)', () => {
    it('convierte cualquier error desconocido en un 500 genérico', () => {
      const registro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { host, respuesta } = contextoHttp();
      const errorDeTypeOrm = new Error(
        'QueryFailedError: duplicate key value violates unique constraint "UQ_solicitud_periodo"',
      );

      filtro.catch(errorDeTypeOrm, host);

      const cuerpo = cuerpoDeLaRespuesta(respuesta);
      expect(respuesta.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(cuerpo).toMatchObject({ codigo: 'ERROR_INTERNO' });
      // Ni el detalle del error ni el stack trace salen al cliente...
      expect(JSON.stringify(cuerpo)).not.toContain('QueryFailedError');
      expect(JSON.stringify(cuerpo)).not.toContain('UQ_solicitud_periodo');
      // ...pero sí quedan registrados en el servidor.
      expect(registro).toHaveBeenCalled();
      registro.mockRestore();
    });

    it('un error de dominio sin mapear se trata como fallo interno, no como petición inválida', () => {
      class ErrorSinMapear extends DomainError {
        constructor() {
          super('ERROR_NUEVO_SIN_MAPEAR', 'Un error de dominio añadido sin actualizar el filtro.');
        }
      }

      expect(DomainExceptionFilter.codigoHttpDe(new ErrorSinMapear())).toBe(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });
});
