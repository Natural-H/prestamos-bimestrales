import { DomainError } from './domain.error';

/**
 * Ya existe un usuario dado de alta con ese correo (CU-A01).
 *
 * Vive entre los errores de dominio, y no en infraestructura, porque la
 * unicidad del alta es una regla del negocio: un mismo correo no puede
 * corresponder a dos solicitantes. Cómo se guarde el hash de la contraseña es
 * otra cosa, y eso sí es asunto del adaptador.
 *
 * Se mapea a `409 Conflict`.
 */
export class CorreoYaRegistradoError extends DomainError {
  constructor(correo: string) {
    super('CORREO_YA_REGISTRADO', `Ya existe un usuario registrado con el correo ${correo}.`);
  }
}
