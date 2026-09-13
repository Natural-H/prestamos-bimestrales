import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Formato de cantidad en pesos: entero con hasta dos decimales (RN-14). */
const PESOS = /^\d+(\.\d{1,2})?$/;

/**
 * Un bimestre dentro de la petición.
 *
 * ## Aquí sólo se valida la FORMA
 *
 * `mesReferencia` se acepta como cualquier mes de 1 a 12 y no como "2, 4, 6, 8
 * o 10": **cuáles son bimestres es una regla de negocio** (RN-02) y vive en el
 * dominio (`BimestreInexistenteError`). Enumerarlos aquí duplicaría la regla en
 * dos sitios que tendrían que cambiar a la vez (CLAUDE.md §7.6).
 *
 * Lo mismo con el monto: se comprueba que *parezca* una cantidad de pesos, no
 * que respete el rango de $0.01 a $3,500.00, que es RN-09 y la valida la
 * política del alumno.
 */
export class BimestreSolicitadoDto {
  @IsInt({ message: 'mesReferencia debe ser un número entero.' })
  @Min(1)
  @Max(12)
  mesReferencia!: number;

  /**
   * Monto elegido, en pesos y como cadena para no perder precisión por el
   * camino (RN-14). El **alumno** debe enviarlo; el **trabajador** debe omitirlo
   * porque su monto lo calcula el sistema (RN-08).
   */
  @IsOptional()
  @Matches(PESOS, {
    message:
      'montoEnPesos debe ser una cantidad en pesos con hasta dos decimales, por ejemplo "3500.00".',
  })
  montoEnPesos?: string | null;
}

/** Cuerpo de `POST /solicitudes/bimestres` (CU-D01, CU-D02). */
export class SolicitarBimestresDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Hay que indicar al menos un bimestre.' })
  @ArrayUnique((bimestre: BimestreSolicitadoDto) => bimestre.mesReferencia, {
    message: 'No se puede repetir el mismo bimestre dentro de la misma petición.',
  })
  @ValidateNested({ each: true })
  @Type(() => BimestreSolicitadoDto)
  bimestres!: BimestreSolicitadoDto[];
}
