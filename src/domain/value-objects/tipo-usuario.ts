import { TipoUsuarioInvalidoError } from '../errors/tipo-usuario-invalido.error';

/**
 * Tipo de usuario del sistema (RN-01).
 *
 * Determina **cómo se calcula el monto** del préstamo y **a qué periodos** se
 * tiene acceso, y es **inmutable tras el alta**: cambiarlo alteraría
 * retroactivamente el monto de todo lo ya solicitado.
 *
 * Los valores coinciden con el rol que viaja en el JWT y con lo que expone la
 * API, pero eso es una conveniencia de mapeo, no una dependencia: el dominio no
 * sabe qué es un JWT (CLAUDE.md §9), sólo conoce este concepto.
 */
export enum TipoUsuario {
  ALUMNO = 'alumno',
  TRABAJADOR = 'trabajador',
}

/**
 * Traduce un valor externo (columna de la base de datos, `rol` del JWT) al tipo
 * de dominio, validándolo en el borde.
 *
 * @throws {TipoUsuarioInvalidoError} si el valor no es `alumno` ni `trabajador`.
 */
export function tipoUsuarioDesde(valor: string): TipoUsuario {
  const tipos: string[] = Object.values(TipoUsuario);
  if (!tipos.includes(valor)) {
    throw new TipoUsuarioInvalidoError(valor);
  }
  return valor as TipoUsuario;
}
