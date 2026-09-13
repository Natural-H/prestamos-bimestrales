/**
 * Raíz de todos los errores de dominio.
 *
 * El dominio lanza errores **semánticos propios** y la aplicación los deja
 * propagar tal cual; es un `exception filter` de presentación quien los traduce
 * a códigos HTTP (CLAUDE.md §7.7). Por eso esta clase no sabe nada de HTTP: solo
 * expone un `codigo` estable que el filtro usará como clave de mapeo, de modo
 * que cambiar un mensaje nunca rompa el contrato de la API.
 */
export abstract class DomainError extends Error {
  /**
   * @param codigo Identificador estable del error, en `SNAKE_CASE`. Es lo que
   *   consumirá el mapeo a HTTP y lo que pueden reconocer los clientes.
   * @param mensaje Descripción legible, en español, del incumplimiento.
   */
  protected constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}
