import { SueldoBaseInvalidoError } from '../errors/sueldo-base-invalido.error';
import { Monto } from './monto';

/**
 * Sueldo base del trabajador, capturado manualmente (RN-13).
 *
 * ## Por qué es un value object y no un `Monto` a secas
 *
 * Un sueldo base no es cualquier cantidad: es **estrictamente positivo** (con
 * cero no hay préstamo que calcular) y tiene un papel propio en el negocio, el
 * de ser la base del 16 % bimestral (RN-08) y del 32 % de diciembre (RN-10).
 * Darle un tipo propio impide pasar por error un monto de préstamo donde se
 * espera un sueldo.
 *
 * ## Flota, no se congela
 *
 * El sueldo puede actualizarse a cualquier valor válido —al alza o a la baja— y
 * los montos **se recalculan**: no hay snapshots ni historial (RN-13, RN-20).
 * Como value object es inmutable: actualizar el sueldo significa sustituir esta
 * instancia por otra, no mutarla.
 */
export class SueldoBase {
  private constructor(readonly monto: Monto) {}

  /**
   * @throws {SueldoBaseInvalidoError} si el monto es cero.
   * @throws {MontoInvalidoError} si el valor ni siquiera es una cantidad de
   *   dinero válida (negativo, con más de dos decimales, etc.).
   */
  static de(monto: Monto): SueldoBase {
    if (monto.esCero()) {
      throw new SueldoBaseInvalidoError('debe ser mayor que cero');
    }
    return new SueldoBase(monto);
  }

  /** Atajo de construcción desde una cantidad en pesos, para mappers y pruebas. */
  static desdePesos(pesos: string | number): SueldoBase {
    return SueldoBase.de(Monto.desdePesos(pesos));
  }

  equals(otro: SueldoBase): boolean {
    return this.monto.equals(otro.monto);
  }

  toString(): string {
    return this.monto.toString();
  }
}
