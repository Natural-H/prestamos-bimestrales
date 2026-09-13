/**
 * Regenera las imágenes de los diagramas de `docs/diagramas/`.
 *
 * Cada diagrama tiene su fuente `.mmd` versionada junto a la imagen. Este script
 * las vuelve a exportar a PNG para que `docs/arquitectura.md` se vea en
 * cualquier visor, sin depender de que quien lo abra tenga un renderizador de
 * Mermaid instalado.
 *
 * ## Necesita internet la primera vez
 *
 * Usa `mermaid-cli` a través de `npx`, y **no** está en `devDependencies` a
 * propósito: arrastra Chromium y pesa más de 300 MB, que habría que cargar en
 * cada máquina y en cada copia del proyecto para una herramienta que sólo se usa
 * cuando cambia un diagrama. Si ya se ejecutó antes en esta máquina, queda en la
 * caché de npx y funciona sin red.
 *
 * Uso: `npm run docs:diagramas`
 */
const { execSync } = require('node:child_process');
const { readdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const DIRECTORIO = join(__dirname, '..', 'docs', 'diagramas');
const VERSION_MERMAID = '@mermaid-js/mermaid-cli@11.4.2';
/** Ancho en píxeles: suficiente para proyectar sin que el texto se vea borroso. */
const ANCHO = 1800;

/*
 * Chromium no arranca con su sandbox en varios entornos de escritorio. El
 * archivo se escribe aquí, y no se versiona, para que el script funcione tal
 * cual en cualquier máquina.
 */
const CONFIG_PUPPETEER = join(DIRECTORIO, '.puppeteer.json');
writeFileSync(
  CONFIG_PUPPETEER,
  JSON.stringify({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }),
);

const fuentes = readdirSync(DIRECTORIO).filter((archivo) => archivo.endsWith('.mmd'));

if (fuentes.length === 0) {
  console.error(`No hay diagramas .mmd en ${DIRECTORIO}`);
  process.exit(1);
}

let generados = 0;

for (const fuente of fuentes) {
  const salida = `${fuente.slice(0, -'.mmd'.length)}.png`;
  process.stdout.write(`  ${fuente} -> ${salida} ... `);

  /*
   * Se invoca con una sola cadena y no con una lista de argumentos: en Windows
   * `npx` es un `.cmd` y, desde Node 20, lanzarlo sin shell falla con EINVAL,
   * mientras que pasarle una lista CON shell emite un aviso de deprecación. Las
   * rutas van entrecomilladas por si contienen espacios.
   */
  const comando =
    `npx -y ${VERSION_MERMAID} -p "${CONFIG_PUPPETEER}" ` +
    `-i "${join(DIRECTORIO, fuente)}" -o "${join(DIRECTORIO, salida)}" ` +
    `-w ${ANCHO} -b white`;

  try {
    execSync(comando, { stdio: 'pipe' });
    console.log('ok');
    generados += 1;
  } catch (error) {
    console.log('FALLÓ');
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

console.log(`\n${generados} de ${fuentes.length} diagramas regenerados en docs/diagramas/`);
