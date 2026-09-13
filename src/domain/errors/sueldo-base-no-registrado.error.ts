import { DomainError } from './domain.error';

/**
 * Un trabajador intentó operar sin haber capturado su sueldo base (RN-08, RN-13).
 *
 * El sueldo base se captura manualmente y es la **precondición dura** de todo
 * cálculo: sin él no existe el 16 % del bimestre ni el 32 % de diciembre, y el
 * sistema no puede suponer ninguno. Por eso no hay "monto por defecto": hay
 * error.
 *
 * Se mapea a `409 Conflict` (EC-06): la petición es válida, pero el estado
 * actual del trabajador no permite atenderla todavía.
 */
export class SueldoBaseNoRegistradoError extends DomainError {
  constructor() {
    super(
      'SUELDO_BASE_NO_REGISTRADO',
      'El trabajador debe capturar su sueldo base antes de solicitar un préstamo.',
    );
  }
}
