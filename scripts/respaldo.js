/**
 * Crea un respaldo completo del repositorio en **un solo archivo**.
 *
 * `git bundle` empaqueta todo el historial —commits, ramas y etiquetas— en un
 * fichero que se puede copiar a una USB o a otro disco y del que se puede
 * clonar como si fuera un repositorio remoto. Es el equivalente offline de un
 * `push`, para un proyecto que por decisión del equipo no se sube a internet.
 *
 * El archivo se escribe **fuera del repositorio**, en la carpeta que lo
 * contiene, por dos razones: no ensucia el árbol de trabajo y se encuentra sin
 * buscar cuando hay prisa.
 *
 * Uso: `npm run respaldo`
 *
 * Para restaurarlo en otra máquina:
 *   git clone prestamos-bimestrales-AAAAMMDD.bundle prestamos-bimestrales
 *
 * Ojo: el respaldo **no incluye** `node_modules` ni el `.env`, porque no están
 * versionados. En una máquina sin internet hay que llevarlos aparte.
 */
const { execSync } = require('node:child_process');
const { statSync } = require('node:fs');
const { basename, join, resolve } = require('node:path');

const RAIZ = resolve(__dirname, '..');
const DESTINO = resolve(RAIZ, '..');

const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const archivo = join(DESTINO, `${basename(RAIZ)}-${fecha}.bundle`);

try {
  // --all incluye todas las ramas y etiquetas, no sólo la actual.
  execSync(`git bundle create "${archivo}" --all`, { cwd: RAIZ, stdio: 'pipe' });

  // Un respaldo sin verificar es una suposición: git comprueba que el paquete
  // esté completo y que se pueda clonar de él.
  execSync(`git bundle verify "${archivo}"`, { cwd: RAIZ, stdio: 'pipe' });

  const tamanio = (statSync(archivo).size / 1024).toFixed(1);
  console.log(`Respaldo verificado: ${archivo} (${tamanio} KB)`);
  console.log('Cópialo a una USB o a otro disco: en el mismo disco no protege de nada.');
} catch (error) {
  console.error('No se pudo crear el respaldo:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
