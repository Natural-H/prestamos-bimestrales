import 'reflect-metadata';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { DataSource } from 'typeorm';
import { opcionesDeConexion } from '../../config/data-source';
import { CredencialesOrmEntity } from './entities/credenciales.orm-entity';
import { SolicitanteOrmEntity } from './entities/solicitante.orm-entity';

const derivar = promisify(scrypt) as (c: string, s: Buffer, l: number) => Promise<Buffer>;

/**
 * Datos de prueba reproducibles (TR-13).
 *
 * Crea tres usuarios que cubren los tres estados que importan para probar la
 * API con la colección Bruno:
 *
 * | Usuario | Para qué sirve |
 * |---|---|
 * | `alumno@tecnm.mx` | Rango con tope: elige el monto (RN-09) |
 * | `trabajador@tecnm.mx` | Préstamo calculado: 16 % y 32 % de $12,345.67 (RN-08, RN-10) |
 * | `trabajador-sin-sueldo@tecnm.mx` | Provoca `SUELDO_BASE_NO_REGISTRADO` (EC-06) |
 *
 * Es **idempotente**: si los correos ya existen, no hace nada. Así se puede
 * ejecutar tantas veces como haga falta sin ensuciar la base.
 *
 * Contraseña de los tres: `prestamos2026`.
 */
async function sembrar(): Promise<void> {
  const dataSource = await new DataSource(opcionesDeConexion()).initialize();

  const solicitantes = dataSource.getRepository(SolicitanteOrmEntity);
  const credenciales = dataSource.getRepository(CredencialesOrmEntity);

  const usuarios = [
    { correo: 'alumno@tecnm.mx', tipoUsuario: 'alumno', sueldoBase: null },
    { correo: 'trabajador@tecnm.mx', tipoUsuario: 'trabajador', sueldoBase: '12345.67' },
    { correo: 'trabajador-sin-sueldo@tecnm.mx', tipoUsuario: 'trabajador', sueldoBase: null },
  ];

  for (const usuario of usuarios) {
    if ((await credenciales.countBy({ correo: usuario.correo })) > 0) {
      console.log(`· ${usuario.correo} ya existe, se deja como está`);
      continue;
    }

    const id = randomUUID();
    await solicitantes.save(
      solicitantes.create({
        id,
        tipoUsuario: usuario.tipoUsuario,
        sueldoBase: usuario.sueldoBase,
      }),
    );

    const sal = randomBytes(16);
    const derivada = await derivar('prestamos2026', sal, 64);
    await credenciales.save(
      credenciales.create({
        correo: usuario.correo,
        solicitanteId: id,
        hashContrasena: `scrypt$${sal.toString('hex')}$${derivada.toString('hex')}`,
      }),
    );

    console.log(`✓ ${usuario.correo} (${usuario.tipoUsuario}) → ${id}`);
  }

  await dataSource.destroy();
  console.log('\nContraseña de todos los usuarios de prueba: prestamos2026');
}

void sembrar().catch((error: unknown) => {
  console.error('No se pudo sembrar la base:', error);
  process.exitCode = 1;
});
