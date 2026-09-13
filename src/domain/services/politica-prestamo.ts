import { Monto } from '../value-objects/monto';
import { TipoUsuario } from '../value-objects/tipo-usuario';

/**
 * Política de préstamo: **cómo se determina el monto** y **a qué periodos se
 * tiene derecho**, según el tipo de usuario.
 *
 * ## Por qué es una estrategia y no un `if`
 *
 * El planteamiento describe dos comportamientos genuinamente distintos (RN-08,
 * RN-09):
 *
 * - Al **trabajador** se le da un *préstamo fijo*: el sistema lo **calcula**
 *   desde el sueldo base y el usuario no lo captura.
 * - Al **alumno** se le da un *rango con tope*: el usuario lo **elige** y el
 *   sistema lo **valida**.
 *
 * No es la misma operación con un parámetro distinto: cambia quién decide. Si
 * mañana aparece un tercer tipo de usuario o un esquema nuevo, se añade una
 * implementación de esta interfaz sin tocar las existentes ni el caso de uso que
 * las consume (principio Abierto/Cerrado, CLAUDE.md §5-O).
 *
 * Las implementaciones son **inmutables y sin estado persistente**: el monto del
 * trabajador se deriva del sueldo vigente en cada consulta, nunca se almacena
 * (RN-20).
 */
export interface PoliticaPrestamo {
  /** Tipo de usuario al que aplica esta política. */
  readonly tipoUsuario: TipoUsuario;

  /**
   * Monto del préstamo de **un** bimestre (RN-08, RN-09).
   *
   * @param montoSolicitado Lo que capturó el usuario, o `null` si no capturó
   *   nada. El parámetro es explícito —y no opcional— para obligar a cada caso
   *   de uso a declarar si hubo captura: es justamente el dato sobre el que cada
   *   política decide de forma opuesta.
   * @returns El monto que se registrará para ese bimestre.
   * @throws {DomainError} si la captura no encaja con la política: el alumno que
   *   no manda monto o se sale del rango, el trabajador que sí lo manda.
   */
  montoParaBimestre(montoSolicitado: Monto | null): Monto;

  /**
   * Monto que **tendría** un bimestre si se solicitara ahora mismo, o `null` si
   * esta política no lo determina porque lo elige el usuario.
   *
   * Existe para la consulta de disponibilidad (CU-C01/CU-C02), que necesita
   * informar al trabajador de cuánto le tocaría sin llegar a solicitar nada. Es
   * polimórfica a propósito: la alternativa era que la capa de aplicación
   * preguntara "¿es alumno?" antes de calcular, justo el `if` que las
   * estrategias existen para evitar.
   */
  montoPrevistoParaBimestre(): Monto | null;

  /**
   * `true` si este tipo de usuario tiene derecho al beneficio de diciembre
   * (RN-10, RN-12). Sólo lo tienen los trabajadores.
   */
  tieneDerechoADiciembre(): boolean;

  /**
   * Monto del beneficio de diciembre (RN-10).
   *
   * Precondición: {@link tieneDerechoADiciembre} devuelve `true`. Las
   * implementaciones que no lo tienen lanzan igualmente el error de dominio
   * correspondiente en lugar de devolver un valor falso: la comprobación previa
   * es una cortesía para el caso de uso, no la única defensa.
   *
   * @throws {DiciembreExclusivoTrabajadoresError} si el tipo de usuario no tiene derecho.
   */
  montoParaDiciembre(): Monto;
}
