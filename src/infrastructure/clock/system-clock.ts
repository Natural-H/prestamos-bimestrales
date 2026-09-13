import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../domain/ports/clock.port';

/**
 * Implementación real del {@link ClockPort}: el reloj del sistema.
 *
 * Es la **única** clase de todo el proyecto que llama a `new Date()` sin
 * argumentos. El dominio recibe siempre el instante por el puerto, que es lo que
 * permite probar el bloqueo de bimestres en cualquier fecha sin tocar el reloj
 * de la máquina (CLAUDE.md §7.5).
 *
 * Devuelve el instante en UTC; convertirlo al día civil de México es tarea de
 * `FechaCivil`, que sabe de zonas horarias y vive en el dominio.
 */
@Injectable()
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
