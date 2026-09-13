import { DomainError } from './domain.error';

/**
 * Se intentó solicitar un bimestre cuando la temporada del año ya cerró (RN-05).
 *
 * Octubre es el último bimestre; una vez transcurrido —a partir del 1 de
 * noviembre— **no queda ninguno disponible** en ese año. Se distingue de
 * `BimestreBloqueadoError` porque no es que ese bimestre en concreto se haya
 * pasado: es que ya no hay nada que solicitar hasta el año siguiente, y eso es
 * lo útil que puede decirle la API a quien llama.
 *
 * El beneficio de diciembre **no** se ve afectado por este cierre (RN-11).
 *
 * Se mapea a `409 Conflict` (EC-02).
 */
export class PeriodoSolicitudCerradoError extends DomainError {
  constructor(anio: number) {
    super(
      'PERIODO_SOLICITUD_CERRADO',
      `La temporada de bimestres de ${anio} está cerrada: el bimestre de octubre, el último del año, ya transcurrió.`,
    );
  }
}
