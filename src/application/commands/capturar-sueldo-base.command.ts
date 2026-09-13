/**
 * Comando de **captura inicial** del sueldo base del trabajador (CU-B01).
 *
 * Es el alta, no el cambio: actualizarlo es otro caso de uso con otra intención
 * (CU-B02). Separarlos evita que un alta repetida por error altere en silencio
 * los montos de todo el registro.
 */
export class CapturarSueldoBaseCommand {
  constructor(
    /** Identificador del trabajador, tomado del JWT por la capa de presentación. */
    readonly solicitanteId: string,
    /** Sueldo base en pesos, como cadena decimal exacta (`'12345.67'`). */
    readonly sueldoBaseEnPesos: string,
  ) {}
}
