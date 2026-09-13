import { DomainError } from './domain.error';

/**
 * Se intentó agregar a la solicitud un periodo que no pertenece a su año (RN-06).
 *
 * El registro es **único por usuario y año**: mezclar en él periodos de otro año
 * rompería esa unidad y, con ella, la clave que protege de solicitudes
 * simultáneas (RN-15). Cada año tiene su propio registro.
 *
 * Se mapea a `400 Bad Request`.
 */
export class PeriodoDeOtroAnioError extends DomainError {
  constructor(clave: string, anioDelRegistro: number) {
    super(
      'PERIODO_DE_OTRO_ANIO',
      `El periodo ${clave} no pertenece al registro de ${anioDelRegistro}.`,
    );
  }
}
