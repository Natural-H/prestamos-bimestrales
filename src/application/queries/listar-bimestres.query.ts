/**
 * Consulta de los bimestres del año en curso con su disponibilidad (CU-C01).
 *
 * No lleva año: se consulta el calendario del año vigente según el reloj del
 * sistema en la zona del TECNM (RN-06).
 */
export class ListarBimestresQuery {
  constructor(readonly solicitanteId: string) {}
}
