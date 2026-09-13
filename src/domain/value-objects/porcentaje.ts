import { PorcentajeInvalidoError } from '../errors/porcentaje-invalido.error';

/**
 * Porcentaje de cálculo, almacenado en **puntos base** (centésimas de punto
 * porcentual): 16 % = 1 600 puntos base.
 *
 * ## Por qué no es un `number`
 *
 * Guardar "16" o "0.16" a secas es una confusión esperando a ocurrir, y `0.16`
 * además no es representable en binario, así que multiplicar por él arrastraría
 * error de coma flotante justo donde el negocio exige exactitud (RN-14). En
 * puntos base el factor es un **entero**, y `Monto.porcentaje()` puede hacer
 * toda la cuenta con aritmética entera exacta.
 *
 * Los dos porcentajes del negocio son el 16 % bimestral del trabajador (RN-08)
 * y el 32 % de diciembre (RN-10).
 */
export class Porcentaje {
  private static readonly PUNTOS_BASE_POR_PUNTO_PORCENTUAL = 100;
  /** Tolerancia al comparar el redondeo de la entrada; muy por encima del error de coma flotante a esta escala. */
  private static readonly TOLERANCIA = 1e-9;

  private constructor(
    /** Porcentaje expresado en puntos base: 16 % → 1600. */
    readonly puntosBase: number,
  ) {}

  /**
   * Construye un porcentaje a partir de su valor "por ciento" habitual.
   *
   * @param valor Por ejemplo `16` para el 16 %. Admite hasta dos decimales.
   * @throws {PorcentajeInvalidoError} si no es finito, es negativo o tiene más
   *   de dos decimales.
   */
  static dePorCiento(valor: number): Porcentaje {
    if (!Number.isFinite(valor)) {
      throw new PorcentajeInvalidoError(`"${String(valor)}" no es un número finito`);
    }
    if (valor < 0) {
      throw new PorcentajeInvalidoError(`no puede ser negativo (${valor})`);
    }

    const puntosBaseExactos = valor * Porcentaje.PUNTOS_BASE_POR_PUNTO_PORCENTUAL;
    const puntosBase = Math.round(puntosBaseExactos);
    if (Math.abs(puntosBaseExactos - puntosBase) > Porcentaje.TOLERANCIA) {
      throw new PorcentajeInvalidoError(`${valor} tiene más de dos decimales`);
    }

    return new Porcentaje(puntosBase);
  }

  toString(): string {
    return `${this.puntosBase / Porcentaje.PUNTOS_BASE_POR_PUNTO_PORCENTUAL}%`;
  }
}
