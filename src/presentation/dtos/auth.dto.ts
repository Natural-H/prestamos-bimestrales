import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { TipoUsuario } from '../../domain/value-objects/tipo-usuario';

/** Cuerpo de `POST /auth/registro` (CU-A01). */
export class RegistrarUsuarioDto {
  @IsEmail({}, { message: 'correo debe ser una dirección de correo válida.' })
  correo!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  contrasena!: string;

  /**
   * Rol del usuario, fijado en el alta e inmutable después (RN-01).
   *
   * Éste sí se enumera en el DTO —a diferencia del mes del bimestre— porque es
   * un campo con dominio cerrado del **contrato de la API**: un valor distinto
   * es una petición mal formada (`400`), no una incoherencia interna. El dominio
   * lo vuelve a validar en `tipoUsuarioDesde`.
   */
  @IsIn(Object.values(TipoUsuario), {
    message: `tipoUsuario debe ser uno de: ${Object.values(TipoUsuario).join(', ')}.`,
  })
  tipoUsuario!: string;
}

/** Cuerpo de `POST /auth/login` (CU-A02). */
export class IniciarSesionDto {
  @IsEmail({}, { message: 'correo debe ser una dirección de correo válida.' })
  correo!: string;

  @IsString()
  contrasena!: string;
}
