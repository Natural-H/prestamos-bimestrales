import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SolicitanteOrmEntity } from './solicitante.orm-entity';

/**
 * Esquema de la tabla `solicitudes_prestamo`: el registro único por usuario y
 * año (RN-06).
 *
 * ## El `id` es un detalle de persistencia
 *
 * El agregado de dominio se identifica por **(solicitante, año)** y no tiene
 * `id`. Esta tabla sí lo tiene, sólo para que las claves foráneas de los
 * periodos sean simples. Ese `id` **nunca cruza al dominio**: el mapper no lo
 * traduce, y el repositorio localiza el registro por el índice único, que es la
 * identidad real.
 */
@Entity('solicitudes_prestamo')
@Unique('UQ_solicitud_solicitante_anio', ['solicitanteId', 'anio'])
export class SolicitudPrestamoOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_solicitud_solicitante')
  @Column({ name: 'solicitante_id', type: 'uuid' })
  solicitanteId!: string;

  @ManyToOne(() => SolicitanteOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitante_id' })
  solicitante!: SolicitanteOrmEntity;

  @Column({ type: 'int' })
  anio!: number;

  /**
   * Versión para el **bloqueo optimista** (RN-15, TR-04).
   *
   * No se usa `@VersionColumn` porque el repositorio la compara y la incrementa
   * él mismo en un `UPDATE ... WHERE version = :version`: así una escritura
   * simultánea afecta a cero filas y se convierte en un error de dominio
   * explícito, en vez de sobrescribir en silencio.
   */
  @Column({ type: 'int', default: 0 })
  version!: number;

  @OneToMany(() => PeriodoSolicitadoOrmEntity, (periodo) => periodo.solicitud, { cascade: false })
  periodos!: PeriodoSolicitadoOrmEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Esquema de la tabla `periodos_solicitados`: cada periodo acumulado en el
 * registro (RN-06).
 *
 * El índice único `(solicitud_id, mes_referencia)` es la **defensa de último
 * recurso** contra duplicados por solicitudes simultáneas (RN-15): el agregado
 * ya impide duplicar en memoria, pero dos procesos concurrentes no comparten esa
 * memoria y sí comparten esta restricción.
 */
@Entity('periodos_solicitados')
@Unique('UQ_periodo_solicitud_mes', ['solicitudId', 'mesReferencia'])
export class PeriodoSolicitadoOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'solicitud_id', type: 'uuid' })
  solicitudId!: string;

  @ManyToOne(() => SolicitudPrestamoOrmEntity, (solicitud) => solicitud.periodos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud!: SolicitudPrestamoOrmEntity;

  /** `bimestre` o `diciembre`: diciembre no es un bimestre (RN-11). */
  @Column({ type: 'enum', enum: ['bimestre', 'diciembre'] })
  tipo!: string;

  /** Mes de referencia en base 1: 2, 4, 6, 8, 10 o 12 (RN-02, RN-11). */
  @Column({ name: 'mes_referencia', type: 'int' })
  mesReferencia!: number;

  @Column({ type: 'int' })
  anio!: number;

  /**
   * Monto **capturado por el alumno** (RN-09), como `numeric` en cadena.
   *
   * Es nulo para el trabajador y no es un olvido: su monto no se persiste, se
   * deriva del sueldo vigente en cada consulta (RN-20). Guardarlo aquí crearía
   * la posibilidad de que la base quedara desincronizada del sueldo.
   */
  @Column({ name: 'monto_capturado', type: 'numeric', precision: 14, scale: 2, nullable: true })
  montoCapturado!: string | null;

  /** Día de la solicitud en la zona del TECNM; `date` porque el negocio razona en días (RN-04). */
  @Column({ name: 'fecha_solicitud', type: 'date' })
  fechaSolicitud!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
