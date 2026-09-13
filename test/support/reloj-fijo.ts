import { ClockPort } from '../../src/domain/ports/clock.port';

/**
 * Implementación de prueba de {@link ClockPort}: devuelve siempre el mismo
 * instante.
 *
 * Es lo que permite probar el bloqueo de bimestres (RN-04) y el cierre de
 * temporada (RN-05) sin depender del día en que se ejecuten las pruebas
 * (CLAUDE.md §10). Sustituye a `SystemClock` sin sorpresas: el contrato del
 * puerto es una única operación sin efectos (principio de sustitución de
 * Liskov).
 */
export class RelojFijo implements ClockPort {
  private constructor(private instante: Date) {}

  /**
   * Crea un reloj plantado en una fecha y hora de **México**.
   *
   * La zona horaria del TECNM es UTC-6 y, desde 2022, México no aplica horario
   * de verano, así que el desfase es constante y basta con sumar seis horas para
   * obtener el instante UTC equivalente. Escribir las pruebas en hora local es
   * lo que las hace legibles: "el 1 de marzo a las 00:00 en México".
   */
  static enMexico(anio: number, mes: number, dia: number, hora = 0, minuto = 0): RelojFijo {
    const DESFASE_UTC_MEXICO_EN_HORAS = 6;
    return new RelojFijo(
      new Date(Date.UTC(anio, mes - 1, dia, hora + DESFASE_UTC_MEXICO_EN_HORAS, minuto)),
    );
  }

  /** Crea un reloj a partir de un instante UTC explícito (para probar el borde de la zona horaria). */
  static enUtc(iso: string): RelojFijo {
    return new RelojFijo(new Date(iso));
  }

  now(): Date {
    return new Date(this.instante.getTime());
  }
}
