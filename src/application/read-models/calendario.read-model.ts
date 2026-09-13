/**
 * Modelos de lectura del calendario de préstamos (CU-C01, CU-C03, CU-C04).
 *
 * Primitivos, como todos los modelos de lectura: los value objects no salen del
 * dominio y los montos viajan como cadena decimal exacta (RN-14).
 */

/** Estado de un periodo frente a la fecha actual (RN-04). */
export type EstadoDisponibilidad = 'DISPONIBLE' | 'BLOQUEADO';

export interface BimestreDisponibleReadModel {
  readonly clave: string;
  /** Mes de referencia en base 1: 2, 4, 6, 8 o 10 (RN-02). */
  readonly mesReferencia: number;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoDisponibilidad;
  /** Explicación del bloqueo, o `null` si está disponible. */
  readonly motivoBloqueo: string | null;
  /** `true` si el usuario ya lo tiene en su registro del año (RN-06). */
  readonly yaSolicitado: boolean;
  /**
   * Monto en pesos: el ya solicitado, o el que le correspondería al trabajador
   * (RN-08). Es `null` para el alumno, que elige el suyo (RN-09), y también para
   * el trabajador que aún no ha capturado su sueldo base.
   */
  readonly montoEnPesos: string | null;
}

/** Los cinco bimestres del año con su disponibilidad (CU-C01, CU-C04). */
export interface CalendarioDeBimestresReadModel {
  readonly anio: number;
  /** Fecha civil usada para evaluar la disponibilidad, en la zona del TECNM. */
  readonly fechaDeConsulta: string;
  /** `true` cuando ya transcurrió octubre y no queda ningún bimestre (RN-05). */
  readonly temporadaCerrada: boolean;
  readonly bimestres: readonly BimestreDisponibleReadModel[];
}

/** Disponibilidad del beneficio de diciembre (CU-C03). */
export interface DisponibilidadDiciembreReadModel {
  readonly clave: string;
  readonly anio: number;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoDisponibilidad;
  readonly motivoBloqueo: string | null;
  readonly yaSolicitado: boolean;
  /** 32 % del sueldo base vigente (RN-10), o `null` si aún no capturó el sueldo. */
  readonly montoEnPesos: string | null;
}
