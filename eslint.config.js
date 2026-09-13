const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

/**
 * Configuración de ESLint (flat config, CommonJS).
 *
 * Además del linting habitual, aquí se **automatiza la regla de dependencias**
 * de Clean Architecture (CLAUDE.md §2.2 y §4.1): que el dominio no conozca
 * frameworks no es una convención que se recuerda, es un error de lint.
 */
module.exports = tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },

  /*
   * El dominio no depende de nadie: ni de frameworks, ni de ORM, ni de HTTP,
   * ni de las capas externas. Es la regla de oro nº 2 del proyecto.
   */
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'typeorm', 'express', '@nestjs/*/**'],
              message:
                'El dominio no puede importar frameworks ni ORM (CLAUDE.md §2.2). Define un puerto y ponle un adaptador en infraestructura.',
            },
            {
              group: ['**/application/**', '**/infrastructure/**', '**/presentation/**'],
              message:
                'La regla de dependencias apunta hacia adentro: el dominio no conoce las capas externas (CLAUDE.md §4.1).',
            },
          ],
        },
      ],
    },
  },

  /*
   * La aplicación depende solo del dominio y de puertos (interfaces), nunca de
   * implementaciones concretas de infraestructura ni de la capa HTTP.
   */
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['typeorm', '@nestjs/typeorm', 'express'],
              message:
                'La aplicación orquesta casos de uso contra puertos; el ORM y HTTP viven en infraestructura y presentación (CLAUDE.md §4.2).',
            },
            {
              group: ['**/infrastructure/**', '**/presentation/**'],
              message:
                'La aplicación depende de interfaces, no de adaptadores concretos (CLAUDE.md §5-D).',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  prettier,
);
