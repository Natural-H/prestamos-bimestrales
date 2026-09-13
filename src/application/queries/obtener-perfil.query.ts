/**
 * Consulta del perfil del usuario autenticado (CU-A03).
 *
 * Permite al cliente saber qué operaciones tiene disponibles sin adivinarlas:
 * su tipo de usuario y, si es trabajador, si ya capturó su sueldo base.
 */
export class ObtenerPerfilQuery {
  constructor(readonly solicitanteId: string) {}
}
