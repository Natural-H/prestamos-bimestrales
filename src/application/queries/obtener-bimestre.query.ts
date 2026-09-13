/**
 * Consulta de la disponibilidad de un bimestre concreto del año en curso
 * (CU-C02).
 *
 * El año no viaja en la consulta: es el del calendario vigente (RN-06).
 */
export class ObtenerBimestreQuery {
  constructor(
    readonly solicitanteId: string,
    /** Mes de referencia en base 1; sólo 2, 4, 6, 8 y 10 son bimestres (RN-02). */
    readonly mesReferencia: number,
  ) {}
}
