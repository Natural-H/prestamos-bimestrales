/**
 * Contratos mínimos de CQRS para la capa de aplicación.
 *
 * ## Por qué un bus propio y no `@nestjs/cqrs` (todavía)
 *
 * CLAUDE.md §3 admite ambas opciones. Se eligen estas interfaces —dos firmas,
 * cero dependencias— para que la capa de aplicación quede **libre de framework**
 * y se pueda probar instanciando el handler con dobles, sin módulos de prueba ni
 * contenedor. Cuando llegue la capa de infraestructura se decidirá si los
 * handlers se envuelven con los decoradores de `@nestjs/cqrs` o si se registra
 * un bus ligero propio: en ambos casos el cuerpo de los handlers no cambia.
 */

/** Caso de uso que **modifica** estado. */
export interface CommandHandler<TCommand, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}

/** Caso de uso de **solo lectura**: no modifica nada. */
export interface QueryHandler<TQuery, TResult> {
  execute(query: TQuery): Promise<TResult>;
}
