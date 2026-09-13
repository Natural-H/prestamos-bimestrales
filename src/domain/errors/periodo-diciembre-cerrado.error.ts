import { DomainError } from './domain.error';

/**
 * Se intentó solicitar el beneficio de diciembre fuera de plazo (RN-11).
 *
 * Diciembre se puede solicitar **hasta el 31 de diciembre** inclusive; a partir
 * del 1 de enero queda bloqueado, igual que cualquier otro periodo transcurrido.
 * Tiene error propio porque su plazo es independiente del cierre de octubre: la
 * temporada de bimestres puede llevar dos meses cerrada y diciembre seguir
 * abierto.
 *
 * Se mapea a `409 Conflict` (EC-08).
 */
export class PeriodoDiciembreCerradoError extends DomainError {
  constructor(anio: number) {
    super(
      'PERIODO_DICIEMBRE_CERRADO',
      `El beneficio de diciembre de ${anio} ya no puede solicitarse: su plazo terminó el 31 de diciembre de ${anio}.`,
    );
  }
}
