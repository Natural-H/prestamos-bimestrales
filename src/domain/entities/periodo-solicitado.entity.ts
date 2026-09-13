import { PoliticaPrestamo } from '../services/politica-prestamo';
import { EstadoEntrega, estadoDeEntrega } from '../value-objects/estado-entrega';
import { FechaCivil } from '../value-objects/fecha-civil';
import { Monto } from '../value-objects/monto';
import { PeriodoSolicitable } from '../value-objects/periodo-solicitable';

/**
 * Un periodo que el usuario ya solicitó, dentro de su registro del año.
 *
 * ## Qué se guarda y qué no
 *
 * Guarda **qué** periodo se solicitó y **cuándo**, pero el monto sólo si el
 * usuario lo capturó —es decir, sólo para el alumno (RN-09)—. El del trabajador
 * **no se almacena**: se deriva del sueldo vigente en cada consulta (RN-20), que
 * es lo que hace que "el monto flota con el sueldo" se cumpla por construcción y
 * que actualizar el sueldo no tenga que reescribir ninguna fila.
 *
 * Por eso {@link montoVigente} necesita recibir la política: sin ella, este
 * objeto no sabe —ni debe saber— cuánto vale.
 */
export class PeriodoSolicitado {
  constructor(
    /** Periodo solicitado: un bimestre (RN-02) o el beneficio de diciembre (RN-11). */
    readonly periodo: PeriodoSolicitable,
    /** Monto elegido por el usuario, o `null` si su política lo calcula (RN-20). */
    readonly montoCapturado: Monto | null,
    /** Día en que se solicitó, en la zona horaria del TECNM. */
    readonly fechaSolicitud: FechaCivil,
  ) {}

  /** Clave del periodo dentro del registro (`'2026-02'`). */
  get clave(): string {
    return this.periodo.clave;
  }

  /**
   * Monto que vale hoy este periodo, según la política del solicitante.
   *
   * Para el alumno devuelve lo que capturó; para el trabajador, el 16 % (o el
   * 32 % en diciembre) del sueldo **vigente** (RN-08, RN-10, RN-13).
   */
  montoVigente(politica: PoliticaPrestamo): Monto {
    return this.periodo.montoSegun(politica, this.montoCapturado);
  }

  /** Estado de entrega derivado de la fecha (RN-07). */
  estadoDeEntrega(hoy: FechaCivil): EstadoEntrega {
    return estadoDeEntrega(this.periodo.periodo, hoy);
  }

  /**
   * `true` si una nueva solicitud de este mismo periodo trae exactamente los
   * mismos datos y, por tanto, es un **no-op idempotente** (RN-18).
   *
   * Para el trabajador siempre lo es: su monto no se captura, así que ambos
   * lados son `null`. Para el alumno, sólo si el monto coincide al centavo.
   */
  tieneLosMismosDatosQue(montoCapturado: Monto | null): boolean {
    if (this.montoCapturado === null || montoCapturado === null) {
      return this.montoCapturado === montoCapturado;
    }
    return this.montoCapturado.equals(montoCapturado);
  }
}
