import { DiciembreExclusivoTrabajadoresError } from '../errors/diciembre-exclusivo-trabajadores.error';
import { MontoExcedeLimiteError } from '../errors/monto-excede-limite.error';
import { MontoMenorAlMinimoError } from '../errors/monto-menor-al-minimo.error';
import { MontoRequeridoError } from '../errors/monto-requerido.error';
import { Monto } from '../value-objects/monto';
import { TipoUsuario } from '../value-objects/tipo-usuario';
import { PoliticaPrestamo } from './politica-prestamo';

/**
 * Política del **alumno**: rango con tope (RN-09).
 *
 * El alumno elige libremente el monto de cada bimestre entre **$0.01 y
 * $3,500.00**, y el sistema se limita a validarlo.
 *
 * ## El tope es por bimestre, no acumulado
 *
 * Ésta es la sutileza que el planteamiento subraya (§5): un alumno que solicita
 * los cinco bimestres a $3,500.00 cada uno suma $17,500.00 y **no incumple
 * nada**. Por eso esta política valida montos de uno en uno y nunca consulta el
 * registro acumulado del usuario: si validara sumas, el tope se volvería
 * acumulado y la regla cambiaría de significado.
 *
 * ## Diciembre
 *
 * Los alumnos no reciben nada en diciembre (RN-12).
 */
export class PoliticaPrestamoAlumno implements PoliticaPrestamo {
  /** Mínimo por bimestre: un centavo (RN-09). */
  static readonly MONTO_MINIMO_POR_BIMESTRE = Monto.desdePesos('0.01');
  /** Tope por bimestre (RN-09). */
  static readonly MONTO_MAXIMO_POR_BIMESTRE = Monto.desdePesos('3500.00');

  readonly tipoUsuario = TipoUsuario.ALUMNO;

  /**
   * Valida el monto capturado por el alumno para un bimestre.
   *
   * @throws {MontoRequeridoError} si no capturó monto: el sistema no puede
   *   suponer uno sin inventarse una regla.
   * @throws {MontoMenorAlMinimoError} si pide menos de $0.01.
   * @throws {MontoExcedeLimiteError} si pide más de $3,500.00 en ese bimestre.
   */
  montoParaBimestre(montoSolicitado: Monto | null): Monto {
    if (montoSolicitado === null) {
      throw new MontoRequeridoError();
    }
    if (montoSolicitado.esMenorQue(PoliticaPrestamoAlumno.MONTO_MINIMO_POR_BIMESTRE)) {
      throw new MontoMenorAlMinimoError(
        montoSolicitado.aCadena(),
        PoliticaPrestamoAlumno.MONTO_MINIMO_POR_BIMESTRE.aCadena(),
      );
    }
    if (montoSolicitado.esMayorQue(PoliticaPrestamoAlumno.MONTO_MAXIMO_POR_BIMESTRE)) {
      throw new MontoExcedeLimiteError(
        montoSolicitado.aCadena(),
        PoliticaPrestamoAlumno.MONTO_MAXIMO_POR_BIMESTRE.aCadena(),
      );
    }
    return montoSolicitado;
  }

  /**
   * `null`: el monto del alumno no está determinado de antemano, lo elige él
   * dentro del rango (RN-09).
   */
  montoPrevistoParaBimestre(): Monto | null {
    return null;
  }

  /** Siempre `false`: diciembre es exclusivo de trabajadores (RN-12). */
  tieneDerechoADiciembre(): boolean {
    return false;
  }

  /** @throws {DiciembreExclusivoTrabajadoresError} siempre (RN-12). */
  montoParaDiciembre(): Monto {
    throw new DiciembreExclusivoTrabajadoresError();
  }
}
