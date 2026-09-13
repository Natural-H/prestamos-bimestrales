import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Repository } from 'typeorm';
import { CredencialesPort } from '../../application/ports/credenciales.port';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { CredencialesOrmEntity } from '../persistence/typeorm/entities/credenciales.orm-entity';

const derivar = promisify(scrypt) as (
  contrasena: string,
  sal: Buffer,
  longitud: number,
) => Promise<Buffer>;

/**
 * Adaptador del puerto {@link CredencialesPort}.
 *
 * ## Por qué scrypt de la biblioteca estándar
 *
 * `node:crypto` trae `scrypt`, una función de derivación de claves con coste de
 * memoria diseñada precisamente para contraseñas. Evita añadir una dependencia
 * nativa (`bcrypt`, `argon2`) que habría que compilar en cada máquina, y no
 * rompe la regla de CommonJS del proyecto (CLAUDE.md §7.2).
 *
 * Cada contraseña lleva su **propia sal aleatoria**, y la comparación es en
 * **tiempo constante** (`timingSafeEqual`) para no filtrar información por la
 * duración de la respuesta.
 *
 * Todo esto vive aquí y no se asoma al puerto: la aplicación sólo sabe
 * "registrar" y "verificar" (CLAUDE.md §9).
 */
@Injectable()
export class CredencialesAdapter implements CredencialesPort {
  private static readonly LONGITUD_CLAVE = 64;
  private static readonly LONGITUD_SAL = 16;
  private static readonly ALGORITMO = 'scrypt';

  constructor(
    @InjectRepository(CredencialesOrmEntity)
    private readonly repositorio: Repository<CredencialesOrmEntity>,
  ) {}

  async existeCorreo(correo: string): Promise<boolean> {
    return (await this.repositorio.countBy({ correo: correo.toLowerCase() })) > 0;
  }

  async registrar(solicitanteId: SolicitanteId, correo: string, contrasena: string): Promise<void> {
    const sal = randomBytes(CredencialesAdapter.LONGITUD_SAL);
    const derivada = await derivar(contrasena, sal, CredencialesAdapter.LONGITUD_CLAVE);

    await this.repositorio.save(
      this.repositorio.create({
        correo: correo.toLowerCase(),
        solicitanteId: solicitanteId.valor,
        hashContrasena: `${CredencialesAdapter.ALGORITMO}$${sal.toString('hex')}$${derivada.toString('hex')}`,
      }),
    );
  }

  async verificar(correo: string, contrasena: string): Promise<SolicitanteId | null> {
    const fila = await this.repositorio.findOne({ where: { correo: correo.toLowerCase() } });
    if (fila === null) {
      return null;
    }

    const [algoritmo, salHex, derivadaHex] = fila.hashContrasena.split('$');
    if (algoritmo !== CredencialesAdapter.ALGORITMO || !salHex || !derivadaHex) {
      return null;
    }

    const esperada = Buffer.from(derivadaHex, 'hex');
    const calculada = await derivar(contrasena, Buffer.from(salHex, 'hex'), esperada.length);

    return timingSafeEqual(esperada, calculada) ? SolicitanteId.de(fila.solicitanteId) : null;
  }
}
