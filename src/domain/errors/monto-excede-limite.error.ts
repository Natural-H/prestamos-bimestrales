import { DomainError } from './domain.error';

/**
 * El alumno pidió más del tope permitido **para un bimestre** (RN-09).
 *
 * El tope de $3,500.00 es **por bimestre, no acumulado**: solicitar cinco
 * bimestres de $3,500.00 cada uno es perfectamente válido. Por eso este error
 * nace de validar un monto individual y nunca de sumar el registro.
 *
 * Se mapea a `422 Unprocessable Entity` (EC-03): la petición está bien formada,
 * pero su contenido incumple una regla de negocio.
 */
export class MontoExcedeLimiteError extends DomainError {
  constructor(montoSolicitado: string, topePorBimestre: string) {
    super(
      'MONTO_EXCEDE_LIMITE',
      `El monto solicitado (MXN ${montoSolicitado}) supera el tope de MXN ${topePorBimestre} por bimestre.`,
    );
  }
}
