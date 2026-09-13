import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Esquema de la configuración de entorno (CLAUDE.md §11).
 *
 * Se valida **al arrancar**, no la primera vez que se usa cada variable: un
 * secreto ausente debe impedir que el servicio levante, no aparecer como un
 * `500` a mitad de la tarde. Ningún valor tiene valor por defecto aquí salvo los
 * inocuos; el secreto del JWT jamás está hardcodeado (CLAUDE.md §9).
 *
 * **Los tipos van anotados explícitamente** (`PORT: number = 3000`) aunque el
 * inicializador ya los delate: `emitDecoratorMetadata` sólo escribe el tipo real
 * cuando hay anotación, y sin ella `class-transformer` recibe `Object` y no
 * convierte la cadena del entorno a número. Toda variable de entorno llega como
 * texto, así que esa conversión es imprescindible.
 */
export class EnvConfig {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  /** Secreto de firma del JWT (RN-17). Largo mínimo para que no se cuele uno de juguete. */
  @IsString()
  @MinLength(16, { message: 'JWT_SECRET debe tener al menos 16 caracteres.' })
  JWT_SECRET!: string;

  /** Validez del token en segundos. */
  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN: number = 3600;
}

/**
 * Valida y convierte las variables de entorno. Lo usa `ConfigModule` en
 * `app.module.ts`.
 *
 * @throws Si falta alguna variable obligatoria o alguna tiene un valor
 *   imposible; el mensaje lista **todos** los problemas, para no arreglarlos de
 *   uno en uno.
 */
export function validarEnv(configuracion: Record<string, unknown>): EnvConfig {
  const config = plainToInstance(EnvConfig, configuracion, { enableImplicitConversion: true });

  const errores = validateSync(config, { skipMissingProperties: false });
  if (errores.length > 0) {
    const detalle = errores
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Configuración de entorno inválida:\n  - ${detalle}`);
  }

  return config;
}
