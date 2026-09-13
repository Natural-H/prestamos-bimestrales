import { FechaInvalidaError } from '../errors/fecha-invalida.error';

/**
 * Zona horaria de referencia de todo el negocio (planteamiento §7, RN-04).
 *
 * Todas las fechas del sistema —bloqueo de bimestres, cierre de temporada,
 * ventana de diciembre— se evalúan en esta zona, no en la del servidor.
 */
export const ZONA_HORARIA_TECNM = 'America/Mexico_City';

/**
 * Fecha civil (año, mes y día) **sin hora ni zona**, tal como la vería una
 * persona en México.
 *
 * ## Por qué existe
 *
 * Las reglas del negocio hablan de días completos: "el bimestre de febrero se
 * bloquea a partir del 1 de marzo" (RN-04). Comparar instantes UTC para decidir
 * eso es una fuente clásica de errores de un día: a las 23:30 del 28 de febrero
 * en México ya es 1 de marzo en UTC, y el bimestre **todavía no debe estar
 * bloqueado**. Este value object hace la conversión una sola vez, en el borde,
 * y a partir de ahí el dominio compara días con días.
 *
 * ## Pureza
 *
 * Usa `Intl.DateTimeFormat`, que forma parte del estándar del lenguaje y del
 * runtime de Node, no de un framework: el dominio sigue sin dependencias
 * externas (CLAUDE.md §2.2). Tampoco lee el reloj: el instante siempre llega
 * desde `ClockPort` (CLAUDE.md §7.5).
 */
export class FechaCivil {
  private static readonly MES_MINIMO = 1;
  private static readonly MES_MAXIMO = 12;

  private constructor(
    /** Año con cuatro dígitos. */
    readonly anio: number,
    /** Mes en base 1: 1 = enero … 12 = diciembre. */
    readonly mes: number,
    /** Día del mes, entre 1 y el último día real del mes. */
    readonly dia: number,
  ) {}

  /**
   * Construye una fecha civil validando que exista en el calendario.
   *
   * @throws {FechaInvalidaError} si algún componente no es entero, está fuera de
   *   rango o el día no existe en ese mes (p. ej. 30 de febrero, o 29 de febrero
   *   en un año no bisiesto).
   */
  static de(anio: number, mes: number, dia: number): FechaCivil {
    if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
      throw new FechaInvalidaError(`año, mes y día deben ser enteros (${anio}-${mes}-${dia})`);
    }
    if (mes < FechaCivil.MES_MINIMO || mes > FechaCivil.MES_MAXIMO) {
      throw new FechaInvalidaError(`el mes ${mes} está fuera del rango 1-12`);
    }
    const ultimoDia = FechaCivil.ultimoDiaDelMes(anio, mes);
    if (dia < 1 || dia > ultimoDia) {
      throw new FechaInvalidaError(`el día ${dia} no existe en el mes ${mes} de ${anio}`);
    }
    return new FechaCivil(anio, mes, dia);
  }

  /**
   * Traduce un instante (lo que devuelve `ClockPort.now()`) a la fecha civil que
   * corresponde en la zona horaria del TECNM.
   *
   * Éste es el **único punto de conversión** entre instantes y días del dominio.
   *
   * @param instante Momento en el tiempo, normalmente `clock.now()`.
   * @param zonaHoraria Zona de referencia; por defecto `America/Mexico_City`.
   */
  static desdeInstante(instante: Date, zonaHoraria: string = ZONA_HORARIA_TECNM): FechaCivil {
    if (Number.isNaN(instante.getTime())) {
      throw new FechaInvalidaError('el instante recibido no es una fecha válida');
    }

    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instante);

    const valorDe = (tipo: Intl.DateTimeFormatPartTypes): number => {
      const parte = partes.find((p) => p.type === tipo);
      if (parte === undefined) {
        throw new FechaInvalidaError(`no se pudo extraer "${tipo}" en la zona ${zonaHoraria}`);
      }
      return Number.parseInt(parte.value, 10);
    };

    return FechaCivil.de(valorDe('year'), valorDe('month'), valorDe('day'));
  }

  /**
   * Último día de un mes concreto, contemplando años bisiestos.
   *
   * Usa `Date.UTC` como pura aritmética de calendario —una fecha explícita, no
   * el reloj del sistema—, así que no rompe la regla de pureza del dominio.
   */
  static ultimoDiaDelMes(anio: number, mes: number): number {
    return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  }

  /** Compara dos fechas: negativo si ésta es anterior, 0 si son el mismo día, positivo si posterior. */
  comparar(otra: FechaCivil): number {
    if (this.anio !== otra.anio) return this.anio - otra.anio;
    if (this.mes !== otra.mes) return this.mes - otra.mes;
    return this.dia - otra.dia;
  }

  esPosteriorA(otra: FechaCivil): boolean {
    return this.comparar(otra) > 0;
  }

  esAnteriorA(otra: FechaCivil): boolean {
    return this.comparar(otra) < 0;
  }

  equals(otra: FechaCivil): boolean {
    return this.comparar(otra) === 0;
  }

  /** Representación ISO del día (`YYYY-MM-DD`), sin hora ni zona. */
  toString(): string {
    const mes = String(this.mes).padStart(2, '0');
    const dia = String(this.dia).padStart(2, '0');
    return `${this.anio}-${mes}-${dia}`;
  }
}
