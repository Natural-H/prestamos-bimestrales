/**
 * Configuración de las pruebas de **integración**.
 *
 * A diferencia de las unitarias, éstas **sí necesitan PostgreSQL levantado**
 * (`npm run db:up` y `npm run migration:run`): existen precisamente para
 * verificar lo que un doble en memoria no puede demostrar —el bloqueo optimista
 * del repositorio (RN-15) y el mapeo entre las filas y el agregado—.
 *
 * Van en un comando aparte para que `npm test` siga corriendo sin base de datos,
 * como exige la disciplina del proyecto: si una regla de negocio necesitara
 * Postgres para probarse, estaría mal ubicada.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup.ts'],
  roots: ['<rootDir>/test'],
  testRegex: '.*\.int-spec\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Abrir la conexion y jugar con transacciones concurrentes es mas lento que
  // instanciar objetos en memoria.
  testTimeout: 30000,
};
