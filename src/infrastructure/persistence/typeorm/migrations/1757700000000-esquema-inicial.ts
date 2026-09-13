import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial del microservicio.
 *
 * Migración **escrita a mano y versionada** (CLAUDE.md §8): `synchronize` está
 * desactivado incluso en desarrollo, de modo que el esquema nunca cambia por
 * sorpresa al arrancar la aplicación.
 *
 * Decisiones que el esquema hace cumplir:
 *
 * - `numeric(14,2)` para todo el dinero, nunca `float` (RN-14).
 * - `timestamptz` para los instantes y `date` para el día de la solicitud, que
 *   es un día civil del calendario del TECNM y no un instante (RN-04).
 * - `UQ_solicitud_solicitante_anio`: **un registro por usuario y año** (RN-06).
 * - `UQ_periodo_solicitud_mes`: ningún periodo duplicado dentro de un registro,
 *   ni siquiera con dos peticiones simultáneas (RN-15).
 * - `version`: columna del bloqueo optimista que usa el repositorio (TR-04).
 */
export class EsquemaInicial1757700000000 implements MigrationInterface {
  name = 'EsquemaInicial1757700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "tipo_usuario_enum" AS ENUM ('alumno', 'trabajador')`);
    await queryRunner.query(`CREATE TYPE "tipo_periodo_enum" AS ENUM ('bimestre', 'diciembre')`);

    await queryRunner.query(`
      CREATE TABLE "solicitantes" (
        "id" uuid NOT NULL,
        "tipo_usuario" "tipo_usuario_enum" NOT NULL,
        "sueldo_base" numeric(14,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_solicitantes" PRIMARY KEY ("id"),
        CONSTRAINT "CK_sueldo_base_positivo" CHECK ("sueldo_base" IS NULL OR "sueldo_base" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "credenciales" (
        "correo" character varying(320) NOT NULL,
        "solicitante_id" uuid NOT NULL,
        "hash_contrasena" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credenciales" PRIMARY KEY ("correo"),
        CONSTRAINT "FK_credenciales_solicitante" FOREIGN KEY ("solicitante_id")
          REFERENCES "solicitantes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_credenciales_solicitante" ON "credenciales" ("solicitante_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "solicitudes_prestamo" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "solicitante_id" uuid NOT NULL,
        "anio" integer NOT NULL,
        "version" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_solicitudes_prestamo" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_solicitud_solicitante_anio" UNIQUE ("solicitante_id", "anio"),
        CONSTRAINT "FK_solicitud_solicitante" FOREIGN KEY ("solicitante_id")
          REFERENCES "solicitantes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_solicitud_solicitante" ON "solicitudes_prestamo" ("solicitante_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "periodos_solicitados" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "solicitud_id" uuid NOT NULL,
        "tipo" "tipo_periodo_enum" NOT NULL,
        "mes_referencia" integer NOT NULL,
        "anio" integer NOT NULL,
        "monto_capturado" numeric(14,2),
        "fecha_solicitud" date NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_periodos_solicitados" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_periodo_solicitud_mes" UNIQUE ("solicitud_id", "mes_referencia"),
        CONSTRAINT "FK_periodo_solicitud" FOREIGN KEY ("solicitud_id")
          REFERENCES "solicitudes_prestamo"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_mes_referencia_valido" CHECK ("mes_referencia" IN (2, 4, 6, 8, 10, 12)),
        CONSTRAINT "CK_monto_capturado_positivo"
          CHECK ("monto_capturado" IS NULL OR "monto_capturado" > 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "periodos_solicitados"`);
    await queryRunner.query(`DROP TABLE "solicitudes_prestamo"`);
    await queryRunner.query(`DROP TABLE "credenciales"`);
    await queryRunner.query(`DROP TABLE "solicitantes"`);
    await queryRunner.query(`DROP TYPE "tipo_periodo_enum"`);
    await queryRunner.query(`DROP TYPE "tipo_usuario_enum"`);
  }
}
