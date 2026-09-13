/**
 * Comando de alta de un usuario (CU-A01).
 *
 * El **rol se fija aquí y es inmutable** (RN-01): determina la política de
 * préstamo, así que cambiarlo después alteraría retroactivamente los montos de
 * todo lo solicitado.
 */
export class RegistrarUsuarioCommand {
  constructor(
    readonly correo: string,
    readonly contrasena: string,
    /** `'alumno'` o `'trabajador'`; se valida contra el dominio en el handler. */
    readonly tipoUsuario: string,
  ) {}
}
