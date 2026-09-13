import { PeriodoDiciembre } from '../../domain/value-objects/periodo-diciembre';
import { QueryHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { DisponibilidadDiciembreReadModel } from '../read-models/calendario.read-model';
import { ObtenerDisponibilidadDiciembreQuery } from './obtener-disponibilidad-diciembre.query';

/**
 * Caso de uso **Consultar la disponibilidad del beneficio de diciembre**
 * (CU-C03).
 *
 * Informa del plazo —hasta el 31 de diciembre (RN-11)—, de si ya lo solicitó y
 * del monto que le corresponde: el 32 % del sueldo base **vigente** (RN-10),
 * derivado en esta misma consulta y no leído de ninguna columna (RN-20).
 *
 * Que el periodo no esté sujeto al cierre de octubre no se comprueba aquí: lo
 * sabe `PeriodoDiciembre`, que tiene su propio calendario.
 */
export class ObtenerDisponibilidadDiciembreHandler implements QueryHandler<
  ObtenerDisponibilidadDiciembreQuery,
  DisponibilidadDiciembreReadModel
> {
  constructor(private readonly registros: CargadorDelRegistro) {}

  async execute(
    query: ObtenerDisponibilidadDiciembreQuery,
  ): Promise<DisponibilidadDiciembreReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(query.solicitanteId);

    const diciembre = PeriodoDiciembre.delAnio(hoy.anio);
    // Sin sueldo base todavía no hay monto que calcular, pero sí plazo que informar.
    const politica = solicitante.politicaPrestamoSiEstaDefinida();
    const bloqueado = diciembre.estaBloqueado(hoy);

    return {
      clave: diciembre.clave,
      anio: diciembre.anio,
      inicio: diciembre.periodo.inicio.toString(),
      fin: diciembre.periodo.fin.toString(),
      estado: bloqueado ? 'BLOQUEADO' : 'DISPONIBLE',
      motivoBloqueo: bloqueado
        ? `El plazo del beneficio de diciembre terminó el ${diciembre.periodo.fin.toString()}.`
        : null,
      yaSolicitado: solicitud.tieneSolicitado(diciembre),
      montoEnPesos: politica === null ? null : politica.montoParaDiciembre().aCadena(),
    };
  }
}
