import { Matches } from 'class-validator';

const PESOS = /^\d+(\.\d{1,2})?$/;

/**
 * Cuerpo de la captura y de la actualización del sueldo base (CU-B01, CU-B02).
 *
 * Viaja como **cadena decimal** y no como número: `12345.67` en JSON es un
 * `double`, y convertirlo reintroduciría el error de coma flotante que el
 * dominio evita con centavos enteros (RN-14).
 *
 * Que el sueldo tenga que ser mayor que cero (RN-13) no se valida aquí: eso lo
 * decide el value object `SueldoBase`.
 */
export class SueldoBaseDto {
  @Matches(PESOS, {
    message:
      'sueldoBaseEnPesos debe ser una cantidad en pesos con hasta dos decimales, por ejemplo "12345.67".',
  })
  sueldoBaseEnPesos!: string;
}
