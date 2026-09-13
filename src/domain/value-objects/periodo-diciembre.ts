import { PeriodoDiciembreCerradoError } from '../errors/periodo-diciembre-cerrado.error';
import { FechaInvalidaError } from '../errors/fecha-invalida.error';
import { PoliticaPrestamo } from '../services/politica-prestamo';
import { FechaCivil } from './fecha-civil';
import { Monto } from './monto';
import { Periodo } from './periodo';
import { PeriodoSolicitable, TipoPeriodo } from './periodo-solicitable';

/**
 * Beneficio de diciembre: periodo exclusivo de trabajadores, pagado con el
 * aguinaldo (RN-10, RN-11).
 *
 * ## No es un bimestre, y eso tiene tres consecuencias
 *
 * 1. **No está en la lista de febrero a octubre** (RN-02), así que pedirlo como
 *    bimestre es `BimestreInexistenteError`.
 * 2. **No le afecta el cierre de temporada** de octubre (RN-11): el 1 de
 *    noviembre no queda ningún bimestre disponible y diciembre sigue abierto.
 * 3. **Su plazo propio** va del 1 al 31 de diciembre; a partir del 1 de enero se
 *    bloquea como cualquier periodo transcurrido.
 *
 * Su monto es el 32 % del sueldo base vigente, el único del año a ese
 * porcentaje (RN-10), y los alumnos no reciben nada (RN-12) — ambas cosas las
 * resuelve la política del solicitante, no este value object.
 */
export class PeriodoDiciembre implements PeriodoSolicitable {
  /** Mes de diciembre en base 1. */
  private static readonly MES = 12;

  readonly tipo = TipoPeriodo.DICIEMBRE;

  private constructor(readonly anio: number) {}

  /**
   * @throws {FechaInvalidaError} si el año no es un entero.
   */
  static delAnio(anio: number): PeriodoDiciembre {
    if (!Number.isInteger(anio)) {
      throw new FechaInvalidaError(`el año ${anio} no es un entero`);
    }
    return new PeriodoDiciembre(anio);
  }

  /** Del 1 al 31 de diciembre. */
  get periodo(): Periodo {
    return Periodo.entre(
      FechaCivil.de(this.anio, PeriodoDiciembre.MES, 1),
      FechaCivil.de(
        this.anio,
        PeriodoDiciembre.MES,
        FechaCivil.ultimoDiaDelMes(this.anio, PeriodoDiciembre.MES),
      ),
    );
  }

  /** Clave estable del periodo (`'2026-12'`), homogénea con la de los bimestres. */
  get clave(): string {
    return `${this.anio}-${String(PeriodoDiciembre.MES).padStart(2, '0')}`;
  }

  /** Se bloquea el 1 de enero siguiente: es solicitable hasta el 31 de diciembre (RN-11). */
  estaBloqueado(hoy: FechaCivil): boolean {
    return this.periodo.haTranscurrido(hoy);
  }

  estaDisponible(hoy: FechaCivil): boolean {
    return !this.estaBloqueado(hoy);
  }

  /** @throws {PeriodoDiciembreCerradoError} si ya pasó el 31 de diciembre (EC-08). */
  validarQuePuedeSolicitarse(hoy: FechaCivil): void {
    if (this.estaBloqueado(hoy)) {
      throw new PeriodoDiciembreCerradoError(this.anio);
    }
  }

  /**
   * Delega en la política: 32 % del sueldo base vigente para el trabajador
   * (RN-10), error para el alumno (RN-12).
   *
   * Ignora `montoCapturado` porque en diciembre nadie captura monto: es un
   * beneficio calculado por definición.
   */
  montoSegun(politica: PoliticaPrestamo): Monto {
    return politica.montoParaDiciembre();
  }

  equals(otro: PeriodoDiciembre): boolean {
    return this.anio === otro.anio;
  }

  toString(): string {
    return this.clave;
  }
}
