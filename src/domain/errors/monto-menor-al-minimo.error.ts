import { DomainError } from './domain.error';

/**
 * El alumno pidió menos del mínimo de un bimestre (RN-09).
 *
 * El rango del alumno empieza en **$0.01**: un préstamo de cero pesos no es un
 * préstamo. En la práctica éste es el error del monto en cero, porque las
 * cantidades negativas ni siquiera llegan a construirse como `Monto`
 * (`MontoInvalidoError`, RN-14).
 *
 * Se mapea a `422 Unprocessable Entity` (EC-04).
 */
export class MontoMenorAlMinimoError extends DomainError {
  constructor(montoSolicitado: string, minimoPorBimestre: string) {
    super(
      'MONTO_MENOR_AL_MINIMO',
      `El monto solicitado (MXN ${montoSolicitado}) es menor al mínimo de MXN ${minimoPorBimestre} por bimestre.`,
    );
  }
}
