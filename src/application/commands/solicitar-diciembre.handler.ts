import { SolicitudPrestamoRepository } from '../../domain/repositories/solicitud-prestamo.repository';
import { PeriodoDiciembre } from '../../domain/value-objects/periodo-diciembre';
import { SolicitudPrestamoMapper } from '../mappers/solicitud-prestamo.mapper';
import { CommandHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { ResultadoSolicitarReadModel } from '../read-models/solicitud-prestamo.read-model';
import { SolicitarDiciembreCommand } from './solicitar-diciembre.command';

/**
 * Caso de uso **Solicitar el beneficio de diciembre** (CU-D03).
 *
 * Mismo esqueleto que el de bimestres —cargar, delegar, guardar— sobre el mismo
 * agregado, porque diciembre se acumula en el **mismo registro** del año
 * (RN-06). Lo que cambia lo ponen el periodo y la política:
 *
 * - `PeriodoDiciembre` aporta su plazo propio, hasta el 31 de diciembre, ajeno
 *   al cierre de octubre (RN-11);
 * - la política del solicitante aporta el 32 % (RN-10) o el rechazo si es alumno
 *   (RN-12, EC-07).
 *
 * El handler no comprueba ninguna de las dos cosas: sólo las orquesta.
 */
export class SolicitarDiciembreHandler implements CommandHandler<
  SolicitarDiciembreCommand,
  ResultadoSolicitarReadModel
> {
  constructor(
    private readonly registros: CargadorDelRegistro,
    private readonly solicitudes: SolicitudPrestamoRepository,
  ) {}

  async execute(command: SolicitarDiciembreCommand): Promise<ResultadoSolicitarReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(command.solicitanteId);

    const politica = solicitante.politicaPrestamo();

    const resultado = solicitud.agregar(
      [{ periodo: PeriodoDiciembre.delAnio(hoy.anio), montoCapturado: null }],
      politica,
      hoy,
    );

    if (resultado.agregados.length > 0) {
      await this.solicitudes.guardar(solicitud);
    }

    return {
      agregados: resultado.agregados,
      sinCambios: resultado.sinCambios,
      solicitud: SolicitudPrestamoMapper.aReadModel(solicitud, politica, hoy),
    };
  }
}
