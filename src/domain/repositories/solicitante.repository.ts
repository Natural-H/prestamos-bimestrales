import { Solicitante } from '../entities/solicitante.entity';
import { SolicitanteId } from '../value-objects/solicitante-id';

/**
 * **Puerto** de persistencia del solicitante y su sueldo base (RN-01, RN-13).
 *
 * Puerto pequeño y específico, con sólo lo que los casos de uso necesitan
 * (segregación de interfaces, CLAUDE.md §5-I): nada de credenciales ni de
 * búsquedas para el login, que son asunto del adaptador de autenticación.
 */
export interface SolicitanteRepository {
  /** Solicitante por su identificador, o `null` si no existe. */
  buscarPorId(id: SolicitanteId): Promise<Solicitante | null>;

  /** Crea o actualiza al solicitante, incluido su sueldo base vigente. */
  guardar(solicitante: Solicitante): Promise<void>;
}

/** Token de inyección del puerto. */
export const SOLICITANTE_REPOSITORY = Symbol('SolicitanteRepository');
