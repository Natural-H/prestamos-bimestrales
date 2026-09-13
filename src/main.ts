import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Arranque del microservicio.
 *
 * La validación de DTOs y el filtro de excepciones **no se registran aquí**:
 * están declarados en `AppModule` con `APP_PIPE` y `APP_FILTER`, para que puedan
 * recibir inyección de dependencias y para que el cableado esté todo en un solo
 * sitio.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Cierra la conexión a Postgres de forma ordenada al recibir SIGTERM.
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const puerto = config.getOrThrow<number>('PORT');

  await app.listen(puerto);
  new Logger('Bootstrap').log(`Préstamos bimestrales escuchando en http://localhost:${puerto}`);
}

void bootstrap();
