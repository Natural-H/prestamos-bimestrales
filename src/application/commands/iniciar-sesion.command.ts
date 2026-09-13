/** Comando de inicio de sesión (CU-A02). */
export class IniciarSesionCommand {
  constructor(
    readonly correo: string,
    readonly contrasena: string,
  ) {}
}
