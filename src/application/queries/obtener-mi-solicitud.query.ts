/**
 * Consulta del registro de solicitud del usuario para el año en curso (CU-D04).
 *
 * No lleva año: el registro es el del año vigente según el reloj (RN-06). Es una
 * **Query**: no modifica nada, ni siquiera cuando los montos que devuelve han
 * cambiado respecto a la consulta anterior porque el trabajador actualizó su
 * sueldo (RN-20) — ese cambio no se escribe en ninguna parte, se deriva.
 */
export class ObtenerMiSolicitudQuery {
  constructor(readonly solicitanteId: string) {}
}
