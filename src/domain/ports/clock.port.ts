/**
 * Puerto del reloj del sistema.
 *
 * El dominio **nunca** llama a `new Date()` (CLAUDE.md §7.5): el "ahora" entra
 * siempre por esta interfaz. Es lo que permite probar de forma determinista el
 * bloqueo de bimestres por fecha (RN-04) y el cierre de temporada (RN-05),
 * simulando cualquier día del año sin tocar el reloj de la máquina.
 *
 * Implementación real: `SystemClock` en `infrastructure/clock`.
 * Implementación de prueba: `RelojFijo` en `test/support`.
 */
export interface ClockPort {
  /** Instante actual, en UTC. La conversión a fecha civil de México la hace `FechaCivil`. */
  now(): Date;
}

/**
 * Token de inyección del puerto.
 *
 * Es un `symbol` de JavaScript puro, sin dependencia de NestJS: el contenedor de
 * inyección de infraestructura lo usará para cablear `SystemClock`, pero el
 * dominio sigue sin conocer al framework (CLAUDE.md §4.1).
 */
export const CLOCK_PORT = Symbol('ClockPort');
