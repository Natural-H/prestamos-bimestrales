import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdGeneratorPort } from '../../application/ports/id-generator.port';

/**
 * Adaptador del {@link IdGeneratorPort}: UUID v4 de `node:crypto`.
 *
 * De la biblioteca estándar, sin dependencias y compatible con CommonJS
 * (CLAUDE.md §7.2): `nanoid` moderno es ESM-only y está descartado por eso.
 *
 * Que el identificador lo genere la aplicación —y no una secuencia de la base—
 * es lo que permite construir el agregado entero antes de tocar la persistencia
 * (CLAUDE.md §2.3).
 */
@Injectable()
export class UuidGeneratorAdapter implements IdGeneratorPort {
  generar(): string {
    return randomUUID();
  }
}
