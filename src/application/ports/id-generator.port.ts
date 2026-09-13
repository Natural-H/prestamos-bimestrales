/**
 * **Puerto** de generación de identificadores.
 *
 * El dominio no genera ids ni los espera de una secuencia de la base de datos
 * (CLAUDE.md §2.3). Que sean UUID v4, ULID o cualquier otra cosa lo decide el
 * adaptador de infraestructura.
 */
export interface IdGeneratorPort {
  generar(): string;
}

export const ID_GENERATOR_PORT = Symbol('IdGeneratorPort');
