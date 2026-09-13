import { PeriodoDeOtroAnioError } from '../errors/periodo-de-otro-anio.error';
import { PeriodoYaSolicitadoConOtroMontoError } from '../errors/periodo-ya-solicitado-con-otro-monto.error';
import { PoliticaPrestamo } from '../services/politica-prestamo';
import { EstadoEntrega } from '../value-objects/estado-entrega';
import { FechaCivil } from '../value-objects/fecha-civil';
import { Monto } from '../value-objects/monto';
import { PeriodoSolicitable } from '../value-objects/periodo-solicitable';
import { SolicitanteId } from '../value-objects/solicitante-id';
import { PeriodoSolicitado } from './periodo-solicitado.entity';

/**
 * Un periodo que se quiere agregar al registro, con el monto que el usuario
 * capturó (o `null` si su política lo calcula).
 */
export interface SolicitudDePeriodo {
  readonly periodo: PeriodoSolicitable;
  readonly montoCapturado: Monto | null;
}

/**
 * Resultado de "Solicitar", pensado para que el caso de uso pueda responder con
 * precisión: qué se agregó de verdad y qué ya estaba igual (RN-18).
 */
export interface ResultadoDeSolicitud {
  /** Claves de los periodos que se incorporaron al registro. */
  readonly agregados: readonly string[];
  /** Claves de los periodos que ya estaban con los mismos datos: no-op idempotente. */
  readonly sinCambios: readonly string[];
}

/**
 * **Raíz del agregado**: el registro único de solicitud de un usuario para un año.
 *
 * ## Un registro por usuario y año, que acumula
 *
 * No hay un registro por bimestre: hay **uno solo por usuario y año** (RN-06)
 * que va acumulando los periodos que se solicitan. "Solicitar" **agrega, nunca
 * reemplaza**, y al cambiar de año se abre un registro nuevo.
 *
 * ## Idempotente y atómico (RN-18)
 *
 * {@link agregar} valida **todo el lote antes de tocar nada**:
 *
 * - si algún periodo del request choca —bloqueado, fuera de rango, conflicto de
 *   monto—, se rechaza el request **completo** y el registro queda intacto;
 * - repetir un periodo con los mismos datos no duplica ni falla: es un no-op y
 *   se informa como tal;
 * - repetir un periodo del alumno con **otro monto** es conflicto, porque
 *   modificar por la vía de "agregar" sería una actualización encubierta.
 *
 * ## Qué NO hace este agregado
 *
 * - **No decide montos.** Eso es de la política del solicitante, que recibe como
 *   parámetro (RN-08, RN-09, RN-10). El agregado tampoco sabe si quien solicita
 *   es alumno o trabajador: lo sabe la política, y así no hay dos fuentes de
 *   verdad sobre el tipo de usuario.
 * - **No almacena el monto del trabajador.** Lo deriva en cada consulta del
 *   sueldo vigente (RN-20).
 * - **No lee el reloj.** La fecha actual entra como `FechaCivil`, calculada por
 *   el caso de uso desde `ClockPort` (CLAUDE.md §7.5).
 */
export class SolicitudPrestamo {
  private constructor(
    readonly solicitanteId: SolicitanteId,
    readonly anio: number,
    /** Periodos solicitados, indexados por su clave para garantizar unicidad (RN-06). */
    private readonly periodos: Map<string, PeriodoSolicitado>,
    /**
     * Versión para el bloqueo optimista del repositorio (RN-15, TR-04).
     *
     * El dominio sólo la transporta; quien la incrementa y la comprueba al
     * guardar es el adaptador de persistencia.
     */
    readonly version: number,
  ) {}

  /** Registro nuevo y vacío, el que se crea al vuelo en la primera solicitud del año (RN-06). */
  static crearVacia(solicitanteId: SolicitanteId, anio: number): SolicitudPrestamo {
    return new SolicitudPrestamo(solicitanteId, anio, new Map(), 0);
  }

  /**
   * Reconstruye el agregado desde la persistencia.
   *
   * Lo usa el mapper del repositorio; no valida reglas de calendario porque lo
   * ya guardado se solicitó cuando era válido: un bimestre vencido sigue
   * figurando en el registro, sólo que ya no puede solicitarse otra vez.
   */
  static reconstituir(
    solicitanteId: SolicitanteId,
    anio: number,
    periodos: readonly PeriodoSolicitado[],
    version: number,
  ): SolicitudPrestamo {
    const indexados = new Map(periodos.map((p) => [p.clave, p]));
    return new SolicitudPrestamo(solicitanteId, anio, indexados, version);
  }

  /** Periodos solicitados, en orden cronológico por su clave. */
  get periodosSolicitados(): PeriodoSolicitado[] {
    return [...this.periodos.values()].sort((a, b) => a.clave.localeCompare(b.clave));
  }

  /** `true` si el usuario todavía no ha solicitado nada este año. */
  get estaVacia(): boolean {
    return this.periodos.size === 0;
  }

  /** `true` si el periodo ya figura en el registro. */
  tieneSolicitado(periodo: PeriodoSolicitable): boolean {
    return this.periodos.has(periodo.clave);
  }

  /**
   * Agrega periodos al registro: la operación "Solicitar" (RN-06, RN-18).
   *
   * @param solicitudes Periodos pedidos, con el monto capturado cuando aplique.
   * @param politica Política del solicitante; es quien determina o valida el monto.
   * @param hoy Fecha civil actual, derivada de `ClockPort`.
   * @returns Qué se agregó y qué ya estaba igual.
   *
   * @throws {PeriodoDeOtroAnioError} si algún periodo no pertenece a este registro (RN-06).
   * @throws {BimestreBloqueadoError} si un bimestre ya transcurrió (RN-04, EC-01).
   * @throws {PeriodoSolicitudCerradoError} si la temporada del año ya cerró (RN-05, EC-02).
   * @throws {PeriodoDiciembreCerradoError} si diciembre ya pasó de plazo (RN-11, EC-08).
   * @throws {DiciembreExclusivoTrabajadoresError} si un alumno pide diciembre (RN-12, EC-07).
   * @throws {MontoRequeridoError | MontoMenorAlMinimoError | MontoExcedeLimiteError} según
   *   incumpla el rango del alumno (RN-09).
   * @throws {MontoNoCapturableError} si un trabajador captura monto (RN-08, EC-05).
   * @throws {PeriodoYaSolicitadoConOtroMontoError} si se repite un periodo del alumno con
   *   otro monto (RN-18, EC-11).
   */
  agregar(
    solicitudes: readonly SolicitudDePeriodo[],
    politica: PoliticaPrestamo,
    hoy: FechaCivil,
  ): ResultadoDeSolicitud {
    /*
     * Fase 1 — validar el lote entero sin mutar nada.
     *
     * La atomicidad de RN-18 se consigue aquí: cualquier excepción sale del
     * método con el registro exactamente como estaba, sin necesidad de deshacer
     * nada ni de depender de la transacción de la base de datos para la
     * coherencia del agregado.
     */
    const aAgregar = new Map<string, PeriodoSolicitado>();
    const sinCambios: string[] = [];

    for (const { periodo, montoCapturado } of solicitudes) {
      if (periodo.anio !== this.anio) {
        throw new PeriodoDeOtroAnioError(periodo.clave, this.anio);
      }

      /*
       * El monto se valida SIEMPRE y lo primero, incluso si el periodo ya estaba
       * solicitado: que un trabajador capture monto (RN-08) o que un alumno se
       * salga del rango (RN-09) es un defecto de la petición, y merece su error
       * específico antes que cualquier diagnóstico sobre repeticiones.
       */
      periodo.montoSegun(politica, montoCapturado);

      const yaSolicitado = this.periodos.get(periodo.clave) ?? aAgregar.get(periodo.clave);
      if (yaSolicitado !== undefined) {
        /*
         * Repetición: o es idéntica —y entonces no pasa nada, RN-18— o es un
         * intento de cambiar el monto por la puerta de atrás, que sí es
         * conflicto. Se comprueba antes que el calendario a propósito: volver a
         * mandar un periodo ya registrado no debe empezar a fallar sólo porque
         * entretanto se haya vencido.
         */
        if (!yaSolicitado.tieneLosMismosDatosQue(montoCapturado)) {
          throw new PeriodoYaSolicitadoConOtroMontoError(
            periodo.clave,
            yaSolicitado.montoCapturado?.aCadena() ?? yaSolicitado.montoVigente(politica).aCadena(),
            montoCapturado?.aCadena() ?? 'calculado por el sistema',
          );
        }
        sinCambios.push(periodo.clave);
        continue;
      }

      // Sólo un periodo nuevo tiene que seguir disponible hoy (RN-04, RN-05, RN-11).
      periodo.validarQuePuedeSolicitarse(hoy);

      aAgregar.set(periodo.clave, new PeriodoSolicitado(periodo, montoCapturado, hoy));
    }

    // Fase 2 — aplicar. Ya no puede fallar nada.
    for (const [clave, periodoSolicitado] of aAgregar) {
      this.periodos.set(clave, periodoSolicitado);
    }

    return { agregados: [...aAgregar.keys()], sinCambios };
  }

  /**
   * Monto que vale hoy un periodo del registro.
   *
   * @returns `null` si el periodo no está solicitado.
   */
  montoVigenteDe(periodo: PeriodoSolicitable, politica: PoliticaPrestamo): Monto | null {
    return this.periodos.get(periodo.clave)?.montoVigente(politica) ?? null;
  }

  /**
   * Suma de los montos vigentes de todo el registro (CU-D04).
   *
   * Para un trabajador este total **cambia** si su sueldo cambia, incluso para
   * periodos ya transcurridos: es la consecuencia aceptada de que el monto flote
   * y de que no exista historial (RN-13, RN-20).
   */
  montoTotalVigente(politica: PoliticaPrestamo): Monto {
    return this.periodosSolicitados.reduce(
      (total, periodoSolicitado) => total.sumar(periodoSolicitado.montoVigente(politica)),
      Monto.CERO,
    );
  }

  /**
   * Estado de entrega de un periodo solicitado, derivado de la fecha (RN-07).
   *
   * @returns `null` si el periodo no está solicitado.
   */
  estadoDeEntregaDe(periodo: PeriodoSolicitable, hoy: FechaCivil): EstadoEntrega | null {
    return this.periodos.get(periodo.clave)?.estadoDeEntrega(hoy) ?? null;
  }
}
