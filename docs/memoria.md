# Memoria del proyecto

_Qué es, cómo se usa, por qué está hecho así y en qué orden se construyó. Es el documento para
leer si vas a revisar, defender o retomar el proyecto._

---

## 1. Qué documento leer para qué

El proyecto se documenta en cinco archivos, cada uno con un trabajo distinto. Esta memoria no
los repite: los conecta.

| Documento | Responde a |
|---|---|
| [`planteamiento.md`](planteamiento.md) | **Qué** debe hacer el sistema. Fuente de verdad funcional |
| [`casos-de-uso.md`](casos-de-uso.md) | **Qué casos** cubre, con qué reglas y qué se decidió en cada duda |
| [`arquitectura.md`](arquitectura.md) | **Cómo** está construido: capas, puertos, modelo, diagramas |
| [`demo.md`](demo.md) | **Cómo enseñarlo** en cinco minutos |
| **Esta memoria** | **Por qué** está así y **en qué orden** se hizo |
| [`../README.md`](../README.md) | Puesta en marcha y referencia rápida de comandos |

---

## 2. Qué es el sistema, en tres frases

Un **microservicio REST** para que alumnos y trabajadores del TECNM soliciten préstamos
asociados a los bimestres del año. **No hay interfaz de usuario**: lo que el planteamiento
describe como pantallas —"consultar bimestres", el botón "Solicitar"— aquí son endpoints HTTP.

Lo que lo distingue de un CRUD es que concentra reglas propias —qué bimestres siguen abiertos
según la fecha, cuánto le toca a cada tipo de usuario, el beneficio de diciembre— y **las
mantiene aisladas del framework, del ORM y de HTTP**.

## 3. Cómo se usa

Puesta en marcha completa, desde cero:

```bash
npm install
cp .env.example .env
npm run db:up               # PostgreSQL 18 en Docker (puerto 5433)
npm run migration:run       # crea el esquema
npm run seed                # tres usuarios de prueba
npm run start:dev           # http://localhost:3000
```

Un recorrido mínimo para comprobar que funciona:

```bash
# 1 · iniciar sesión
curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"correo":"trabajador@tecnm.mx","contrasena":"prestamos2026"}'

# 2 · ver el calendario (con el token del paso 1)
curl -s http://localhost:3000/bimestres -H "Authorization: Bearer $TOKEN"

# 3 · solicitar un bimestre disponible
curl -s -X POST http://localhost:3000/solicitudes/bimestres -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"bimestres":[{"mesReferencia":10}]}'
```

Los **14 endpoints** están en el [README](../README.md); el recorrido completo para una
demostración, en [`demo.md`](demo.md).

**Verificación**, que es parte del uso:

| Comando | Qué comprueba |
|---|---|
| `npm run lint` | Que ninguna capa importe lo que no debe: la regla de dependencias |
| `npm test` | 226 pruebas unitarias de las cuatro capas, sin base de datos |
| `npm run test:int` | 14 pruebas contra PostgreSQL: concurrencia y mapeo |
| `cd bruno && npx bru run --env local -r` | 35 peticiones sobre la API real |

---

## 4. Cómo se construyó: el orden y por qué ese orden

### Fase 0 · El catálogo antes que el código

Antes de escribir una línea se produjo [`casos-de-uso.md`](casos-de-uso.md): el catálogo
exhaustivo de casos de uso, sus reglas, sus errores y una estimación.

**No fue burocracia, encontró dos cosas que habrían costado caro más tarde:**

- Una **contradicción en el propio planteamiento**. Definía el bimestre "de febrero" y a la vez
  daba como ejemplo que se bloquea el 1 de marzo. Ambas cosas no podían ser ciertas: si el
  bimestre fuera febrero–marzo, el bloqueo caería el 1 de abril. Se resolvió fijando que **el
  mes de referencia es el mes final** del periodo (febrero = enero–febrero), que es la única
  lectura que hace verdadero el ejemplo normativo.
- **Doce decisiones ambiguas** que se cerraron con el equipo antes de modelar: si el registro es
  por año, si el sueldo puede bajar, qué pasa al repetir una solicitud, cómo se redondea.

Todas quedaron registradas con su justificación en la §7 de ese documento. Ninguna regla del
sistema se inventó: o está en el planteamiento o está en ese registro.

### Fase 1 · El dominio, primero y sin framework

Se construyó de dentro hacia fuera, empezando por lo que no depende de nada:

1. **`Monto` y `Porcentaje`** — el dinero antes que nada, porque todo lo demás lo usa.
2. **`FechaCivil`, `Periodo`, `Bimestre`, `PeriodoDiciembre`** — el calendario y el bloqueo.
3. **`ClockPort`** — para que el calendario fuera probable en cualquier fecha.
4. **`PoliticaPrestamo`** y sus dos implementaciones — el cálculo del monto.
5. **`SolicitudPrestamo`** — el agregado que lo junta todo con sus invariantes.

En este punto el sistema no tenía base de datos ni endpoints, pero **las reglas de negocio ya
estaban completas y probadas**: 113 pruebas que corrían en segundos.

### Fase 2 · La aplicación: casos de uso delgados

Con el dominio cerrado, los 16 casos de uso —14 handlers, porque `SolicitarBimestres` sirve a
alumno y trabajador y `ListarBimestres` cubre también el cierre de temporada— fueron casi
mecánicos: cargar, delegar, guardar.
Que resultaran tan cortos **es el resultado que se buscaba**: si un handler hubiera necesitado
lógica propia, habría significado que una regla estaba mal colocada.

Aquí se definieron los **puertos** de repositorio y se decidió que la capa no dependiera de
NestJS, para poder probarla instanciándola con dobles.

### Fase 3 · La presentación

Los endpoints, los DTOs, los guards y el filtro de errores. La decisión importante de esta fase
fue **qué NO validar en los DTOs**: el DTO comprueba que `mesReferencia` sea un entero de 1 a
12, pero no que sea un bimestre, porque eso es una regla de negocio y duplicarla dejaría la
misma verdad escrita en dos sitios que hay que cambiar a la vez.

### Fase 4 · La infraestructura y la primera prueba real

Docker con PostgreSQL 18, migración escrita a mano, repositorios TypeORM, JWT y scrypt. Al
final de esta fase el sistema se ejecutó **de verdad**: base levantada, migraciones aplicadas y
el flujo completo recorrido por HTTP.

### Fase 5 · Cerrar lo que faltaba

Las pruebas de integración —lo que un doble no puede demostrar—, un refactor para eliminar
duplicación que ya se veía repetida ocho veces, y la documentación.

> **El orden no es casual.** Construir de fuera hacia dentro —empezar por el controller— obliga
> a decidir el esquema de la base antes de entender las reglas, y termina con la lógica repartida
> entre controllers y consultas SQL. Empezando por el dominio, cada capa exterior sólo tuvo que
> traducir.

---

## 5. Justificación de las decisiones

Cada fila responde a "¿por qué así y no de la forma obvia?".

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| **Clean Architecture por capas** | Servicios que hablan con el ORM directamente | Las reglas del TECNM sobreviven a que cambie el framework o la base. Es lo que evalúa la materia |
| **La regla de dependencias la verifica el linter** | Confiar en la disciplina y la revisión | Una convención que sólo vive en un documento se rompe sola. Ahora romperla falla `npm run lint` |
| **`ClockPort` en vez de `new Date()`** | Leer el reloj donde haga falta | Sin esto, probar el bloqueo de octubre exigiría esperar a noviembre. Con esto, es una prueba de milisegundos |
| **Dinero en centavos enteros, redondeo half-up en un solo sitio** | `number` con decimales | `0.1 + 0.2 !== 0.3`. Un sistema que acumula montos y calcula porcentajes no puede permitirse ese error |
| **Estrategias por tipo de usuario** | `if (esAlumno) … else …` | No es la misma operación con un parámetro: **cambia quién decide el monto**. Añadir un tipo no obliga a tocar los existentes |
| **El monto del trabajador se deriva, no se persiste** | Guardarlo y recalcularlo en cascada al cambiar el sueldo | Como el monto es función pura del sueldo vigente, derivarlo hace el recálculo **imposible de olvidar** y elimina el riesgo de desincronización |
| **Un registro por usuario y año** | Un registro por bimestre solicitado | Lo pide el planteamiento, y hace que la unicidad y la concurrencia tengan un único punto de control |
| **"Solicitar" idempotente y atómico** | Insertar lo que llegue | Una petición repetida no debe duplicar ni fallar; y si un bimestre del lote choca, no puede quedar medio aplicado |
| **Bloqueo optimista por versión** | Confiar en que no habrá simultaneidad | El planteamiento exige explícitamente no duplicar ni sobrescribir ante peticiones simultáneas |
| **CQRS con interfaces propias** | `@nestjs/cqrs` | Deja la capa de aplicación libre de framework y probable sin contenedor. El proyecto admite ambas |
| **scrypt de `node:crypto`** | `bcrypt` o `argon2` | Derivación con coste de memoria sin añadir una dependencia nativa que compilar en cada máquina |
| **Migraciones escritas a mano, `synchronize: false`** | Dejar que el ORM sincronice el esquema | "Sólo mientras desarrollo" es como se pierden datos y como el esquema real deja de coincidir con el versionado |
| **Errores de dominio con `codigo` estable** | Lanzar excepciones HTTP desde el dominio | El dominio no sabe qué es HTTP. El filtro traduce por código, así que reescribir un mensaje no rompe el contrato de la API |
| **La entrega es estado derivado de la fecha** | Un proceso de desembolso con su endpoint | El desembolso quedó fuera de alcance; derivarlo evita inventar un estado que nadie mantiene |

---

## 6. Problemas reales que aparecieron

Los que costaron tiempo y dejaron una lección:

**El 32 % de diciembre no es el doble del 16 %.** Con un sueldo de $12,345.67, el 32 % da
$3,950.61 y duplicar el 16 % ya redondeado da $3,950.62. Un centavo. Se siguió la letra del
planteamiento —"32 % del sueldo base"— y se dejó una prueba con el cálculo comentado para que
nadie lo "corrija" por intuición.

**La API no arrancaba por una anotación de tipo ausente.** La validación de configuración
rechazaba `PORT`, `DB_PORT` y `JWT_EXPIRES_IN` diciendo que no eran enteros, aunque el `.env`
era correcto. La causa: sin anotación explícita (`PORT: number = 3000`), TypeScript emite
`Object` como metadato y `class-transformer` no convierte el texto del entorno a número. Hoy
hay una prueba que lo sujeta y un comentario que explica por qué esas anotaciones no sobran.

**PostgreSQL 18 cambió el punto de montaje.** El contenedor entraba en bucle de reinicio: a
partir de esta versión se monta `/var/lib/postgresql`, no `.../data`.

**El puerto 5432 estaba ocupado** por un PostgreSQL instalado en la máquina, y las migraciones
fallaban con un error de autenticación desconcertante —conectaban al servidor equivocado—. El
contenedor se movió al **5433** en lugar de tocar la instalación existente.

**La colección Bruno no era repetible.** Pasaba la primera vez y fallaba la segunda: daba de
alta usuarios con correos fijos y capturaba el sueldo de un usuario reservado para provocar el
error de "sueldo no registrado". Ahora las peticiones que crean usuarios generan un correo
distinto en cada ejecución.

**La prueba de concurrencia se verificó por mutación.** Escribirla no bastaba: una prueba de
concurrencia puede pasar por casualidad. Se quitó a propósito la condición `WHERE version` del
`UPDATE`, se comprobó que **fallaba**, y se restauró.

> El hilo común: **escribir una prueba no es lo mismo que verificarla**, y un error raro casi
> siempre tiene una causa aburrida y concreta.

---

## 7. Cómo comprobar que esta memoria dice la verdad

Cada afirmación de arriba se puede verificar sin leer todo el código:

| Afirmación | Cómo comprobarla |
|---|---|
| El dominio no depende de ningún framework | `npm run lint` con un `import` de `@nestjs/common` añadido en `src/domain` |
| Las reglas se prueban sin base de datos | `npm test` — 226 pruebas, Postgres apagado |
| El bloqueo por fecha funciona en cualquier fecha | `test/domain/bimestre.spec.ts` con el reloj falso |
| El recálculo no reescribe filas | `test/application/sueldo-base.handlers.spec.ts`, o el minuto 5 de [`demo.md`](demo.md) |
| Dos peticiones simultáneas no se pisan | `npm run test:int` |
| La API responde lo que dice la documentación | `cd bruno && npx bru run --env local -r` |

---

## 8. Límites conocidos

Lo que **no** hace el sistema, y no por olvido:

- **Fuera de alcance por decisión del planteamiento**: intereses, plazos y formas de pago, el
  proceso de desembolso, la cancelación de periodos y el historial de sueldos. Están
  descartados con su justificación en [`casos-de-uso.md`](casos-de-uso.md) §7, no pendientes.
- **El total de un trabajador cambia retroactivamente** si actualiza su sueldo, incluso para
  bimestres ya transcurridos. Es la consecuencia aceptada de que el monto flote y no haya
  historial; si algún día el TECNM quisiera congelar lo ya entregado, habría que introducir
  snapshots y revisar esa decisión.
- **El alta escribe en dos puertos** —solicitante y credenciales— sin una transacción que los
  abarque. Con la implementación actual ambos viven en la misma base y el adaptador podría
  envolverlos; queda anotado para no darlo por resuelto.
- **No hay integración continua ni repositorio remoto**, por decisión del equipo: el proyecto se
  mantiene en local. El sustituto local sería un hook de pre-commit que corra `lint` y `test`.
- **El secreto del JWT del `.env` es un valor de ejemplo.** Para cualquier uso real hay que
  sustituirlo por uno largo y aleatorio.
