import { MontoNoCapturableError } from '../errors/monto-no-capturable.error';
import { Monto } from '../value-objects/monto';
import { Porcentaje } from '../value-objects/porcentaje';
import { SueldoBase } from '../value-objects/sueldo-base';
import { TipoUsuario } from '../value-objects/tipo-usuario';
import { PoliticaPrestamo } from './politica-prestamo';

/**
 * Política del **trabajador**: préstamo fijo calculado sobre el sueldo base
 * (RN-08, RN-10).
 *
 * - **Bimestre normal:** 16 % del sueldo base. Si solicita *N* bimestres, el
 *   total equivale a *N* × 16 % (planteamiento §5).
 * - **Diciembre:** 32 % del sueldo base, pagado con el aguinaldo. Es el único
 *   monto del año al 32 %.
 *
 * ## El monto flota con el sueldo vigente
 *
 * La política se construye con el sueldo **vigente** y no guarda nada: al
 * cambiar el sueldo se construye otra y todos los montos cambian con ella
 * (RN-13, RN-20). Ése es el mecanismo por el que el "recálculo" del caso de uso
 * CU-B02 se cumple por construcción, sin reescribir ninguna fila.
 *
 * ## Sobre el 32 % de diciembre
 *
 * Se calcula **sobre el sueldo base**, no duplicando el 16 % ya redondeado. Con
 * sueldos cuya fracción cae en medio centavo, ambas cuentas pueden diferir en un
 * centavo, y la que manda es la del planteamiento: "32 % del sueldo base"
 * (RN-10).
 */
export class PoliticaPrestamoTrabajador implements PoliticaPrestamo {
  /** 16 % del sueldo base por bimestre (RN-08). */
  static readonly PORCENTAJE_POR_BIMESTRE = Porcentaje.dePorCiento(16);
  /** 32 % del sueldo base en diciembre (RN-10). */
  static readonly PORCENTAJE_DICIEMBRE = Porcentaje.dePorCiento(32);

  readonly tipoUsuario = TipoUsuario.TRABAJADOR;

  /**
   * @param sueldoBase Sueldo **vigente** del trabajador. Quien construye esta
   *   política es responsable de pasar el actual, nunca uno guardado antes.
   */
  constructor(private readonly sueldoBase: SueldoBase) {}

  /**
   * Calcula el 16 % del sueldo base vigente, con redondeo half-up al centavo
   * (RN-19).
   *
   * @param montoSolicitado Debe ser `null`: el trabajador no captura monto.
   * @throws {MontoNoCapturableError} si el caso de uso recibió un monto del
   *   cliente. Se rechaza incluso si coincidiera con el calculado, para que el
   *   monto nunca dependa de un valor que controla quien llama.
   */
  montoParaBimestre(montoSolicitado: Monto | null): Monto {
    if (montoSolicitado !== null) {
      throw new MontoNoCapturableError();
    }
    return this.sueldoBase.monto.porcentaje(PoliticaPrestamoTrabajador.PORCENTAJE_POR_BIMESTRE);
  }

  /** El 16 % del sueldo vigente: su monto está determinado antes de solicitar (RN-08). */
  montoPrevistoParaBimestre(): Monto | null {
    return this.montoParaBimestre(null);
  }

  /** Siempre `true`: el beneficio de diciembre es suyo (RN-10). */
  tieneDerechoADiciembre(): boolean {
    return true;
  }

  /** 32 % del sueldo base vigente, con redondeo half-up al centavo (RN-10, RN-19). */
  montoParaDiciembre(): Monto {
    return this.sueldoBase.monto.porcentaje(PoliticaPrestamoTrabajador.PORCENTAJE_DICIEMBRE);
  }
}
