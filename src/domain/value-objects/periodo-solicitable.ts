import { PoliticaPrestamo } from '../services/politica-prestamo';
import { FechaCivil } from './fecha-civil';
import { Monto } from './monto';
import { Periodo } from './periodo';

/**
 * Periodo del año sobre el que se puede solicitar un préstamo.
 *
 * Tiene exactamente dos implementaciones, y son deliberadamente distintas:
 * `Bimestre` (los cinco de febrero a octubre, RN-02) y `PeriodoDiciembre` (el
 * beneficio exclusivo de trabajadores, que **no es un bimestre**, RN-11).
 *
 * ## Por qué una interfaz común
 *
 * El registro del usuario acumula ambos tipos de periodo en una sola lista
 * (RN-06), y las consultas de solicitud, montos y entrega los tratan igual. Sin
 * esta abstracción, el agregado tendría que preguntar "¿esto es diciembre?" en
 * cada operación; con ella, cada periodo sabe responder por sí mismo:
 *
 * - **cuándo se bloquea**, que no es lo mismo para un bimestre (RN-04, RN-05)
 *   que para diciembre (RN-11);
 * - **cómo se calcula su monto**, que depende del periodo además del tipo de
 *   usuario: 16 % en un bimestre, 32 % en diciembre (RN-08, RN-10).
 *
 * Así, añadir un periodo nuevo no obliga a tocar el agregado (Abierto/Cerrado).
 */
export enum TipoPeriodo {
  BIMESTRE = 'bimestre',
  DICIEMBRE = 'diciembre',
}

export interface PeriodoSolicitable {
  /**
   * Qué clase de periodo es.
   *
   * Es **metadato descriptivo** para los modelos de lectura de la API, no un
   * discriminador para ramificar lógica: el comportamiento que difiere entre
   * bimestre y diciembre lo resuelve el polimorfismo de esta misma interfaz.
   */
  readonly tipo: TipoPeriodo;

  /** Año al que pertenece. El registro del usuario es por usuario **y año** (RN-06). */
  readonly anio: number;

  /** Clave estable del periodo dentro del año (`'2026-02'`, `'2026-12'`). Base de la unicidad (RN-06, RN-15). */
  readonly clave: string;

  /** Rango de días que abarca (§2.1 del planteamiento). */
  readonly periodo: Periodo;

  /** `true` si su periodo ya transcurrió y por tanto no puede solicitarse. */
  estaBloqueado(hoy: FechaCivil): boolean;

  /** Inverso de {@link estaBloqueado}. */
  estaDisponible(hoy: FechaCivil): boolean;

  /**
   * Comprueba que el periodo pueda solicitarse en esa fecha y, si no, lanza el
   * error de dominio **específico** de su situación: no es lo mismo un bimestre
   * vencido, una temporada cerrada o un diciembre fuera de plazo, y quien llama
   * a la API merece saber cuál de las tres le ocurrió.
   *
   * @throws {DomainError} si el periodo está bloqueado.
   */
  validarQuePuedeSolicitarse(hoy: FechaCivil): void;

  /**
   * Monto que corresponde a este periodo según la política del solicitante.
   *
   * Es el punto donde se cruzan las dos dimensiones del cálculo —el tipo de
   * usuario y el tipo de periodo— sin que ninguna de las dos necesite conocer a
   * la otra con un `if`.
   *
   * @param montoCapturado Monto elegido por el usuario, o `null` si su política
   *   es la de préstamo calculado.
   * @throws {DomainError} si la combinación no está permitida; por ejemplo, un
   *   alumno pidiendo diciembre (RN-12).
   */
  montoSegun(politica: PoliticaPrestamo, montoCapturado: Monto | null): Monto;
}
