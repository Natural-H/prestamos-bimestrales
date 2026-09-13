import { BimestreBloqueadoError } from '../errors/bimestre-bloqueado.error';
import { BimestreInexistenteError } from '../errors/bimestre-inexistente.error';
import { FechaInvalidaError } from '../errors/fecha-invalida.error';
import { PeriodoSolicitudCerradoError } from '../errors/periodo-solicitud-cerrado.error';
import { PoliticaPrestamo } from '../services/politica-prestamo';
import { FechaCivil } from './fecha-civil';
import { Monto } from './monto';
import { Periodo } from './periodo';
import { PeriodoSolicitable, TipoPeriodo } from './periodo-solicitable';

/**
 * Meses de referencia de los cinco bimestres del año (RN-02).
 *
 * El valor numérico es el mes en base 1, para que `MesReferencia.FEBRERO === 2`
 * coincida con lo que viaja por la API y con `FechaCivil.mes`.
 */
export enum MesReferencia {
  FEBRERO = 2,
  ABRIL = 4,
  JUNIO = 6,
  AGOSTO = 8,
  OCTUBRE = 10,
}

/**
 * Bimestre del calendario de préstamos del TECNM.
 *
 * ## El mes de referencia es el mes FINAL del periodo
 *
 * El bimestre "de febrero" comprende **enero y febrero** (planteamiento §3,
 * RN-02). Esta lectura es la que hace cierto el ejemplo normativo del
 * planteamiento —"el bimestre de febrero se bloquea a partir del 1 de marzo"—:
 * el periodo termina el último día del mes de referencia, y el bloqueo empieza
 * al día siguiente.
 *
 * | Mes de referencia | Comprende | Se bloquea a partir de |
 * |---|---|---|
 * | Febrero | 1 ene – 28/29 feb | 1 de marzo |
 * | Abril | 1 mar – 30 abr | 1 de mayo |
 * | Junio | 1 may – 30 jun | 1 de julio |
 * | Agosto | 1 jul – 31 ago | 1 de septiembre |
 * | Octubre | 1 sep – 31 oct | 1 de noviembre → cierre de temporada |
 *
 * Diciembre **no** es un bimestre (RN-11): es un periodo aparte, exclusivo de
 * trabajadores, y se modela por separado.
 *
 * ## Disponibilidad
 *
 * Todos los bimestres son seleccionables desde el inicio del año (RN-03); lo
 * único que los retira de la oferta es que su periodo **haya transcurrido**
 * (RN-04). Ese bloqueo es una regla de negocio que la API debe **rechazar**, no
 * un simple filtro de presentación.
 *
 * Value object inmutable e identificado por su valor: dos instancias del mismo
 * mes y año son el mismo bimestre.
 */
export class Bimestre implements PeriodoSolicitable {
  /** Los cinco meses de referencia, en orden cronológico (RN-02). */
  static readonly MESES_REFERENCIA: readonly MesReferencia[] = [
    MesReferencia.FEBRERO,
    MesReferencia.ABRIL,
    MesReferencia.JUNIO,
    MesReferencia.AGOSTO,
    MesReferencia.OCTUBRE,
  ];

  readonly tipo = TipoPeriodo.BIMESTRE;

  private constructor(
    readonly mesReferencia: MesReferencia,
    readonly anio: number,
  ) {}

  /**
   * Construye el bimestre de un mes de referencia y un año.
   *
   * @param mesReferencia Mes en base 1; sólo 2, 4, 6, 8 y 10 son bimestres.
   * @throws {BimestreInexistenteError} si el mes no es uno de los cinco (RN-02).
   *   Pedir el mes 12 también falla aquí: diciembre existe, pero no es un
   *   bimestre (RN-11).
   */
  static crear(mesReferencia: number, anio: number): Bimestre {
    if (!Bimestre.esMesDeBimestre(mesReferencia)) {
      throw new BimestreInexistenteError(mesReferencia);
    }
    if (!Number.isInteger(anio)) {
      throw new FechaInvalidaError(`el año ${anio} no es un entero`);
    }
    return new Bimestre(mesReferencia, anio);
  }

  /** Los cinco bimestres de un año, en orden cronológico. Base de la consulta de disponibilidad (CU-C01). */
  static todosDelAnio(anio: number): Bimestre[] {
    return Bimestre.MESES_REFERENCIA.map((mes) => Bimestre.crear(mes, anio));
  }

  /** `true` si el número corresponde a uno de los cinco meses de referencia. */
  static esMesDeBimestre(mes: number): mes is MesReferencia {
    return Bimestre.MESES_REFERENCIA.includes(mes);
  }

  /**
   * `true` si ya no queda ningún bimestre disponible en ese año: el de octubre,
   * que es el último (RN-05), ya transcurrió. Ocurre a partir del 1 de noviembre.
   *
   * El beneficio de diciembre **no** se ve afectado por este cierre (RN-11).
   */
  static temporadaCerrada(anio: number, hoy: FechaCivil): boolean {
    return Bimestre.crear(MesReferencia.OCTUBRE, anio).estaBloqueado(hoy);
  }

  /**
   * Periodo que abarca el bimestre: desde el primer día del mes anterior al de
   * referencia hasta el último día del mes de referencia.
   */
  get periodo(): Periodo {
    const mesInicial = this.mesReferencia - 1;
    const inicio = FechaCivil.de(this.anio, mesInicial, 1);
    const fin = FechaCivil.de(
      this.anio,
      this.mesReferencia,
      FechaCivil.ultimoDiaDelMes(this.anio, this.mesReferencia),
    );
    return Periodo.entre(inicio, fin);
  }

  /**
   * `true` si el bimestre ya transcurrió respecto a la fecha dada y, por tanto,
   * **no puede solicitarse** (RN-04).
   *
   * @param hoy Fecha civil actual, obtenida de `FechaCivil.desdeInstante(clock.now())`.
   */
  estaBloqueado(hoy: FechaCivil): boolean {
    return this.periodo.haTranscurrido(hoy);
  }

  /** Inverso de {@link estaBloqueado}: el bimestre sigue siendo solicitable (RN-03). */
  estaDisponible(hoy: FechaCivil): boolean {
    return !this.estaBloqueado(hoy);
  }

  /**
   * Comprueba que el bimestre pueda solicitarse hoy, distinguiendo las dos
   * situaciones que el planteamiento trata por separado:
   *
   * - si además ya transcurrió **octubre**, el problema no es este bimestre sino
   *   que **ya no queda ninguno** en el año (RN-05);
   * - si la temporada sigue abierta, es sólo que este bimestre venció (RN-04).
   *
   * @throws {PeriodoSolicitudCerradoError} si la temporada del año está cerrada (EC-02).
   * @throws {BimestreBloqueadoError} si únicamente este bimestre ya transcurrió (EC-01).
   */
  validarQuePuedeSolicitarse(hoy: FechaCivil): void {
    if (!this.estaBloqueado(hoy)) {
      return;
    }
    if (Bimestre.temporadaCerrada(this.anio, hoy)) {
      throw new PeriodoSolicitudCerradoError(this.anio);
    }
    throw new BimestreBloqueadoError(this.clave, this.periodo.fin.toString());
  }

  /**
   * Delega en la política del solicitante: el monto elegido y validado si es
   * alumno (RN-09), el 16 % del sueldo base vigente si es trabajador (RN-08).
   */
  montoSegun(politica: PoliticaPrestamo, montoCapturado: Monto | null): Monto {
    return politica.montoParaBimestre(montoCapturado);
  }

  /** `true` si es el bimestre de octubre, el último del año (RN-05). */
  get esUltimoDelAnio(): boolean {
    return this.mesReferencia === MesReferencia.OCTUBRE;
  }

  /**
   * Clave estable del bimestre (`'2026-10'`).
   *
   * La usarán la unicidad de periodos dentro del registro del usuario (RN-06) y
   * el índice único que protege de solicitudes simultáneas (RN-15).
   */
  get clave(): string {
    return `${this.anio}-${String(this.mesReferencia).padStart(2, '0')}`;
  }

  equals(otro: Bimestre): boolean {
    return this.mesReferencia === otro.mesReferencia && this.anio === otro.anio;
  }

  toString(): string {
    return this.clave;
  }
}
