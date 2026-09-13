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
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
  coverageDirectory: 'coverage',
};
