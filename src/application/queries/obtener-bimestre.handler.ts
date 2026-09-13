import { Bimestre } from '../../domain/value-objects/bimestre';
import { CalendarioMapper } from '../mappers/calendario.mapper';
import { QueryHandler } from '../ports/handler';
import { CargadorDelRegistro } from '../services/cargador-del-registro';
import { BimestreDisponibleReadModel } from '../read-models/calendario.read-model';
import { ObtenerBimestreQuery } from './obtener-bimestre.query';

/**
 * Caso de uso **Consultar la disponibilidad de un bimestre concreto** (CU-C02).
 *
 * Permite validar antes de solicitar **sin efectos secundarios**: responde si el
 * bimestre sigue disponible (RN-04) y cuánto costaría, pero no registra nada. Es
 * la consulta que evita el patrón de "intentar y ver si falla".
 *
 * Un mes que no es bimestre —marzo, o el 12 de diciembre, que no lo es (RN-11)—
 * se rechaza aquí con `BimestreInexistenteError`, igual que al solicitarlo: la
 * validación la hace el mismo value object en ambos caminos.
 */
export class ObtenerBimestreHandler implements QueryHandler<
  ObtenerBimestreQuery,
  BimestreDisponibleReadModel
> {
  constructor(private readonly registros: CargadorDelRegistro) {}

  async execute(query: ObtenerBimestreQuery): Promise<BimestreDisponibleReadModel> {
    const { hoy, solicitante, solicitud } = await this.registros.cargar(query.solicitanteId);

    // Lanza BimestreInexistenteError si el mes no es uno de los cinco (RN-02).
    const bimestre = Bimestre.crear(query.mesReferencia, hoy.anio);

    const politica = solicitante.politicaPrestamoSiEstaDefinida();

    return CalendarioMapper.aBimestreReadModel(bimestre, solicitud, politica, hoy);
  }
}
