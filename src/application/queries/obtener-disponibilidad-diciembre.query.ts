/**
 * Consulta de la disponibilidad del beneficio de diciembre (CU-C03).
 *
 * Sólo tiene sentido para trabajadores (RN-12); el `RolesGuard` filtra la ruta y
 * la política vuelve a comprobarlo en el dominio.
 */
export class ObtenerDisponibilidadDiciembreQuery {
  constructor(readonly solicitanteId: string) {}
}
