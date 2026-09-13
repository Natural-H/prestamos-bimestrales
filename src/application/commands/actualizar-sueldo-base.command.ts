/**
 * Comando de **actualización** del sueldo base, con recálculo de montos
 * (CU-B02, RN-13).
 *
 * Admite cualquier valor válido, al alza o a la baja: no hay invariante de
 * monotonía.
 */
export class ActualizarSueldoBaseCommand {
  constructor(
    /** Identificador del trabajador, tomado del JWT por la capa de presentación. */
    readonly solicitanteId: string,
    /** Nuevo sueldo base en pesos, como cadena decimal exacta. */
    readonly sueldoBaseEnPesos: string,
  ) {}
}
