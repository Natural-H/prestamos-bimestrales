import { DomainError } from './domain.error';

/**
 * Un trabajador intentó capturar el monto de su préstamo (RN-08).
 *
 * Al trabajador se le da un **préstamo fijo**: el monto lo calcula el sistema a
 * partir del sueldo base vigente (16 % por bimestre, 32 % en diciembre) y el
 * usuario no lo elige. Aceptar un monto capturado —aunque coincidiera con el
 * calculado— abriría la puerta a que la API dependiera de un valor que el
 * cliente controla.
 *
 * Se mapea a `400 Bad Request` (EC-05): la petición trae un campo que no le
 * corresponde a este tipo de usuario.
 */
export class MontoNoCapturableError extends DomainError {
  constructor() {
    super(
      'MONTO_NO_CAPTURABLE',
      'El monto del préstamo del trabajador lo calcula el sistema a partir de su sueldo base; no puede capturarse.',
    );
  }
}
