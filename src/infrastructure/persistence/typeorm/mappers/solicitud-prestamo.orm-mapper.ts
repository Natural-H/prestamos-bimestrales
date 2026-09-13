import { PeriodoSolicitado } from '../../../../domain/entities/periodo-solicitado.entity';
import { SolicitudPrestamo } from '../../../../domain/entities/solicitud-prestamo.entity';
import { Bimestre } from '../../../../domain/value-objects/bimestre';
import { FechaCivil } from '../../../../domain/value-objects/fecha-civil';
import { Monto } from '../../../../domain/value-objects/monto';
import { PeriodoDiciembre } from '../../../../domain/value-objects/periodo-diciembre';
import {
  PeriodoSolicitable,
  TipoPeriodo,
} from '../../../../domain/value-objects/periodo-solicitable';
import { SolicitanteId } from '../../../../domain/value-objects/solicitante-id';
import { PeriodoSolicitadoOrmEntity } from '../entities/solicitud-prestamo.orm-entity';

/**
 * Mapper entre las filas de la base y el agregado de dominio (CLAUDE.md §7.8).
 *
 * ## Lo interesante está en la vuelta
 *
 * Reconstruir un periodo obliga a decidir **qué value object** es cada fila: un
 * `Bimestre` o el `PeriodoDiciembre`. Esa es la única vez en todo el sistema en
 * que se mira el tipo de periodo para elegir una clase, y tiene que ser aquí,
 * en la frontera: una fila de base de datos es texto y números, y alguien tiene
 * que convertirla en el objeto que sabe comportarse.
 *
 * El `monto_capturado` viaja como **cadena** de principio a fin, porque el
 * driver devuelve `numeric` en cadena justamente para no perder precisión
 * (RN-14). Convertirlo a `number` aquí arruinaría el trabajo de `Monto`.
 */
export class SolicitudPrestamoOrmMapper {
  /** Fila → value object del periodo (RN-02, RN-11). */
  static aPeriodoSolicitable(fila: PeriodoSolicitadoOrmEntity): PeriodoSolicitable {
    // La columna es texto, así que se compara contra el valor del enum, no
    // contra el enum: es la frontera donde el dato todavía no es de dominio.
    return fila.tipo === String(TipoPeriodo.DICIEMBRE)
      ? PeriodoDiciembre.delAnio(fila.anio)
      : Bimestre.crear(fila.mesReferencia, fila.anio);
  }

  /** Filas → agregado listo para trabajar. */
  static aDominio(
    solicitanteId: string,
    anio: number,
    filas: readonly PeriodoSolicitadoOrmEntity[],
    version: number,
  ): SolicitudPrestamo {
    const periodos = filas.map(
      (fila) =>
        new PeriodoSolicitado(
          SolicitudPrestamoOrmMapper.aPeriodoSolicitable(fila),
          fila.montoCapturado === null ? null : Monto.desdePesos(fila.montoCapturado),
          SolicitudPrestamoOrmMapper.aFechaCivil(fila.fechaSolicitud),
        ),
    );

    return SolicitudPrestamo.reconstituir(SolicitanteId.de(solicitanteId), anio, periodos, version);
  }

  /** Periodo del agregado → fila lista para insertar. */
  static aFila(
    solicitudId: string,
    periodoSolicitado: PeriodoSolicitado,
  ): Partial<PeriodoSolicitadoOrmEntity> {
    const { periodo } = periodoSolicitado;
    return {
      solicitudId,
      tipo: periodo.tipo,
      // El mes de referencia es el mes final del periodo (RN-02, decisión P-01).
      mesReferencia: periodo.periodo.fin.mes,
      anio: periodo.anio,
      montoCapturado: periodoSolicitado.montoCapturado?.aCadena() ?? null,
      fechaSolicitud: periodoSolicitado.fechaSolicitud.toString(),
    };
  }

  /**
   * Columna `date` → `FechaCivil`.
   *
   * El driver puede devolver la fecha como cadena `YYYY-MM-DD` o como `Date`
   * según la configuración; se normaliza aquí para que el dominio reciba siempre
   * un día civil y no un instante con zona (RN-04).
   */
  private static aFechaCivil(valor: string | Date): FechaCivil {
    const texto = valor instanceof Date ? valor.toISOString().slice(0, 10) : valor;
    const [anio, mes, dia] = texto.slice(0, 10).split('-').map(Number);
    return FechaCivil.de(anio, mes, dia);
  }
}
