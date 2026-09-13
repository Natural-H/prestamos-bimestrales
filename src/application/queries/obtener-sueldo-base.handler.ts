import { SolicitanteNoEncontradoError } from '../../domain/errors/solicitante-no-encontrado.error';
import { SueldoBaseNoRegistradoError } from '../../domain/errors/sueldo-base-no-registrado.error';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { SueldoBaseReadModel } from '../commands/capturar-sueldo-base.handler';
import { QueryHandler } from '../ports/handler';
import { ObtenerSueldoBaseQuery } from './obtener-sueldo-base.query';

/**
 * Caso de uso **Consultar el sueldo base vigente** (CU-B03).
 *
 * Devuelve la base sobre la que se calculan todos los montos del trabajador. Si
 * aún no lo capturó, falla en vez de devolver cero: cero no es un sueldo, es la
 * ausencia de uno (EC-06).
 */
export class ObtenerSueldoBaseHandler implements QueryHandler<
  ObtenerSueldoBaseQuery,
  SueldoBaseReadModel
> {
  constructor(private readonly solicitantes: SolicitanteRepository) {}

  async execute(query: ObtenerSueldoBaseQuery): Promise<SueldoBaseReadModel> {
    const solicitanteId = SolicitanteId.de(query.solicitanteId);

    const solicitante = await this.solicitantes.buscarPorId(solicitanteId);
    if (solicitante === null) {
      throw new SolicitanteNoEncontradoError(solicitanteId.valor);
    }

    const sueldoBase = solicitante.sueldoBase;
    if (sueldoBase === null) {
      throw new SueldoBaseNoRegistradoError();
    }

    return { solicitanteId: solicitanteId.valor, sueldoBaseEnPesos: sueldoBase.monto.aCadena() };
  }
}
