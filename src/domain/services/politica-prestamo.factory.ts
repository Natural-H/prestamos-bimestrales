import { SueldoBaseNoRegistradoError } from '../errors/sueldo-base-no-registrado.error';
import { SueldoBase } from '../value-objects/sueldo-base';
import { TipoUsuario } from '../value-objects/tipo-usuario';
import { PoliticaPrestamo } from './politica-prestamo';
import { PoliticaPrestamoAlumno } from './politica-prestamo-alumno';
import { PoliticaPrestamoTrabajador } from './politica-prestamo-trabajador';

/**
 * Único punto del sistema donde se decide **qué política** aplica a un usuario.
 *
 * Concentrar aquí la selección es lo que mantiene el resto del dominio y todos
 * los casos de uso libres de `if (tipo === 'alumno')`: piden la política y
 * hablan con la interfaz. Añadir un tipo de usuario nuevo es añadir una rama
 * aquí y una implementación nueva, sin tocar nada más (CLAUDE.md §5-O).
 */
export class PoliticaPrestamoFactory {
  /**
   * @param tipoUsuario Tipo del solicitante (RN-01).
   * @param sueldoBase Sueldo **vigente** del trabajador, o `null` si aún no lo
   *   ha capturado. Se ignora para los alumnos, que no tienen sueldo en este
   *   sistema.
   * @throws {SueldoBaseNoRegistradoError} si es trabajador y no hay sueldo base:
   *   sin él no existe monto que calcular (RN-08, RN-13).
   */
  static crear(tipoUsuario: TipoUsuario, sueldoBase: SueldoBase | null): PoliticaPrestamo {
    switch (tipoUsuario) {
      case TipoUsuario.ALUMNO:
        return new PoliticaPrestamoAlumno();

      case TipoUsuario.TRABAJADOR:
        if (sueldoBase === null) {
          throw new SueldoBaseNoRegistradoError();
        }
        return new PoliticaPrestamoTrabajador(sueldoBase);
    }
  }
}
