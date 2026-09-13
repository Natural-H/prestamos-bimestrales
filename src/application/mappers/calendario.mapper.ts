import { SolicitudPrestamo } from '../../domain/entities/solicitud-prestamo.entity';
import { PoliticaPrestamo } from '../../domain/services/politica-prestamo';
import { Bimestre } from '../../domain/value-objects/bimestre';
import { FechaCivil } from '../../domain/value-objects/fecha-civil';
import { BimestreDisponibleReadModel } from '../read-models/calendario.read-model';

/**
 * Bimestre del dominio → modelo de lectura del calendario.
 *
 * Lo usan la consulta del calendario completo (CU-C01) y la de un bimestre
 * suelto (CU-C02): las dos responden exactamente lo mismo sobre un bimestre, y
 * tener el mapeo en un solo sitio evita que se les vaya separando la respuesta.
 *
 * El `montoEnPesos` sale de la política **sin ningún `if` sobre el tipo de
 * usuario**: es el monto ya solicitado si lo está, el que le correspondería al
 * trabajador si no (RN-08) o `null` para el alumno, que es quien lo elige
 * (RN-09) —y también para el trabajador que aún no capturó su sueldo base—.
 */
export class CalendarioMapper {
  static aBimestreReadModel(
    bimestre: Bimestre,
    solicitud: SolicitudPrestamo,
    politica: PoliticaPrestamo | null,
    hoy: FechaCivil,
  ): BimestreDisponibleReadModel {
    const bloqueado = bimestre.estaBloqueado(hoy);
    const montoVigente = politica === null ? null : solicitud.montoVigenteDe(bimestre, politica);
    const montoPrevisto = politica === null ? null : politica.montoPrevistoParaBimestre();

    return {
      clave: bimestre.clave,
      mesReferencia: bimestre.mesReferencia,
      inicio: bimestre.periodo.inicio.toString(),
      fin: bimestre.periodo.fin.toString(),
      estado: bloqueado ? 'BLOQUEADO' : 'DISPONIBLE',
      motivoBloqueo: bloqueado ? `Su periodo terminó el ${bimestre.periodo.fin.toString()}.` : null,
      yaSolicitado: solicitud.tieneSolicitado(bimestre),
      montoEnPesos: (montoVigente ?? montoPrevisto)?.aCadena() ?? null,
    };
  }
}
