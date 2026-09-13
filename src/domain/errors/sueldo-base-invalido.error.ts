import { DomainError } from './domain.error';

/**
 * El valor recibido no puede ser un sueldo base (RN-13).
 *
 * Un sueldo base es una cantidad **estrictamente positiva**: con cero no existe
 * préstamo que calcular. Nótese que sí se admite **bajar** el sueldo respecto al
 * anterior —la actualización acepta cualquier valor válido y recalcula—, así que
 * este error nunca se lanza por comparar con el sueldo previo.
 *
 * Se mapea a `422 Unprocessable Entity`.
 */
export class SueldoBaseInvalidoError extends DomainError {
  constructor(motivo: string) {
    super('SUELDO_BASE_INVALIDO', `Sueldo base inválido: ${motivo}.`);
  }
}
