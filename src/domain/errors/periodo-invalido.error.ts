import { DomainError } from './domain.error';

/**
 * Se intentó construir un periodo cuyo fin es anterior a su inicio.
 *
 * Invariante del value object `Periodo`: todo periodo del calendario (§2.1 del
 * planteamiento) es un rango cerrado y no vacío de fechas civiles.
 */
export class PeriodoInvalidoError extends DomainError {
  constructor(motivo: string) {
    super('PERIODO_INVALIDO', `Periodo inválido: ${motivo}.`);
  }
}
