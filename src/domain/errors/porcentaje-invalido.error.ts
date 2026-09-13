import { DomainError } from './domain.error';

/**
 * El valor recibido no puede representar un porcentaje de cálculo de préstamo.
 *
 * Los porcentajes del negocio son el 16 % bimestral y el 32 % de diciembre
 * (RN-08, RN-10); el value object `Porcentaje` los admite con hasta dos
 * decimales y nunca negativos.
 */
export class PorcentajeInvalidoError extends DomainError {
  constructor(motivo: string) {
    super('PORCENTAJE_INVALIDO', `Porcentaje inválido: ${motivo}.`);
  }
}
