import { DomainError } from './domain.error';

/**
 * El trabajador intentó **capturar** un sueldo base que ya tenía (RN-13).
 *
 * Capturar y actualizar son casos de uso distintos (CU-B01 y CU-B02): el
 * primero es el alta inicial y el segundo el cambio con recálculo. Si capturar
 * sobrescribiera en silencio, un alta repetida por error cambiaría los montos de
 * todo el registro sin que nadie lo pidiera.
 *
 * Se mapea a `409 Conflict`.
 */
export class SueldoBaseYaRegistradoError extends DomainError {
  constructor() {
    super(
      'SUELDO_BASE_YA_REGISTRADO',
      'El trabajador ya tiene un sueldo base capturado; para cambiarlo hay que actualizarlo.',
    );
  }
}
