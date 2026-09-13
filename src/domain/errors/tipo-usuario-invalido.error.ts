import { DomainError } from './domain.error';

/**
 * El valor recibido no corresponde a ninguno de los dos tipos de usuario (RN-01).
 *
 * Sólo existen `alumno` y `trabajador`. Este error protege el borde del dominio:
 * lo lanzará el mapeo desde la base de datos o desde el rol que viaja en el JWT
 * si alguna vez llega algo distinto, para que un valor corrupto no se cuele
 * hasta el cálculo del préstamo.
 */
export class TipoUsuarioInvalidoError extends DomainError {
  constructor(valorRecibido: string) {
    super(
      'TIPO_USUARIO_INVALIDO',
      `"${valorRecibido}" no es un tipo de usuario válido. Los tipos son: alumno, trabajador.`,
    );
  }
}
