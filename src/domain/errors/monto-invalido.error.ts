import { DomainError } from './domain.error';

/**
 * El valor recibido no puede representar una cantidad de dinero del sistema.
 *
 * Cubre tres incumplimientos del value object `Monto` (RN-14): cantidades
 * negativas, cantidades con más de dos decimales (no existe fracción de centavo)
 * y cantidades fuera del rango en el que la aritmética entera del peso sigue
 * siendo exacta.
 *
 * No confundir con `MontoExcedeLimiteError` (RN-09, tope de $3,500.00 por
 * bimestre del alumno): aquel es una regla de préstamo; éste es la integridad
 * del propio concepto de dinero.
 */
export class MontoInvalidoError extends DomainError {
  constructor(motivo: string) {
    super('MONTO_INVALIDO', `Monto inválido: ${motivo}.`);
  }
}
