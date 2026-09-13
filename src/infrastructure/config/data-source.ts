import { config as cargarEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { CredencialesOrmEntity } from '../persistence/typeorm/entities/credenciales.orm-entity';
import { SolicitanteOrmEntity } from '../persistence/typeorm/entities/solicitante.orm-entity';
import {
  PeriodoSolicitadoOrmEntity,
  SolicitudPrestamoOrmEntity,
} from '../persistence/typeorm/entities/solicitud-prestamo.orm-entity';

cargarEnv();

/**
 * Opciones de conexión compartidas por la aplicación y por el CLI de TypeORM.
 *
 * `synchronize: false` **siempre**, incluso en desarrollo (CLAUDE.md §8): el
 * esquema se versiona en migraciones y no se deduce de las entidades. Un
 * `synchronize: true` "sólo mientras desarrollo" es la forma habitual de perder
 * datos y de que el esquema real y el versionado dejen de coincidir.
 */
export const opcionesDeConexion = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    SolicitanteOrmEntity,
    SolicitudPrestamoOrmEntity,
    PeriodoSolicitadoOrmEntity,
    CredencialesOrmEntity,
  ],
  migrations: [`${__dirname}/../persistence/typeorm/migrations/*.{ts,js}`],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * DataSource que usa el CLI de TypeORM (`npm run migration:run`).
 *
 * La aplicación no usa esta instancia: recibe la suya de `TypeOrmModule`, para
 * que el ciclo de vida de la conexión lo gestione Nest.
 */
export default new DataSource(opcionesDeConexion());
