import { SolicitanteNoEncontradoError } from '../../domain/errors/solicitante-no-encontrado.error';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { Monto } from '../../domain/value-objects/monto';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { SueldoBase } from '../../domain/value-objects/sueldo-base';
import { CommandHandler } from '../ports/handler';
import { ActualizarSueldoBaseCommand } from './actualizar-sueldo-base.command';
import { SueldoBaseReadModel } from './capturar-sueldo-base.handler';

/**
 * Caso de uso **Actualizar sueldo base con recálculo de montos** (CU-B02,
 * RN-13).
 *
 * ## Dónde está el recálculo
 *
 * En ninguna línea de este handler, y eso es exactamente lo correcto. Como el
 * monto del trabajador **no se almacena** sino que se deriva del sueldo vigente
 * en cada consulta (RN-20), cambiar el sueldo **ya recalculó** todos los montos
 * del registro: los de los bimestres al 16 %, el de diciembre al 32 % y también
 * los de periodos ya transcurridos (RN-09 de la decisión D-09).
 *
 * La alternativa —recorrer el registro reescribiendo montos dentro de una
 * transacción— habría hecho el mismo trabajo con más código y con un modo de
 * fallo nuevo: que la base de datos quedara desincronizada del sueldo. Aquí eso
 * es imposible por construcción.
 *
 * La prueba del caso de uso es precisamente ésa: tras ejecutar este comando, la
 * consulta del registro devuelve montos nuevos sin que se haya tocado ningún
 * periodo.
 */
export class ActualizarSueldoBaseHandler implements CommandHandler<
  ActualizarSueldoBaseCommand,
  SueldoBaseReadModel
> {
  constructor(private readonly solicitantes: SolicitanteRepository) {}

  async execute(command: ActualizarSueldoBaseCommand): Promise<SueldoBaseReadModel> {
    const solicitanteId = SolicitanteId.de(command.solicitanteId);

    const solicitante = await this.solicitantes.buscarPorId(solicitanteId);
    if (solicitante === null) {
      throw new SolicitanteNoEncontradoError(solicitanteId.valor);
    }

    const sueldoBase = SueldoBase.de(Monto.desdePesos(command.sueldoBaseEnPesos));
    solicitante.actualizarSueldoBase(sueldoBase);
    await this.solicitantes.guardar(solicitante);

    return {
      solicitanteId: solicitanteId.valor,
      sueldoBaseEnPesos: sueldoBase.monto.aCadena(),
    };
  }
}
