import { FechaCivil } from './fecha-civil';
import { Periodo } from './periodo';

/**
 * Situación de entrega de un periodo ya solicitado (RN-07).
 *
 * No es un estado que alguien escriba: es **estado derivado de la fecha**. El
 * proceso de desembolso queda fuera del alcance del microservicio (RN-16), así
 * que no hay comando que "marque como entregado" ni columna que se actualice;
 * hay una función pura del calendario.
 */
export enum EstadoEntrega {
  /** Su periodo todavía no empieza: seleccionar por adelantado no adelanta la entrega (RN-07). */
  PENDIENTE = 'pendiente',
  /** La fecha actual cae dentro de su periodo: es cuando corresponde recibirlo. */
  EN_CURSO = 'en_curso',
  /** Su periodo ya transcurrió. */
  ENTREGADO = 'entregado',
}

/**
 * Deriva el estado de entrega de un periodo en una fecha dada.
 *
 * Nótese que el **monto** asociado no se congela al entregarse: sigue flotando
 * con el sueldo vigente incluso en periodos ya transcurridos (RN-13, RN-20).
 * Es una consecuencia aceptada de no guardar historial ni snapshots.
 */
export function estadoDeEntrega(periodo: Periodo, hoy: FechaCivil): EstadoEntrega {
  if (periodo.aunNoInicia(hoy)) {
    return EstadoEntrega.PENDIENTE;
  }
  if (periodo.haTranscurrido(hoy)) {
    return EstadoEntrega.ENTREGADO;
  }
  return EstadoEntrega.EN_CURSO;
}
