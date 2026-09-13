import { Solicitante } from '../../src/domain/entities/solicitante.entity';
import { SolicitudPrestamo } from '../../src/domain/entities/solicitud-prestamo.entity';
import { SolicitanteRepository } from '../../src/domain/repositories/solicitante.repository';
import { SolicitudPrestamoRepository } from '../../src/domain/repositories/solicitud-prestamo.repository';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';

/**
 * Dobles en memoria de los puertos de repositorio.
 *
 * Permiten probar los casos de uso **sin levantar Postgres** (CLAUDE.md §10) y,
 * al implementar las mismas interfaces que el adaptador de TypeORM, obligan a
 * que los handlers dependan sólo del contrato (§5-D, §5-L).
 *
 * Registran cuántas veces se escribió, porque hay una regla que sólo puede
 * comprobarse así: una solicitud idempotente que no agrega nada **no debe
 * guardar** (RN-18).
 */
export class RepositorioSolicitantesEnMemoria implements SolicitanteRepository {
  private readonly almacen = new Map<string, Solicitante>();
  /** Número de escrituras recibidas. */
  guardados = 0;

  constructor(...solicitantes: Solicitante[]) {
    for (const solicitante of solicitantes) {
      this.almacen.set(solicitante.id.valor, solicitante);
    }
  }

  buscarPorId(id: SolicitanteId): Promise<Solicitante | null> {
    return Promise.resolve(this.almacen.get(id.valor) ?? null);
  }

  guardar(solicitante: Solicitante): Promise<void> {
    this.guardados += 1;
    this.almacen.set(solicitante.id.valor, solicitante);
    return Promise.resolve();
  }
}

export class RepositorioSolicitudesEnMemoria implements SolicitudPrestamoRepository {
  private readonly almacen = new Map<string, SolicitudPrestamo>();
  /** Número de escrituras recibidas. */
  guardados = 0;

  buscarPorSolicitanteYAnio(
    solicitanteId: SolicitanteId,
    anio: number,
  ): Promise<SolicitudPrestamo | null> {
    return Promise.resolve(
      this.almacen.get(RepositorioSolicitudesEnMemoria.clave(solicitanteId, anio)) ?? null,
    );
  }

  guardar(solicitud: SolicitudPrestamo): Promise<void> {
    this.guardados += 1;
    this.almacen.set(
      RepositorioSolicitudesEnMemoria.clave(solicitud.solicitanteId, solicitud.anio),
      solicitud,
    );
    return Promise.resolve();
  }

  /** Clave del registro: (solicitante, año), tal como exige RN-06. */
  private static clave(solicitanteId: SolicitanteId, anio: number): string {
    return `${solicitanteId.valor}:${anio}`;
  }
}
