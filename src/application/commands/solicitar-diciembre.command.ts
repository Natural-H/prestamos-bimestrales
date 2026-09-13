/**
 * Comando de "Solicitar" el beneficio de diciembre (CU-D03).
 *
 * No lleva monto: el de diciembre es siempre el 32 % del sueldo base vigente y
 * lo calcula el sistema (RN-10). Tampoco lleva año, por lo mismo que el comando
 * de bimestres: es el del año en curso según el reloj.
 *
 * Que sea un comando aparte —y no un bimestre más— no es una duplicación: es que
 * diciembre **no es un bimestre** (RN-11), tiene su propio plazo hasta el 31 de
 * diciembre y es exclusivo de trabajadores (RN-12).
 */
export class SolicitarDiciembreCommand {
  constructor(
    /** Identificador del solicitante, tomado del JWT por la capa de presentación. */
    readonly solicitanteId: string,
  ) {}
}
