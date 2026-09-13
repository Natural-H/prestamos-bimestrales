import { validarEnv } from '../../src/infrastructure/config/env.config';

/** Configuración mínima válida; cada prueba altera sólo lo que le interesa. */
const ENV_VALIDO = {
  PORT: '3000',
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_PORT: '5433',
  DB_USER: 'prestamos',
  DB_PASSWORD: 'prestamos',
  DB_NAME: 'prestamos_bimestrales',
  JWT_SECRET: 'un-secreto-suficientemente-largo',
  JWT_EXPIRES_IN: '3600',
};

describe('validarEnv', () => {
  it('acepta una configuración completa', () => {
    expect(() => validarEnv(ENV_VALIDO)).not.toThrow();
  });

  describe('conversión de tipos', () => {
    /*
     * Toda variable de entorno llega como TEXTO. Esta conversión depende de que
     * los campos de EnvConfig lleven anotación de tipo explícita
     * (`PORT: number = 3000`): sin ella, `emitDecoratorMetadata` escribe `Object`
     * y class-transformer no convierte nada. Es un fallo que no da la cara hasta
     * que el servicio no arranca, así que se prueba.
     */
    it('convierte a número los puertos y la expiración del token', () => {
      const config = validarEnv(ENV_VALIDO);

      expect(config.PORT).toBe(3000);
      expect(config.DB_PORT).toBe(5433);
      expect(config.JWT_EXPIRES_IN).toBe(3600);
    });

    it('aplica los valores por defecto de lo que es opcional', () => {
      const { PORT, NODE_ENV, DB_PORT, JWT_EXPIRES_IN, ...minimo } = ENV_VALIDO;

      const config = validarEnv(minimo);

      expect(config.PORT).toBe(3000);
      expect(config.NODE_ENV).toBe('development');
      expect(config.DB_PORT).toBe(5432);
      expect(config.JWT_EXPIRES_IN).toBe(3600);
    });
  });

  describe('el servicio no debe arrancar con una configuración imposible', () => {
    it('exige los datos de conexión', () => {
      const { DB_HOST, ...sinHost } = ENV_VALIDO;

      expect(() => validarEnv(sinHost)).toThrow(/DB_HOST/);
    });

    it('exige un secreto de JWT, y que no sea de juguete', () => {
      const { JWT_SECRET, ...sinSecreto } = ENV_VALIDO;

      expect(() => validarEnv(sinSecreto)).toThrow(/JWT_SECRET/);
      expect(() => validarEnv({ ...ENV_VALIDO, JWT_SECRET: 'corto' })).toThrow(
        /al menos 16 caracteres/,
      );
    });

    it('rechaza puertos fuera de rango', () => {
      expect(() => validarEnv({ ...ENV_VALIDO, PORT: '70000' })).toThrow(/PORT/);
      expect(() => validarEnv({ ...ENV_VALIDO, DB_PORT: '0' })).toThrow(/DB_PORT/);
    });

    it('rechaza un entorno que no existe', () => {
      expect(() => validarEnv({ ...ENV_VALIDO, NODE_ENV: 'produccion' })).toThrow(/NODE_ENV/);
    });

    it('enumera TODOS los problemas de golpe, no el primero', () => {
      const { DB_HOST, DB_USER, ...roto } = ENV_VALIDO;

      const mensaje = (() => {
        try {
          validarEnv({ ...roto, JWT_SECRET: 'corto' });
          return '';
        } catch (error) {
          return (error as Error).message;
        }
      })();

      // Arreglar la configuración de uno en uno, reiniciando cada vez, es la
      // clase de fricción que este mensaje existe para evitar.
      expect(mensaje).toMatch(/DB_HOST/);
      expect(mensaje).toMatch(/DB_USER/);
      expect(mensaje).toMatch(/JWT_SECRET/);
    });
  });
});
