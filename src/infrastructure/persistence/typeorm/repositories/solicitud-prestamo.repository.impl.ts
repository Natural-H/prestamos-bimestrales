import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { SolicitudPrestamo } from '../../../../domain/entities/solicitud-prestamo.entity';
import { ConflictoDeConcurrenciaError } from '../../../../domain/errors/conflicto-de-concurrencia.error';
import { SolicitudPrestamoRepository } from '../../../../domain/repositories/solicitud-prestamo.repository';
import { SolicitanteId } from '../../../../domain/value-objects/solicitante-id';
import {
  PeriodoSolicitadoOrmEntity,
  SolicitudPrestamoOrmEntity,
} from '../entities/solicitud-prestamo.orm-entity';
import { SolicitudPrestamoOrmMapper } from '../mappers/solicitud-prestamo.orm-mapper';

/**
 * Adaptador TypeORM del puerto {@link SolicitudPrestamoRepository}.
 *
 * ## Cómo cumple el contrato del puerto
 *
 * - **Atomicidad** (RN-18): todo `guardar` ocurre dentro de una transacción, así
 *   que el registro y sus periodos se persisten juntos o no se persiste nada.
 * - **Concurrencia** (RN-15): el `UPDATE` lleva `WHERE version = :version`. Si
 *   otra operación tocó el registro entretanto, afecta a **cero filas** y esto
 *   se convierte en `ConflictoDeConcurrenciaError`, que el filtro traduce a
 *   `409`. Sin esa condición, la segunda escritura pisaría a la primera en
 *   silencio, que es exactamente lo que el planteamiento §4 prohíbe.
 * - **Sin duplicados**: los periodos se insertan con `ON CONFLICT DO NOTHING`
 *   sobre el índice único `(solicitud_id, mes_referencia)`. El agregado ya
 *   garantiza la unicidad en memoria; esto la garantiza entre procesos, que no
 *   comparten memoria.
 *
 * El agregado es **append-only** —no hay cancelación (RN-16)—, así que guardar
 * consiste en insertar lo que falte, nunca en borrar ni actualizar periodos.
 */
@Injectable()
export class SolicitudPrestamoRepositoryImpl implements SolicitudPrestamoRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async buscarPorSolicitanteYAnio(
    solicitanteId: SolicitanteId,
    anio: number,
  ): Promise<SolicitudPrestamo | null> {
    const fila = await this.dataSource.getRepository(SolicitudPrestamoOrmEntity).findOne({
      where: { solicitanteId: solicitanteId.valor, anio },
      relations: { periodos: true },
    });

    if (fila === null) {
      return null;
    }

    return SolicitudPrestamoOrmMapper.aDominio(
      solicitanteId.valor,
      anio,
      fila.periodos ?? [],
      fila.version,
    );
  }

  async guardar(solicitud: SolicitudPrestamo): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const solicitudId = await this.asegurarRegistro(manager, solicitud);

      const filas = solicitud.periodosSolicitados.map((periodo) =>
        SolicitudPrestamoOrmMapper.aFila(solicitudId, periodo),
      );

      if (filas.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(PeriodoSolicitadoOrmEntity)
          .values(filas)
          .orIgnore() // ON CONFLICT DO NOTHING: la unicidad la impone el índice (RN-15).
          .execute();
      }
    });
  }

  /**
   * Crea el registro del año si no existe, o comprueba y avanza su versión si ya
   * existe.
   *
   * @returns El `id` de la fila, que es un detalle de persistencia y no sale de
   *   esta clase.
   * @throws {ConflictoDeConcurrenciaError} si otra operación modificó el
   *   registro desde que se cargó (RN-15).
   */
  private async asegurarRegistro(
    manager: EntityManager,
    solicitud: SolicitudPrestamo,
  ): Promise<string> {
    const repositorio = manager.getRepository(SolicitudPrestamoOrmEntity);
    const existente = await repositorio.findOne({
      where: { solicitanteId: solicitud.solicitanteId.valor, anio: solicitud.anio },
      select: { id: true, version: true },
    });

    if (existente === null) {
      const insertada = await repositorio.save(
        repositorio.create({
          solicitanteId: solicitud.solicitanteId.valor,
          anio: solicitud.anio,
          version: 1,
        }),
      );
      return insertada.id;
    }

    const resultado = await repositorio
      .createQueryBuilder()
      .update(SolicitudPrestamoOrmEntity)
      .set({ version: () => 'version + 1' })
      .where('id = :id AND version = :version', {
        id: existente.id,
        version: solicitud.version,
      })
      .execute();

    if (resultado.affected === 0) {
      throw new ConflictoDeConcurrenciaError(
        `de ${solicitud.solicitanteId.valor} para ${solicitud.anio}`,
      );
    }

    return existente.id;
  }
}
