import { DomainError } from './domain.error';

/**
 * Se solicitó un bimestre que no existe en el calendario del TECNM.
 *
 * Los únicos bimestres son los identificados por sus meses de referencia
 * **febrero, abril, junio, agosto y octubre** (RN-02). Pedir "marzo" o
 * "diciembre" como bimestre es este error: diciembre existe, pero **no es un
 * bimestre** (RN-11), es un periodo aparte exclusivo de trabajadores.
 *
 * Se mapea a `400 Bad Request` (EC-09): es una petición mal formada, no un
 * conflicto con el estado del sistema.
 */
export class BimestreInexistenteError extends DomainError {
  constructor(mesRecibido: number) {
    super(
      'BIMESTRE_INEXISTENTE',
      `El mes ${mesRecibido} no corresponde a ningún bimestre. ` +
        'Los bimestres se identifican por su mes de referencia: 2 (febrero), 4 (abril), ' +
        '6 (junio), 8 (agosto) y 10 (octubre).',
    );
  }
}
