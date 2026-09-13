import { SueldoBaseNoRegistradoError } from '../errors/sueldo-base-no-registrado.error';
import { SueldoBaseSoloTrabajadoresError } from '../errors/sueldo-base-solo-trabajadores.error';
import { SueldoBaseYaRegistradoError } from '../errors/sueldo-base-ya-registrado.error';
import { PoliticaPrestamo } from '../services/politica-prestamo';
import { PoliticaPrestamoFactory } from '../services/politica-prestamo.factory';
import { SolicitanteId } from '../value-objects/solicitante-id';
import { SueldoBase } from '../value-objects/sueldo-base';
import { TipoUsuario } from '../value-objects/tipo-usuario';

/**
 * Quien solicita el préstamo: un alumno o un trabajador (RN-01).
 *
 * ## Qué guarda
 *
 * Su identidad, su **tipo inmutable** —fijado en el alta, porque determina la
 * política de préstamo y el histórico de montos— y, sólo si es trabajador, su
 * **sueldo base vigente** (RN-13).
 *
 * ## Qué no guarda
 *
 * Nada de credenciales: el hash de la contraseña y el JWT son asunto de
 * infraestructura (CLAUDE.md §9). Aquí sólo vive lo que el negocio necesita para
 * decidir cuánto le toca a quién.
 *
 * ## Su papel en el cálculo
 *
 * No calcula montos: **entrega su política** ({@link politicaPrestamo}). Así el
 * resto del sistema no vuelve a preguntar de qué tipo es nadie.
 */
export class Solicitante {
  private constructor(
    readonly id: SolicitanteId,
    /** Inmutable tras el alta (RN-01): no hay método para cambiarlo. */
    readonly tipoUsuario: TipoUsuario,
    private sueldoBaseVigente: SueldoBase | null,
  ) {}

  /** Alta de un usuario nuevo (CU-A01). Un trabajador nace sin sueldo base: lo captura después (CU-B01). */
  static registrar(id: SolicitanteId, tipoUsuario: TipoUsuario): Solicitante {
    return new Solicitante(id, tipoUsuario, null);
  }

  /** Reconstrucción desde la persistencia. */
  static reconstituir(
    id: SolicitanteId,
    tipoUsuario: TipoUsuario,
    sueldoBase: SueldoBase | null,
  ): Solicitante {
    return new Solicitante(id, tipoUsuario, sueldoBase);
  }

  get sueldoBase(): SueldoBase | null {
    return this.sueldoBaseVigente;
  }

  get tieneSueldoBase(): boolean {
    return this.sueldoBaseVigente !== null;
  }

  get esTrabajador(): boolean {
    return this.tipoUsuario === TipoUsuario.TRABAJADOR;
  }

  /**
   * Captura inicial del sueldo base (CU-B01, RN-13).
   *
   * @throws {SueldoBaseSoloTrabajadoresError} si es un alumno.
   * @throws {SueldoBaseYaRegistradoError} si ya tenía sueldo: cambiarlo es
   *   {@link actualizarSueldoBase}, que es otro caso de uso y otra intención.
   */
  capturarSueldoBase(sueldoBase: SueldoBase): void {
    this.exigirSerTrabajador();
    if (this.sueldoBaseVigente !== null) {
      throw new SueldoBaseYaRegistradoError();
    }
    this.sueldoBaseVigente = sueldoBase;
  }

  /**
   * Actualización del sueldo base (CU-B02, RN-13).
   *
   * Acepta **cualquier valor válido, al alza o a la baja**: no hay invariante de
   * monotonía. El "recálculo" de los montos no ocurre aquí ni en ninguna otra
   * parte: ocurre **por construcción**, porque el monto del trabajador se deriva
   * del sueldo vigente en cada consulta y nunca se almacena (RN-20). Cambiar
   * esta referencia ya cambia todos los montos del registro.
   *
   * @throws {SueldoBaseSoloTrabajadoresError} si es un alumno.
   * @throws {SueldoBaseNoRegistradoError} si nunca lo capturó (EC-17).
   */
  actualizarSueldoBase(sueldoBase: SueldoBase): void {
    this.exigirSerTrabajador();
    if (this.sueldoBaseVigente === null) {
      throw new SueldoBaseNoRegistradoError();
    }
    this.sueldoBaseVigente = sueldoBase;
  }

  /**
   * Política de préstamo que le corresponde (RN-08, RN-09, RN-10).
   *
   * @throws {SueldoBaseNoRegistradoError} si es trabajador y aún no capturó su
   *   sueldo base: sin él no hay monto que calcular (EC-06).
   */
  politicaPrestamo(): PoliticaPrestamo {
    return PoliticaPrestamoFactory.crear(this.tipoUsuario, this.sueldoBaseVigente);
  }

  /**
   * La política si puede determinarse, o `null` si todavía no.
   *
   * Sólo hay un caso en que no puede: un **trabajador que aún no capturó su
   * sueldo base** (RN-08, RN-13). Las consultas de calendario lo necesitan
   * porque ese usuario tiene derecho a ver los bimestres disponibles aunque
   * todavía no se le pueda calcular ningún monto; las de escritura usan
   * {@link politicaPrestamo}, que falla, porque sin sueldo no hay préstamo que
   * registrar (EC-06).
   *
   * Vive aquí y no en la capa de aplicación porque "cuándo hay política" es
   * conocimiento del negocio, no de la orquestación.
   */
  politicaPrestamoSiEstaDefinida(): PoliticaPrestamo | null {
    if (this.esTrabajador && !this.tieneSueldoBase) {
      return null;
    }
    return this.politicaPrestamo();
  }

  private exigirSerTrabajador(): void {
    if (!this.esTrabajador) {
      throw new SueldoBaseSoloTrabajadoresError();
    }
  }
}
