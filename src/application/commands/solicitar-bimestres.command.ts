/**
 * Un bimestre pedido dentro del comando.
 *
 * Sólo primitivos: el comando cruza la frontera de presentación, así que no
 * transporta value objects del dominio. Convertirlos es tarea del handler, que
 * es quien puede lanzar los errores de dominio correspondientes.
 */
export interface BimestreSolicitadoEnComando {
  /** Mes de referencia del bimestre, en base 1: 2, 4, 6, 8 o 10 (RN-02). */
  readonly mesReferencia: number;
  /**
   * Monto elegido, como cadena decimal en pesos (`'3500.00'`), o `null`.
   *
   * El **alumno** debe indicarlo (RN-09); el **trabajador** debe dejarlo en
   * `null`, porque su monto lo calcula el sistema (RN-08). No es opcional a
   * propósito: obliga a presentación a declarar si hubo captura, que es
   * justamente lo que distingue a las dos políticas.
   */
  readonly montoEnPesos: string | null;
}

/**
 * Comando de "Solicitar" uno o más bimestres (CU-D01 y CU-D02).
 *
 * Un mismo comando sirve para alumno y trabajador: la diferencia de
 * comportamiento no vive aquí, vive en la política del solicitante (RN-08,
 * RN-09). Meter dos comandos distintos habría duplicado el flujo entero para
 * variar una sola decisión.
 *
 * El **año no viaja en el comando**: el registro es el del año en curso (RN-06),
 * y "en curso" lo determina el reloj del sistema en la zona del TECNM, no el
 * cliente.
 */
export class SolicitarBimestresCommand {
  constructor(
    /** Identificador del solicitante, tomado del JWT por la capa de presentación. */
    readonly solicitanteId: string,
    readonly bimestres: readonly BimestreSolicitadoEnComando[],
  ) {}
}
