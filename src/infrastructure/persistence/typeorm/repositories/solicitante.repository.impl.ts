import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solicitante } from '../../../../domain/entities/solicitante.entity';
import { SolicitanteRepository } from '../../../../domain/repositories/solicitante.repository';
import { Monto } from '../../../../domain/value-objects/monto';
import { SolicitanteId } from '../../../../domain/value-objects/solicitante-id';
import { SueldoBase } from '../../../../domain/value-objects/sueldo-base';
import { tipoUsuarioDesde } from '../../../../domain/value-objects/tipo-usuario';
import { SolicitanteOrmEntity } from '../entities/solicitante.orm-entity';

/**
 * Adaptador TypeORM del puerto {@link SolicitanteRepository}.
 *
 * El mapeo es corto pero hace dos cosas que importan:
 *
 * - Valida el `tipo_usuario` con `tipoUsuarioDesde` en vez de confiar en la
 *   columna: si un día hay un valor corrupto, se convierte en un error explícito
 *   en la frontera (EC-20) y no en un cálculo silenciosamente equivocado.
 * - Trata el sueldo como **cadena** en los dos sentidos. El driver devuelve
 *   `numeric` en cadena para no perder precisión, y `Monto` la consume tal cual
 *   (RN-14).
 */
@Injectable()
export class SolicitanteRepositoryImpl implements SolicitanteRepository {
  constructor(
    @InjectRepository(SolicitanteOrmEntity)
    private readonly repositorio: Repository<SolicitanteOrmEntity>,
  ) {}

  async buscarPorId(id: SolicitanteId): Promise<Solicitante | null> {
    const fila = await this.repositorio.findOne({ where: { id: id.valor } });
    if (fila === null) {
      return null;
    }

    return Solicitante.reconstituir(
      SolicitanteId.de(fila.id),
      tipoUsuarioDesde(fila.tipoUsuario),
      fila.sueldoBase === null ? null : SueldoBase.de(Monto.desdePesos(fila.sueldoBase)),
    );
  }

  async guardar(solicitante: Solicitante): Promise<void> {
    await this.repositorio.save(
      this.repositorio.create({
        id: solicitante.id.valor,
        tipoUsuario: solicitante.tipoUsuario,
        sueldoBase: solicitante.sueldoBase?.monto.aCadena() ?? null,
      }),
    );
  }
}
