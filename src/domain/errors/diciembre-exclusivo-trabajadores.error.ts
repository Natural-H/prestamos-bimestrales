import { DomainError } from './domain.error';

/**
 * Un alumno intentó acceder al beneficio de diciembre (RN-12).
 *
 * Diciembre es un periodo **exclusivo de trabajadores**, pagado con el
 * aguinaldo (RN-10); los alumnos no reciben nada en diciembre. La restricción se
 * comprueba **en el dominio** y no sólo en el `RolesGuard`: el guard protege la
 * ruta, pero la regla de quién tiene derecho a qué periodo es del negocio.
 *
 * Se mapea a `403 Forbidden` (EC-07).
 */
export class DiciembreExclusivoTrabajadoresError extends DomainError {
  constructor() {
    super(
      'DICIEMBRE_EXCLUSIVO_TRABAJADORES',
      'El beneficio de diciembre es exclusivo de los trabajadores.',
    );
  }
}
