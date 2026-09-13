import { SolicitarBimestresCommand } from '../../application/commands/solicitar-bimestres.command';
import { SolicitarBimestresDto } from '../dtos/solicitar-bimestres.dto';

/**
 * DTO de presentación → comando de aplicación (CLAUDE.md §7.8).
 *
 * Hace explícitas dos decisiones del contrato HTTP:
 *
 * 1. El identificador del solicitante **no viene del cuerpo**, viene del token.
 *    Aceptarlo del JSON permitiría solicitar en nombre de otro.
 * 2. Un `montoEnPesos` ausente se traduce a `null` explícito, que es lo que el
 *    comando y la política esperan: "el usuario no capturó monto" (RN-08).
 */
export class SolicitarBimestresMapper {
  static aComando(solicitanteId: string, dto: SolicitarBimestresDto): SolicitarBimestresCommand {
    return new SolicitarBimestresCommand(
      solicitanteId,
      dto.bimestres.map((bimestre) => ({
        mesReferencia: bimestre.mesReferencia,
        montoEnPesos: bimestre.montoEnPesos ?? null,
      })),
    );
  }
}
