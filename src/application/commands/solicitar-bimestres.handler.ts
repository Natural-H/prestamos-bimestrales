import { SolicitudDePeriodo } from '../../domain/entities/solicitud-prestamo.entity';
import { SolicitudPrestamoRepository } from '../../domain/repositories/solicitud-prestamo.repository';
import { Bimestre } from '../../domain/value-objects/bimestre';
import { Monto } from '../../domain/value-objects/monto';
import { SolicitudPrestamoMapper } from '../mappers/solicitud-prestamo.mapper';
import { CommandHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { ResultadoSolicitarReadModel } from '../read-models/solicitud-prestamo.read-model';
import { SolicitarBimestresCommand } from './solicitar-bimestres.command';

/**
 * Caso de uso **Solicitar bimestres** (CU-D01 para el alumno, CU-D02 para el
 * trabajador).
 *
 * ## Handler delgado
 *
 * Este método no contiene ni una sola regla de negocio (CLAUDE.md §4.2):
 * traduce primitivos a value objects, carga, **delega** y guarda. Las reglas
 * viven donde deben:
 *
 * | Regla | Quién la aplica |
 * |---|---|
 * | Bloqueo por fecha y cierre de temporada (RN-04, RN-05) | `Bimestre` |
 * | Monto según tipo de usuario (RN-08, RN-09) | la política del `Solicitante` |
 * | Upsert acumulativo, idempotente y atómico (RN-06, RN-18) | `SolicitudPrestamo` |
 *
 * ## Dos detalles del flujo
 *
 * - El **año** sale del reloj, no del comando: el registro es el del año en
 *   curso (RN-06). Si el usuario aún no tiene registro, se crea vacío al vuelo.
 * - Si no se agregó nada —repetición idéntica, RN-18— **no se guarda**: una
 *   escritura inútil haría avanzar la versión del registro y provocaría
 *   conflictos de concurrencia artificiales en operaciones que no cambiaron nada.
 */
export class SolicitarBimestresHandler implements CommandHandler<
  SolicitarBimestresCommand,
  ResultadoSolicitarReadModel
> {
  constructor(
    private readonly registros: CargadorDelRegistro,
    private readonly solicitudes: SolicitudPrestamoRepository,
  ) {}

  async execute(command: SolicitarBimestresCommand): Promise<ResultadoSolicitarReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(command.solicitanteId);

    // Lanza SueldoBaseNoRegistradoError si es trabajador y aún no lo capturó (EC-06).
    const politica = solicitante.politicaPrestamo();

    const periodos: SolicitudDePeriodo[] = command.bimestres.map((bimestre) => ({
      periodo: Bimestre.crear(bimestre.mesReferencia, hoy.anio),
      montoCapturado:
        bimestre.montoEnPesos === null ? null : Monto.desdePesos(bimestre.montoEnPesos),
    }));

    const resultado = solicitud.agregar(periodos, politica, hoy);

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
