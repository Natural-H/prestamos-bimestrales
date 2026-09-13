import { DomainError } from './domain.error';

/**
 * Un alumno intentó capturar o actualizar un sueldo base (RN-01, RN-13).
 *
 * El sueldo base sólo existe en el modelo del trabajador: es la base del 16 % y
 * del 32 %. Un alumno elige su monto (RN-09), así que un sueldo no significaría
 * nada para él. Igual que con diciembre, la regla se comprueba **en el dominio**
 * y no sólo en el `RolesGuard`.
 *
 * Se mapea a `403 Forbidden`.
 */
export class SueldoBaseSoloTrabajadoresError extends DomainError {
  constructor() {
    super('SUELDO_BASE_SOLO_TRABAJADORES', 'Sólo los trabajadores tienen sueldo base.');
  }
}
