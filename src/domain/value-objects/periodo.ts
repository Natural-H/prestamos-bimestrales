import { PeriodoInvalidoError } from '../errors/periodo-invalido.error';
import { FechaCivil } from './fecha-civil';

/**
 * Rango cerrado de días `[inicio, fin]` en el calendario del TECNM.
 *
 * Modela tanto los cinco bimestres como el periodo de diciembre (§2.1 del
 * planteamiento). Concentra las tres preguntas que el negocio le hace al
 * calendario:
 *
 * - **¿Ya transcurrió?** → determina el bloqueo de un bimestre (RN-04) y el
 *   cierre de temporada (RN-05).
 * - **¿Estamos dentro?** → determina la entrega, que es estado derivado de la
 *   fecha y no un proceso (RN-07).
 * - **¿Aún no empieza?** → un periodo futuro es perfectamente solicitable por
 *   adelantado (RN-03), pero su préstamo no se adelanta (RN-07).
 *
 * Es inmutable y opera sobre `FechaCivil`, nunca sobre instantes: la conversión
 * desde `ClockPort` se hace una sola vez, en el borde.
 */
export class Periodo {
  private constructor(
    readonly inicio: FechaCivil,
    readonly fin: FechaCivil,
  ) {}

  /**
   * @throws {PeriodoInvalidoError} si el fin es anterior al inicio.
   */
  static entre(inicio: FechaCivil, fin: FechaCivil): Periodo {
    if (fin.esAnteriorA(inicio)) {
      throw new PeriodoInvalidoError(
        `el fin (${fin.toString()}) precede al inicio (${inicio.toString()})`,
      );
    }
    return new Periodo(inicio, fin);
  }

  /** `true` si la fecha cae dentro del rango, extremos incluidos. */
  contiene(fecha: FechaCivil): boolean {
    return !fecha.esAnteriorA(this.inicio) && !fecha.esPosteriorA(this.fin);
  }

  /**
   * `true` si la fecha **supera el fin** del periodo.
   *
   * Es la formulación literal de RN-04: el bimestre de febrero (1 ene – 28 feb)
   * no está transcurrido el 28 de febrero, y sí lo está el 1 de marzo.
   */
  haTranscurrido(fecha: FechaCivil): boolean {
    return fecha.esPosteriorA(this.fin);
  }

  /** `true` si el periodo todavía no ha comenzado en esa fecha. */
  aunNoInicia(fecha: FechaCivil): boolean {
    return fecha.esAnteriorA(this.inicio);
  }

  toString(): string {
    return `${this.inicio.toString()}..${this.fin.toString()}`;
  }
}
