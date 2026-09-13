/**
 * Consulta del desglose periodo a periodo del registro del año (CU-D05).
 *
 * Es la sub-colección de periodos del registro que devuelve CU-D04, sin el
 * envoltorio ni el total: útil cuando el cliente sólo quiere la lista y no el
 * agregado.
 */
export class ListarPeriodosSolicitadosQuery {
  constructor(readonly solicitanteId: string) {}
}
