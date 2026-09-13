import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Esquema de la tabla `credenciales` (CU-A01, CU-A02).
 *
 * Vive **sólo en infraestructura** y no tiene contraparte en el dominio: el
 * negocio no sabe qué es un hash ni un correo de acceso (CLAUDE.md §9). El
 * dominio conoce `Solicitante` y `TipoUsuario`; la identidad con la que alguien
 * entra al sistema es un detalle del adaptador de autenticación.
 */
@Entity('credenciales')
export class CredencialesOrmEntity {
  /** Correo normalizado en minúsculas; es la clave con la que se inicia sesión. */
  @PrimaryColumn({ type: 'varchar', length: 320 })
  correo!: string;

  @Index('IDX_credenciales_solicitante', { unique: true })
  @Column({ name: 'solicitante_id', type: 'uuid' })
  solicitanteId!: string;

  /**
   * Contraseña derivada con **scrypt**, en el formato `scrypt$<sal>$<derivada>`.
   *
   * Se usa `scrypt` de `node:crypto` —parte de la biblioteca estándar— en vez de
   * una dependencia nativa: es una función de derivación con coste de memoria,
   * pensada justamente para contraseñas, y evita añadir compilación nativa al
   * proyecto. La sal es distinta por usuario y la comparación es en tiempo
   * constante.
   */
  @Column({ name: 'hash_contrasena', type: 'varchar', length: 255 })
  hashContrasena!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
