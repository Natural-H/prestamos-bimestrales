import { SolicitanteNoEncontradoError } from '../../domain/errors/solicitante-no-encontrado.error';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';
import { QueryHandler } from '../ports/handler';
import { ObtenerPerfilQuery } from './obtener-perfil.query';

/** Perfil del usuario autenticado (CU-A03). */
export interface PerfilReadModel {
  readonly solicitanteId: string;
  readonly tipoUsuario: TipoUsuario;
  /** Sólo es relevante para el trabajador; para el alumno siempre es `false`. */
  readonly tieneSueldoBase: boolean;
  /** `true` si puede solicitar el beneficio de diciembre (RN-10, RN-12). */
  readonly tieneDerechoADiciembre: boolean;
}

/**
 * Caso de uso **Consultar mi perfil** (CU-A03).
 *
 * Existe para que el cliente no tenga que adivinar qué operaciones le
 * corresponden: si debe capturar un monto o se lo calculan, si le falta capturar
 * su sueldo base, si diciembre va con él.
 */
export class ObtenerPerfilHandler implements QueryHandler<ObtenerPerfilQuery, PerfilReadModel> {
  constructor(private readonly solicitantes: SolicitanteRepository) {}

  async execute(query: ObtenerPerfilQuery): Promise<PerfilReadModel> {
    const solicitanteId = SolicitanteId.de(query.solicitanteId);

    const solicitante = await this.solicitantes.buscarPorId(solicitanteId);
    if (solicitante === null) {
      throw new SolicitanteNoEncontradoError(solicitanteId.valor);
    }

    return {
      solicitanteId: solicitante.id.valor,
      tipoUsuario: solicitante.tipoUsuario,
      tieneSueldoBase: solicitante.tieneSueldoBase,
      tieneDerechoADiciembre: solicitante.esTrabajador,
    };
  }
}
