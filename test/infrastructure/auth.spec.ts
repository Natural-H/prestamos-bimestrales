import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { CredencialesAdapter } from '../../src/infrastructure/auth/credenciales.adapter';
import { JwtStrategy } from '../../src/infrastructure/auth/jwt.strategy';
import { JwtTokenIssuerAdapter } from '../../src/infrastructure/auth/jwt-token-issuer.adapter';
import { CredencialesOrmEntity } from '../../src/infrastructure/persistence/typeorm/entities/credenciales.orm-entity';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';

const SECRETO = 'un-secreto-suficientemente-largo';

/** `ConfigService` de mentira: devuelve lo que le pidan de un mapa fijo. */
const configuracion = (valores: Record<string, unknown>): ConfigService =>
  ({ getOrThrow: (clave: string) => valores[clave] }) as unknown as ConfigService;

/**
 * Doble del repositorio de TypeORM.
 *
 * Permite probar **la criptografía de verdad** —scrypt, la sal y la comparación
 * en tiempo constante— sin levantar Postgres. Que las filas se guarden bien es
 * otra cosa, y eso lo cubren las pruebas de integración.
 */
class RepositorioCredencialesFalso {
  readonly filas = new Map<string, CredencialesOrmEntity>();

  create(datos: Partial<CredencialesOrmEntity>): CredencialesOrmEntity {
    return datos as CredencialesOrmEntity;
  }

  save(fila: CredencialesOrmEntity): Promise<CredencialesOrmEntity> {
    this.filas.set(fila.correo, fila);
    return Promise.resolve(fila);
  }

  countBy(criterio: { correo: string }): Promise<number> {
    return Promise.resolve(this.filas.has(criterio.correo) ? 1 : 0);
  }

  findOne(opciones: { where: { correo: string } }): Promise<CredencialesOrmEntity | null> {
    return Promise.resolve(this.filas.get(opciones.where.correo) ?? null);
  }
}

const adaptadorDeCredenciales = () => {
  const repositorio = new RepositorioCredencialesFalso();
  return {
    repositorio,
    adaptador: new CredencialesAdapter(repositorio as unknown as Repository<CredencialesOrmEntity>),
  };
};

describe('CredencialesAdapter', () => {
  const ID = SolicitanteId.de('11111111-1111-4111-8111-111111111111');

  it('registra unas credenciales y las verifica', async () => {
    const { adaptador } = adaptadorDeCredenciales();

    await adaptador.registrar(ID, 'alumno@tecnm.mx', 'prestamos2026');

    await expect(adaptador.verificar('alumno@tecnm.mx', 'prestamos2026')).resolves.toEqual(ID);
  });

  it('nunca guarda la contraseña en claro', async () => {
    const { adaptador, repositorio } = adaptadorDeCredenciales();

    await adaptador.registrar(ID, 'alumno@tecnm.mx', 'prestamos2026');

    const guardado = repositorio.filas.get('alumno@tecnm.mx')?.hashContrasena ?? '';
    expect(guardado).not.toContain('prestamos2026');
    expect(guardado).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it('da un hash distinto a dos usuarios con la misma contraseña', async () => {
    const { adaptador, repositorio } = adaptadorDeCredenciales();
    const otroId = SolicitanteId.de('22222222-2222-4222-8222-222222222222');

    await adaptador.registrar(ID, 'uno@tecnm.mx', 'la-misma-contrasena');
    await adaptador.registrar(otroId, 'dos@tecnm.mx', 'la-misma-contrasena');

    // La sal es propia de cada usuario: sin ella, dos hashes iguales delatarían
    // que dos personas comparten contraseña.
    expect(repositorio.filas.get('uno@tecnm.mx')?.hashContrasena).not.toBe(
      repositorio.filas.get('dos@tecnm.mx')?.hashContrasena,
    );
  });

  it('rechaza la contraseña equivocada y el correo inexistente, sin distinguirlos', async () => {
    const { adaptador } = adaptadorDeCredenciales();
    await adaptador.registrar(ID, 'alumno@tecnm.mx', 'prestamos2026');

    // Ambos devuelven null: el caso de uso los traduce al mismo error, para no
    // revelar qué correos están dados de alta.
    await expect(adaptador.verificar('alumno@tecnm.mx', 'otra-cosa')).resolves.toBeNull();
    await expect(adaptador.verificar('fantasma@tecnm.mx', 'prestamos2026')).resolves.toBeNull();
  });

  it('trata el correo sin distinguir mayúsculas', async () => {
    const { adaptador } = adaptadorDeCredenciales();

    await adaptador.registrar(ID, 'Alumno@TecNM.mx', 'prestamos2026');

    await expect(adaptador.existeCorreo('ALUMNO@TECNM.MX')).resolves.toBe(true);
    await expect(adaptador.verificar('alumno@tecnm.mx', 'prestamos2026')).resolves.toEqual(ID);
  });

  it('no encuentra un correo que no se ha registrado', async () => {
    const { adaptador } = adaptadorDeCredenciales();

    await expect(adaptador.existeCorreo('nadie@tecnm.mx')).resolves.toBe(false);
  });
});

describe('JwtTokenIssuerAdapter', () => {
  const jwt = new JwtService({ secret: SECRETO });
  const adaptador = new JwtTokenIssuerAdapter(
    jwt,
    configuracion({ JWT_EXPIRES_IN: 3600, JWT_SECRET: SECRETO }),
  );

  it('emite un token con el identificador y el rol del solicitante (RN-17)', async () => {
    const id = SolicitanteId.de('33333333-3333-4333-8333-333333333333');

    const emitido = await adaptador.emitir(id, TipoUsuario.TRABAJADOR);

    expect(emitido.expiraEnSegundos).toBe(3600);
    const contenido = jwt.verify<{ sub: string; rol: string }>(emitido.token, { secret: SECRETO });
    expect(contenido.sub).toBe(id.valor);
    expect(contenido.rol).toBe('trabajador');
  });

  it('firma con el secreto de la configuración: otro secreto no lo valida', async () => {
    const emitido = await adaptador.emitir(SolicitanteId.de('id-1'), TipoUsuario.ALUMNO);

    expect(() => {
      jwt.verify(emitido.token, { secret: 'otro-secreto-distinto-largo' });
    }).toThrow();
  });
});

describe('JwtStrategy', () => {
  const estrategia = new JwtStrategy(configuracion({ JWT_SECRET: SECRETO }));

  it('traduce el payload a conceptos de dominio', () => {
    expect(estrategia.validate({ sub: 'usuario-1', rol: 'trabajador' })).toEqual({
      id: 'usuario-1',
      tipoUsuario: TipoUsuario.TRABAJADOR,
    });
  });

  it('rechaza un token cuyo rol no existe, antes de que llegue a los guards', () => {
    // Un token firmado pero con un rol inventado no debe colarse hasta el
    // dominio: se corta aquí, en la frontera.
    expect(() => estrategia.validate({ sub: 'usuario-1', rol: 'administrador' })).toThrow(
      UnauthorizedException,
    );
  });
});
