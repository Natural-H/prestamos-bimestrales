import { SolicitanteIdInvalidoError } from '../errors/solicitante-id-invalido.error';

/**
 * Identificador del solicitante (alumno o trabajador).
 *
 * El dominio **no lo genera** ni lo espera de una secuencia de la base de datos
 * (CLAUDE.md §2.3): llega ya formado desde fuera —del `sub` del JWT o de quien
 * dé de alta al usuario—, de modo que el agregado puede construirse y probarse
 * sin infraestructura. Tipo propio para que no se confunda con cualquier otra
 * cadena del sistema.
 */
export class SolicitanteId {
  private constructor(readonly valor: string) {}

  /**
   * @throws {SolicitanteIdInvalidoError} si está vacío o sólo tiene espacios.
   */
  static de(valor: string): SolicitanteId {
    const limpio = valor.trim();
    if (limpio.length === 0) {
      throw new SolicitanteIdInvalidoError();
    }
    return new SolicitanteId(limpio);
  }

  equals(otro: SolicitanteId): boolean {
    return this.valor === otro.valor;
  }

  toString(): string {
    return this.valor;
  }
}
