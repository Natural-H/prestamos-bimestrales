import { SolicitanteNoEncontradoError } from '../../domain/errors/solicitante-no-encontrado.error';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { Monto } from '../../domain/value-objects/monto';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { SueldoBase } from '../../domain/value-objects/sueldo-base';
import { CommandHandler } from '../ports/handler';
import { CapturarSueldoBaseCommand } from './capturar-sueldo-base.command';

/** Sueldo base vigente tras la operación. */
export interface SueldoBaseReadModel {
  readonly solicitanteId: string;
  /** Sueldo en pesos, como cadena decimal exacta. */
  readonly sueldoBaseEnPesos: string;
}

/**
 * Caso de uso **Capturar sueldo base** (CU-B01, RN-13).
 *
 * Precondición dura de todo cálculo: sin sueldo base, un trabajador no puede
 * solicitar nada (EC-06). Las tres reglas que podrían fallar —que sea
 * trabajador, que no lo tuviera ya, y que el sueldo sea positivo— las aplican la
 * entidad `Solicitante` y el value object `SueldoBase`; aquí sólo se orquesta.
 */
export class CapturarSueldoBaseHandler implements CommandHandler<
  CapturarSueldoBaseCommand,
  SueldoBaseReadModel
> {
  constructor(private readonly solicitantes: SolicitanteRepository) {}

  async execute(command: CapturarSueldoBaseCommand): Promise<SueldoBaseReadModel> {
    const solicitanteId = SolicitanteId.de(command.solicitanteId);

    const solicitante = await this.solicitantes.buscarPorId(solicitanteId);
    if (solicitante === null) {
      throw new SolicitanteNoEncontradoError(solicitanteId.valor);
    }

    const sueldoBase = SueldoBase.de(Monto.desdePesos(command.sueldoBaseEnPesos));
    solicitante.capturarSueldoBase(sueldoBase);
    await this.solicitantes.guardar(solicitante);

    // Se devuelve la forma canónica del value object, no el eco de la entrada:
    // '12345.6' y '12345.60' son el mismo sueldo y la API debe responder igual.
    return {
      solicitanteId: solicitanteId.valor,
      sueldoBaseEnPesos: sueldoBase.monto.aCadena(),
    };
  }
}
