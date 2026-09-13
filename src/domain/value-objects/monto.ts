import { MontoInvalidoError } from '../errors/monto-invalido.error';
import { Porcentaje } from './porcentaje';

/**
 * Cantidad de dinero en **pesos mexicanos**, representada internamente como un
 * número entero de **centavos** (RN-14).
 *
 * ## Por qué centavos y no `number` en pesos
 *
 * `0.1 + 0.2 !== 0.3` en coma flotante. Un sistema de préstamos que suma montos
 * bimestre a bimestre y calcula porcentajes de un sueldo no puede permitirse ese
 * error acumulado, así que aquí no existe ninguna fracción de centavo: todo es
 * aritmética entera y el redondeo ocurre en **un solo lugar**, documentado.
 *
 * ## Política de redondeo (RN-19)
 *
 * **Half-up al centavo**: media unidad se redondea hacia arriba. Es la regla
 * única de todo el sistema y vive aquí, en `porcentaje()`, que es el único punto
 * donde puede aparecer una fracción. Ejemplo del planteamiento:
 * $12,345.67 × 16 % = $1,975.3072 → **$1,975.31**.
 *
 * Todos los montos del negocio son no negativos (un préstamo mínimo del alumno
 * es de $0.01, RN-09), así que el value object rechaza cantidades negativas y el
 * redondeo no necesita definir comportamiento para ellas.
 */
export class Monto {
  private static readonly CENTAVOS_POR_PESO = 100;
  /** Puntos base de un 100 %; divisor de la aritmética entera de `porcentaje()`. */
  private static readonly PUNTOS_BASE_TOTALES = 10_000;
  /**
   * Tope defensivo: 10 000 millones de pesos.
   *
   * Por debajo de este límite, `centavos × puntosBase` sigue cabiendo holgadamente
   * en el entero seguro de JavaScript, así que la aritmética es exacta. Ningún
   * sueldo ni préstamo real del TECNM se acerca; el tope sólo protege de basura
   * de entrada.
   */
  private static readonly MAXIMO_CENTAVOS = 1_000_000_000_000;
  /** Tolerancia al validar los decimales de una entrada en pesos. */
  private static readonly TOLERANCIA = 1e-6;

  private constructor(private readonly centavos: number) {}

  /** Monto de cero pesos. */
  static readonly CERO = new Monto(0);

  /**
   * Construye un monto desde una cantidad entera de centavos.
   *
   * @throws {MontoInvalidoError} si no es un entero, es negativo o supera el tope.
   */
  static desdeCentavos(centavos: number): Monto {
    if (!Number.isInteger(centavos)) {
      throw new MontoInvalidoError(`${centavos} centavos no es un entero`);
    }
    if (centavos < 0) {
      throw new MontoInvalidoError(`no puede ser negativo (${centavos} centavos)`);
    }
    if (centavos > Monto.MAXIMO_CENTAVOS) {
      throw new MontoInvalidoError(`${centavos} centavos supera el máximo representable`);
    }
    return new Monto(centavos);
  }

  /**
   * Construye un monto desde una cantidad en pesos.
   *
   * Acepta cadena (`'3500.00'`, la forma exacta y preferida en los bordes de la
   * API y del ORM) o número (`3500.5`). En ambos casos exige **como máximo dos
   * decimales**: no existe la fracción de centavo, y aceptarla en silencio sería
   * redondear a espaldas del usuario.
   *
   * @throws {MontoInvalidoError} si el formato es inválido o tiene más de dos decimales.
   */
  static desdePesos(pesos: string | number): Monto {
    if (typeof pesos === 'string') {
      if (!/^\d+(\.\d{1,2})?$/.test(pesos.trim())) {
        throw new MontoInvalidoError(
          `"${pesos}" no es una cantidad en pesos con hasta dos decimales`,
        );
      }
      const [enteros, decimales = ''] = pesos.trim().split('.');
      const centavos =
        Number.parseInt(enteros, 10) * Monto.CENTAVOS_POR_PESO +
        Number.parseInt(decimales.padEnd(2, '0'), 10);
      return Monto.desdeCentavos(centavos);
    }

    if (!Number.isFinite(pesos)) {
      throw new MontoInvalidoError(`"${String(pesos)}" no es un número finito`);
    }
    const centavosExactos = pesos * Monto.CENTAVOS_POR_PESO;
    const centavos = Math.round(centavosExactos);
    if (Math.abs(centavosExactos - centavos) > Monto.TOLERANCIA) {
      throw new MontoInvalidoError(`${pesos} tiene más de dos decimales`);
    }
    return Monto.desdeCentavos(centavos);
  }

  /** Valor en centavos; es la forma canónica para persistir y comparar. */
  get enCentavos(): number {
    return this.centavos;
  }

  /**
   * Aplica un porcentaje sobre este monto, con redondeo **half-up al centavo**
   * (RN-19).
   *
   * Es el cálculo del préstamo del trabajador: 16 % del sueldo base por bimestre
   * (RN-08) y 32 % en diciembre (RN-10).
   *
   * La cuenta es íntegramente entera: `centavos × puntosBase` es exacto, y la
   * división final se resuelve sumando media unidad antes de truncar, que para
   * cantidades no negativas equivale a redondear hacia arriba los empates.
   */
  porcentaje(porcentaje: Porcentaje): Monto {
    const producto = this.centavos * porcentaje.puntosBase;
    const redondeado = Math.floor(
      (producto + Monto.PUNTOS_BASE_TOTALES / 2) / Monto.PUNTOS_BASE_TOTALES,
    );
    return Monto.desdeCentavos(redondeado);
  }

  /** Suma dos montos. Inmutable: devuelve uno nuevo. */
  sumar(otro: Monto): Monto {
    return Monto.desdeCentavos(this.centavos + otro.centavos);
  }

  esMayorQue(otro: Monto): boolean {
    return this.centavos > otro.centavos;
  }

  esMenorQue(otro: Monto): boolean {
    return this.centavos < otro.centavos;
  }

  equals(otro: Monto): boolean {
    return this.centavos === otro.centavos;
  }

  esCero(): boolean {
    return this.centavos === 0;
  }

  /**
   * Cantidad en pesos como cadena decimal exacta (`'1975.31'`).
   *
   * Es lo que deben usar los mappers hacia el DTO y hacia la columna `numeric`
   * de PostgreSQL: convertir a `number` en el camino reintroduciría justo el
   * error de coma flotante que este value object existe para evitar.
   */
  aCadena(): string {
    const pesos = Math.floor(this.centavos / Monto.CENTAVOS_POR_PESO);
    const centavos = this.centavos % Monto.CENTAVOS_POR_PESO;
    return `${pesos}.${String(centavos).padStart(2, '0')}`;
  }

  toString(): string {
    return `MXN ${this.aCadena()}`;
  }
}
