import { DomainError } from './domain.error';

/**
 * Se intentó solicitar un bimestre cuyo periodo ya transcurrió (RN-04).
 *
 * El bloqueo es una **regla de negocio**, no un filtro de presentación: aunque
 * la consulta de disponibilidad ya no ofrezca el bimestre, la API debe
 * rechazarlo igualmente si alguien lo pide a mano. Ésa es la "protección real"
 * que exige el planteamiento (§3).
 *
 * Se mapea a `409 Conflict` (EC-01): la petición es válida, pero choca con el
 * estado del calendario en esta fecha.
 */
export class BimestreBloqueadoError extends DomainError {
  constructor(clave: string, finDelPeriodo: string) {
    super(
      'BIMESTRE_BLOQUEADO',
      `El bimestre ${clave} ya transcurrió (su periodo terminó el ${finDelPeriodo}) y no puede solicitarse.`,
    );
  }
}
