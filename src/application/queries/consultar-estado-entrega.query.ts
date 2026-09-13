/**
 * Consulta del estado de entrega de los periodos solicitados (CU-E01).
 *
 * La entrega es **estado derivado de la fecha** (RN-07): no existe proceso ni
 * endpoint de desembolso (RN-16), así que esto es una lectura pura del
 * calendario contra el registro.
 */
export class ConsultarEstadoEntregaQuery {
  constructor(readonly solicitanteId: string) {}
}
