/**
 * Configuración de Jest para las pruebas unitarias de dominio y aplicación.
 *
 * Estas pruebas NO levantan Postgres ni NestJS (CLAUDE.md §10): si una regla de
 * negocio necesitara la base de datos para probarse, estaría mal ubicada.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  // Las de integración van aparte (jest.integration.config.js): necesitan Postgres.
  testPathIgnorePatterns: ['\\.int-spec\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/infrastructure/**/*.ts',
    // Se excluye lo que no tiene logica que probar o que solo se ejercita
    // levantando el servicio: declaraciones de esquema, migraciones y scripts.
    '!src/infrastructure/persistence/typeorm/entities/**',
    '!src/infrastructure/persistence/typeorm/migrations/**',
    '!src/infrastructure/persistence/typeorm/seed.ts',
    '!src/infrastructure/config/data-source.ts',
  ],
  coverageDirectory: 'coverage',
};
