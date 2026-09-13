import { SolicitudPrestamo } from '../entities/solicitud-prestamo.entity';
import { SolicitanteId } from '../value-objects/solicitante-id';

/**
 * **Puerto** de persistencia del registro de solicitud (RN-06).
 *
 * Lo define el dominio y lo implementa infraestructura con TypeORM
 * (CLAUDE.md §4.1): así la aplicación depende de esta interfaz y nunca de una
 * clase concreta (§5-D).
 *
 * ## Contrato
 *
 * - La clave del registro es **(solicitante, año)**: hay uno por usuario y año,
 *   nunca uno por bimestre.
 * - {@link guardar} debe ser **atómico** respecto al agregado completo: o se
 *   persisten todos sus periodos o ninguno (RN-18).
 * - {@link guardar} debe detectar escrituras simultáneas mediante bloqueo
 *   optimista sobre `SolicitudPrestamo.version` y lanzar
 *   `ConflictoDeConcurrenciaError` si el registro cambió entretanto (RN-15).
 *   Devolver silenciosamente en ese caso rompería el contrato y con él la
 *   garantía de "sin duplicar ni sobrescribir" del planteamiento.
 */
export interface SolicitudPrestamoRepository {
  /**
   * Registro del usuario para ese año, o `null` si aún no ha solicitado nada.
   *
   * Devolver `null` es lo normal en la primera solicitud del año: el caso de uso
   * crea entonces un registro vacío (RN-06).
   */
  buscarPorSolicitanteYAnio(
    solicitanteId: SolicitanteId,
    anio: number,
  ): Promise<SolicitudPrestamo | null>;

  /**
   * Crea o actualiza el registro completo.
   *
   * @throws {ConflictoDeConcurrenciaError} si otra operación lo modificó desde
   *   que se cargó (RN-15, EC-13).
   */
  guardar(solicitud: SolicitudPrestamo): Promise<void>;
}

/**
 * Token de inyección del puerto.
 *
 * `symbol` de JavaScript puro: el contenedor de NestJS lo usará para cablear el
 * adaptador de TypeORM, sin que el dominio importe al framework.
 */
export const SOLICITUD_PRESTAMO_REPOSITORY = Symbol('SolicitudPrestamoRepository');
