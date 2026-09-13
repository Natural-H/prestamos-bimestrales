import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Esquema de la tabla `solicitantes`.
 *
 * **No es la entidad de dominio** `Solicitante`, aunque se le parezca: es el
 * esquema de la base de datos, y se conectan con un mapper explícito
 * (CLAUDE.md §7.8). Reutilizar esta clase como entidad de dominio ataría las
 * reglas de negocio a TypeORM, que es justo lo que la arquitectura evita.
 */
@Entity('solicitantes')
export class SolicitanteOrmEntity {
  /** Identificador generado por la aplicación (`IdGeneratorPort`), no por la base. */
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'tipo_usuario', type: 'enum', enum: ['alumno', 'trabajador'] })
  tipoUsuario!: string;

  /**
   * Sueldo base vigente del trabajador (RN-13).
   *
   * `numeric(14,2)` y nunca `float`/`double` (RN-14, CLAUDE.md §7.4). Es nulo
   * para los alumnos —que no tienen sueldo— y para el trabajador que aún no lo
   * ha capturado.
   *
   * El driver de PostgreSQL devuelve `numeric` como **cadena** precisamente para
   * no perder precisión, y así es como lo consume el mapper: nunca se convierte
   * a `number` por el camino.
   */
  @Column({ name: 'sueldo_base', type: 'numeric', precision: 14, scale: 2, nullable: true })
  sueldoBase!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
