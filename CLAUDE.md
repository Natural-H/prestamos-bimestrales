# CLAUDE.md — `prestamos-bimestrales`

> Archivo de contexto persistente para Claude Code. **Léelo completo antes de tocar código y respétalo en cada iteración.** Si algo aquí entra en conflicto con una petición puntual, detente y pregunta antes de continuar.

---

## 1. Contexto del proyecto

Microservicio de **préstamos bimestrales** (API REST) para el TECNM. Alumnos y trabajadores solicitan préstamos asociados a bimestres del año. El proyecto es para una **clase de Arquitectura de Software y Microservicios**, por lo que la calidad arquitectónica y la disciplina de capas se evalúan tanto o más que la funcionalidad.

**Alcance: solo la API REST (backend). No se desarrolla ninguna interfaz de usuario (UI/frontend).** Los flujos que el planteamiento describe desde la óptica del usuario ("ingresar al sitio", "consultar bimestres", el botón "Solicitar") se implementan como **endpoints HTTP**, no como pantallas. La capa de presentación de este proyecto es la capa HTTP (controllers, DTOs, Guards), no una vista.

**No es un CRUD plano.** La lógica de negocio (bloqueo de bimestres por fecha, cálculo de montos según tipo de usuario, bono de diciembre para trabajadores, topes, etc.) vive **aislada dentro de la capa de dominio** y nunca se filtra a controllers, DTOs, servicios de framework ni al ORM.

El **planteamiento del problema (documento de requisitos)** está en `docs/planteamiento.md` (el documento "Préstamos Bimestrales TECNM"). Es la **fuente de verdad funcional** y debe mantenerse consistente con las reglas de la sección 6. Ante una discrepancia entre el código y los requisitos, gana el documento de requisitos y se plantea la duda.

---

## 2. Reglas de oro (no negociables)

1. **Clean Architecture + SOLID en todo momento.** Ninguna excusa, ninguna "por rapidez".
2. **La regla de dependencias apunta hacia adentro.** El dominio no conoce a NestJS, a TypeORM, ni a HTTP. Si un `import` de dominio menciona `@nestjs/*`, `typeorm` o `express`, está mal.
3. **El dominio es puro y testeable sin infraestructura.** Nada de `new Date()`, IDs autogenerados por la BD, ni llamadas a librerías de framework dentro del dominio.
4. **No hagas nada obvio ni asumas reglas de negocio no escritas.** Ante ambigüedad → consulta la sección 6.2 y **pregunta al usuario antes de implementar**.
5. **Todo código se documenta** (ver 7.9).
6. **No avances sin considerar al usuario** en decisiones de diseño relevantes o cambios de alcance.
7. **Primero el catálogo de casos de uso** (sección 13), después el código.

---

## 3. Stack tecnológico

| Área | Tecnología | Notas |
|---|---|---|
| Runtime | Node.js 20 LTS | |
| Lenguaje | TypeScript | Módulos **CommonJS** (obligatorio, ver 7.2) |
| Framework | NestJS | Solo en capas de presentación, aplicación e infraestructura |
| CQRS | `@nestjs/cqrs` (o buses ligeros propios) | Un caso de uso = un handler |
| ORM | TypeORM | Solo en infraestructura |
| BD | PostgreSQL **18** | Vía `docker-compose` |
| Auth | JWT + roles (`alumno`, `trabajador`) | Passport/JWT en infraestructura + Guards en presentación |
| Validación | `class-validator` + `class-transformer` | Solo en DTOs de presentación |
| Pruebas unitarias | **Jest** | Dominio y aplicación, sin BD |
| Pruebas de API | **Bruno** | Colección versionada en el repo |
| Config | `@nestjs/config` + `.env` | Nunca secretos hardcodeados |

No introduzcas dependencias fuera de esta lista sin avisar. **Evita paquetes ESM-only** (ver 7.2).

---

## 4. Arquitectura (Clean Architecture + CQRS)

### 4.1 Regla de dependencias

```
Presentación ─┐
              ├─► Aplicación ─► Dominio   (el dominio no depende de nadie)
Infraestructura ┘
```

- **Dominio**: no importa nada de otras capas ni de frameworks.
- **Aplicación**: depende **solo** del dominio y de **puertos** (interfaces). Nunca de implementaciones concretas.
- **Infraestructura** y **Presentación**: dependen de aplicación/dominio y proveen los **adaptadores** que implementan los puertos.
- El cableado (qué implementación satisface qué puerto) se hace con **inyección de dependencias de NestJS**, mediante tokens de interfaz. La dependencia siempre se declara contra la interfaz, no contra la clase concreta.

### 4.2 Responsabilidades por capa

- **Dominio** (`src/domain`): entidades/agregados, value objects, servicios de dominio, errores de dominio, y **puertos de repositorio** (interfaces). Aquí viven las invariantes y las reglas de negocio. Cero framework.
- **Aplicación** (`src/application`): orquesta casos de uso con **CQRS**. Los *Commands* modifican estado; las *Queries* solo leen. Los handlers son **delgados**: cargan agregados desde puertos, invocan la lógica del dominio y persisten. **La regla de negocio no se escribe en el handler**, se delega al dominio.
- **Infraestructura** (`src/infrastructure`): adaptadores concretos — repositorios TypeORM, entidades ORM, migraciones, `DataSource`, estrategias JWT, reloj del sistema, config.
- **Presentación** (`src/presentation`): controllers HTTP, DTOs de request/response con validación, Guards, decorators, y exception filters que traducen errores de dominio a HTTP.

### 4.3 Estructura de carpetas (propuesta base)

```
prestamos-bimestrales/
├─ docker-compose.yml
├─ .env.example
├─ bruno/                         # Colección de pruebas de API (Bruno)
├─ docs/
│  ├─ planteamiento.md            # Planteamiento / requisitos (fuente de verdad)
│  └─ casos-de-uso.md             # Catálogo + estimación (entregable inicial, sección 13)
├─ src/
│  ├─ domain/
│  │  ├─ entities/                # Prestamo, SolicitudPrestamo (agregado), Solicitante...
│  │  ├─ value-objects/           # Monto (Money), Bimestre, Periodo, TipoUsuario, SueldoBase...
│  │  ├─ services/                # Servicios de dominio (cálculos que cruzan entidades)
│  │  ├─ repositories/            # PUERTOS: PrestamoRepository (interface), ...
│  │  ├─ errors/                  # BimestreBloqueadoError, MontoExcedeLimiteError...
│  │  └─ ports/                   # ClockPort y otros puertos del dominio
│  ├─ application/
│  │  ├─ commands/                # <NombreCaso>.command.ts + .handler.ts
│  │  ├─ queries/                 # <NombreCaso>.query.ts + .handler.ts
│  │  ├─ ports/                   # Puertos de servicios de aplicación (si aplican)
│  │  └─ mappers/                 # Dominio <-> modelos de lectura/DTO de aplicación
│  ├─ infrastructure/
│  │  ├─ persistence/typeorm/
│  │  │  ├─ entities/             # Entidades ORM (schema de BD)
│  │  │  ├─ repositories/         # Implementan los puertos del dominio
│  │  │  ├─ mappers/              # ORM <-> dominio
│  │  │  └─ migrations/
│  │  ├─ auth/                    # JwtStrategy, hashing, etc.
│  │  ├─ clock/                   # SystemClock implementa ClockPort
│  │  └─ config/                  # TypeOrm DataSource, env schema
│  ├─ presentation/
│  │  ├─ controllers/
│  │  ├─ dtos/                    # Request/Response DTOs + validación
│  │  ├─ guards/                  # JwtAuthGuard, RolesGuard
│  │  ├─ decorators/              # @Roles(), @CurrentUser()
│  │  ├─ mappers/                 # DTO <-> command/query
│  │  └─ filters/                 # DomainExceptionFilter (dominio -> HTTP)
│  ├─ shared/                     # Result/Either, tipos y utilidades transversales puras
│  ├─ app.module.ts
│  └─ main.ts
└─ test/                          # Pruebas unitarias/integración (Jest)
```

Si propones una variante mejor de esta estructura, **justifícala y pregunta antes** de aplicarla.

---

## 5. Principios SOLID aplicados

- **S — Responsabilidad única**: un handler = un caso de uso; un value object = un concepto; un mapper solo mapea. Nada de "servicios dios".
- **O — Abierto/cerrado**: el cálculo de montos varía por tipo de usuario mediante **estrategias/polimorfismo** (p. ej. una política de préstamo por tipo), no con `if/else` que crecen sin control.
- **L — Sustitución de Liskov**: toda implementación de un puerto respeta el contrato del puerto sin sorpresas ni excepciones inesperadas.
- **I — Segregación de interfaces**: puertos pequeños y específicos (`PrestamoRepository`, `ClockPort`), no una interfaz enorme.
- **D — Inversión de dependencias**: aplicación y dominio dependen de **interfaces**; NestJS inyecta las implementaciones concretas de infraestructura.

---

## 6. Reglas de negocio del dominio

### 6.1 Reglas confirmadas

- Existen dos tipos de usuario: **alumno** y **trabajador**.
- Un préstamo se solicita seleccionando **uno o más bimestres**. Los meses de referencia son: **febrero, abril, junio, agosto y octubre** (5 bimestres del año).
- **Todos los bimestres son seleccionables desde el inicio del año.** Un bimestre que **ya transcurrió** respecto a la fecha actual queda **bloqueado**: no es seleccionable ni validable, y la API debe **rechazar** cualquier intento de solicitarlo (protección real, no solo visual).
- El **último bimestre del año es el de octubre**; una vez transcurrido, no quedan bimestres seleccionables (diciembre **no es un bimestre**, ver más abajo).
- Existe **un único registro/solicitud por usuario** que **acumula** los bimestres seleccionados (no hay un registro por bimestre). Al "Solicitar", la operación **agrega** bimestres al registro del usuario (**upsert acumulativo**, no reemplazo). El usuario puede seleccionar varios bimestres por adelantado (p. ej. estando en febrero), pero **el préstamo de cada bimestre se recibe/desembolsa en el bimestre que le corresponde**.
- **Moneda: pesos mexicanos (MXN).**

**Cálculo de montos (POR BIMESTRE):**

- **Trabajador — bimestre normal (feb, abr, jun, ago, oct):** el monto de **cada bimestre = 16% del sueldo base**. El cálculo es **por bimestre**: si selecciona N bimestres, el total en bimestres = N × 16% del sueldo base.
- **Alumno**: elige libremente el monto de **cada bimestre**, desde **$0.01 (un centavo)** hasta un **tope de $3,500.00 por bimestre** (el tope es por bimestre, no acumulado).
- Consecuencia de diseño (según las indicaciones): al **trabajador se le da un préstamo fijo** —el monto lo **calcula** el dominio a partir del sueldo base y el usuario no lo captura—, mientras que al **alumno se le da un rango con tope** —**elige** el monto (0.01–3500 por bimestre), que se **valida**—. El caso de uso "Solicitar" debe modelar ambos comportamientos como **estrategias distintas por tipo de usuario** (principio Abierto/Cerrado).
- El **sueldo base del trabajador se captura manualmente** y **puede cambiar (subir)** con el tiempo. El monto del préstamo **flota con el sueldo vigente** (no es un snapshot congelado): al actualizar el sueldo base, los montos calculados **se recalculan**. Casos de uso obligatorios: **capturar/registrar el sueldo base** y **actualizar el sueldo base con recálculo de montos**.

**Diciembre (solo trabajadores):**

- **Diciembre es un periodo exclusivo de trabajadores que se debe solicitar** (no es automático). Al solicitarlo, el trabajador recibe un monto equivalente al **32% del sueldo base** (el 16% base + el 16% adicional del planteamiento), pagado con el **aguinaldo**. Es el **único** monto del año que vale 32%; los bimestres normales son 16%.
- Diciembre **no es un bimestre** (no está en la lista de meses feb–oct) y **no está sujeto al corte de octubre**. Los **alumnos no reciben nada en diciembre**.

### 6.2 Decisiones de diseño confirmadas

> Estas decisiones ya fueron resueltas con el usuario. Están **cerradas**; si algo obligara a cambiarlas, **consúltalo antes** de implementar.

1. **Un registro por usuario que acumula bimestres.** No hay un registro por bimestre. "Solicitar" hace **upsert acumulativo** (agrega bimestres; no reemplaza la selección previa). Diseña el agregado con esto en mente y cuida la **concurrencia**: dos solicitudes del mismo usuario no deben duplicar bimestres ni pisarse entre sí.
2. **El monto del trabajador flota con el sueldo vigente** (no es snapshot). Al actualizar el sueldo base se **recalculan** los montos → caso de uso obligatorio de recálculo.
3. **El sueldo base se captura manualmente** y se almacena en los datos del trabajador (no viaja en cada request ni proviene de otro sistema) → caso de uso obligatorio de captura.
4. **Bloqueo por fecha:** un bimestre queda bloqueado cuando la fecha actual **supera el fin del periodo** del bimestre. Zona horaria `America/Mexico_City`.
5. **Interés y plazo de pago: fuera de alcance.** No fueron parte de los requisitos del profesor; **no** se crean casos de uso para ellos.
6. **Diciembre:** se **solicita** (no es automático), es **exclusivo de trabajadores** y su monto total es **32%** del sueldo base.
7. **El monto del trabajador no se persiste: se deriva en lectura.** Al ser función pura del sueldo vigente (decisión 2) y no existir historial de sueldos ni snapshots, el agregado almacena **qué** periodos se solicitaron, no **cuánto**; el monto lo calcula la política de préstamo del trabajador en cada consulta. Así el recálculo se cumple **por construcción** y la base de datos no puede quedar desincronizada. El monto del **alumno sí se persiste**, porque lo captura él. El caso de uso de recálculo (decisión 2) sigue existiendo y conservando sus pruebas: lo que se verifica es que, tras actualizar el sueldo, la consulta de la solicitud devuelve montos nuevos sin haber tocado ningún periodo.
8. **Registro de decisiones.** Las decisiones cerradas posteriores a este archivo —periodos del calendario (el mes de referencia es el **mes final**: febrero = ene–feb), registro único **por usuario y año**, idempotencia y atomicidad de "Solicitar", redondeo **half-up al centavo**, diciembre solicitable hasta el 31 de diciembre, alta de usuarios por endpoint, tipo de usuario inmutable, y lo que queda **fuera de alcance** (desembolso, cancelación, historial de sueldos)— están registradas en **`docs/casos-de-uso.md` §7**, con su impacto en cada caso de uso. Consúltalo junto con esta sección: ahí están las reglas `RN-01`…`RN-20` que el código debe citar en su TSDoc.

---

## 7. Convenciones de código

### 7.1 Idioma

- **CLAUDE.md, comentarios y documentación: español.**
- **Código (clases, métodos, variables) en inglés**, **excepto los conceptos de dominio del negocio, que se mantienen en español** para no perder el lenguaje ubicuo: `Prestamo`, `Bimestre`, `Aguinaldo`, `TipoUsuario`, `SueldoBase`, `Solicitante`, `SolicitudPrestamo`.
- Ejemplo: `class SolicitudPrestamo { addBimestre(bimestre: Bimestre): void { ... } }`.

### 7.2 CommonJS (obligatorio)

- `tsconfig.json`: `"module": "CommonJS"`, `"moduleResolution": "Node"`, `"target": "ES2022"`, con `"experimentalDecorators": true`, `"emitDecoratorMetadata": true`, `"esModuleInterop": true`.
- **Prohibido usar paquetes ESM-only** (p. ej. versiones nuevas de `nanoid`, `chalk@5`, `node-fetch@3`). Elige versiones compatibles con CJS o alternativas.
- Nada de `top-level await` ni `import assertions`.

### 7.3 Nombrado y estilo

- Archivos en `kebab-case` con sufijo por rol: `*.command.ts`, `*.handler.ts`, `*.query.ts`, `*.entity.ts` (dominio), `*.orm-entity.ts` (ORM), `*.repository.ts` (puerto), `*.repository.impl.ts` (adaptador), `*.dto.ts`, `*.mapper.ts`, `*.guard.ts`.
- Clases `PascalCase`, métodos/variables `camelCase`, constantes `UPPER_SNAKE_CASE`.
- Linter/formatter: ESLint + Prettier con la config de NestJS. El código debe pasar `lint` sin warnings antes de considerarse terminado.

### 7.4 Manejo de dinero

- **Nunca usar `number`/`float` para montos.** Modela un value object `Monto` (Money) basado en **enteros de centavos** o `decimal.js`. Redondeo explícito y documentado.
- En BD, columnas monetarias tipo `numeric`/`decimal`, nunca `float`/`double`.

### 7.5 Fechas y reloj

- El dominio **no llama a `new Date()`**. Se inyecta un `ClockPort` (`now(): Date`) con implementación `SystemClock` en infraestructura.
- Esto es indispensable para poder **probar el bloqueo de bimestres por fecha** de forma determinista.
- Define y documenta la **zona horaria** de referencia (probable: `America/Mexico_City`).

### 7.6 Validación (DTOs)

- Validación de forma/tipos con `class-validator` **solo en los DTOs de presentación**. No metas validación de reglas de negocio aquí — eso es del dominio.
- `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

### 7.7 Manejo de errores

- El dominio lanza **errores de dominio propios y semánticos** (`BimestreBloqueadoError`, `MontoExcedeLimiteError`, `PeriodoSolicitudCerradoError`, ...).
- La aplicación deja propagar esos errores; **no** los convierte en errores HTTP.
- Un **exception filter** en presentación mapea errores de dominio → códigos HTTP adecuados (400/409/422 según el caso). **Nunca** se filtran errores de TypeORM ni stack traces al cliente.

### 7.8 Mapeo entre capas

- Tres modelos distintos y separados: **DTO** (presentación) ≠ **entidad/agregado de dominio** ≠ **entidad ORM** (infraestructura). Se conectan con **mappers explícitos**. No reutilices la entidad ORM como entidad de dominio ni como DTO.

### 7.9 Documentación del código

- **TSDoc/JSDoc** en clases, métodos públicos y, sobre todo, en la lógica de negocio: explica **el porqué**, no el qué. Cada regla de negocio implementada cita a qué requisito del planteamiento responde.
- README breve con arranque del proyecto y cómo correr pruebas.

---

## 8. Persistencia (TypeORM + PostgreSQL 18)

- TypeORM **solo** en infraestructura. Las entidades ORM viven en `infrastructure/persistence/typeorm/entities` y son distintas de las entidades de dominio.
- Los repositorios concretos implementan los **puertos** definidos en el dominio y hacen el mapeo ORM ↔ dominio.
- **Migraciones obligatorias** (`synchronize: false`, incluso en desarrollo). El esquema se versiona.
- Tipos de columna correctos: `numeric` para dinero, `timestamptz` para fechas con zona, enums para `TipoUsuario`/estado de solicitud.

---

## 9. Autenticación y autorización (JWT + roles)

- Login que emite **JWT**; el token incluye el identificador del usuario y su **rol** (`alumno` / `trabajador`).
- `JwtAuthGuard` (autenticación) + `RolesGuard` con decorator `@Roles(...)` (autorización) en la capa de **presentación**.
- La infraestructura de auth (estrategia JWT, verificación de credenciales, hashing) va en `infrastructure/auth`. **El dominio no sabe qué es un JWT**: si una regla necesita el tipo de usuario, recibe un `TipoUsuario` de dominio, no un token.
- Secretos y expiración desde `.env` (`@nestjs/config`), nunca hardcodeados.

---

## 10. Pruebas (Jest + Bruno)

- **Jest — unitarias del dominio y la aplicación**, sin base de datos ni framework:
  - Value objects (`Monto`, `Bimestre`), servicios de dominio (cálculo por tipo de usuario, bono de diciembre) e invariantes del agregado.
  - Bloqueo de bimestres inyectando un `ClockPort` falso para simular distintas fechas.
  - Handlers de casos de uso con repositorios/puertos **mockeados**.
- **Bruno — pruebas de la API** (integración/e2e desde HTTP): colección versionada en `bruno/`, con casos felices y de error (bimestre bloqueado, monto fuera de tope, periodo cerrado, auth/roles).
- El dominio y la aplicación deben ser probables **sin levantar Postgres**. Si para probar una regla de negocio necesitas la BD, la regla está mal ubicada.

---

## 11. Docker / entorno

- `docker-compose.yml` con servicio **PostgreSQL 18** (imagen `postgres:18`), volumen persistente, credenciales por variables de entorno y healthcheck.
- `.env.example` versionado; `.env` real ignorado por git.
- Documenta en el README cómo levantar la BD y correr migraciones.

---

## 12. Comandos (referencia; ajusta a los scripts reales del `package.json`)

```bash
# Infraestructura
docker compose up -d            # Levanta PostgreSQL 18

# Migraciones (TypeORM)
npm run migration:generate
npm run migration:run

# Desarrollo
npm run start:dev

# Calidad
npm run lint
npm run test                    # Jest (unitarias dominio/aplicación)
npm run test:cov                # Cobertura

# Pruebas de API: colección en /bruno (Bruno app o `bru run`)
```

---

## 13. Flujo de trabajo esperado (IMPORTANTE)

1. **Primer entregable, antes de escribir código de la app:** genera `docs/casos-de-uso.md` con el **catálogo exhaustivo de casos de uso** posibles del microservicio, en una **tabla** que incluya, por caso: identificador, nombre, actor(es)/rol, descripción, precondiciones, regla(s) de negocio asociadas, capa/patrón (Command/Query), y **estimación de desarrollo** (esfuerzo/complejidad).
   - **No te limites a lo obvio.** Incluye como mínimo: solicitar bimestres (trabajador con **monto fijo calculado** / alumno con **rango 0.01–3500** validado), solicitar **diciembre** (solo trabajadores, 32%), consultar bimestres **disponibles/bloqueados**, **capturar** el sueldo base, **actualizar** el sueldo base con **recálculo** de montos, **desembolso** por bimestre en su periodo, validaciones y casos de error, bloqueo por fecha, **upsert acumulativo** del registro, concurrencia, autenticación y autorización por rol, y cierre del periodo en octubre.
   - Las reglas y decisiones de diseño ya están cerradas (secciones 6.1 y 6.2). Si detectas un caso que **ninguna** cubre, **pregunta antes de asumir** y márcalo como `// SUPUESTO A CONFIRMAR`.
2. Las reglas de negocio están **confirmadas en la sección 6**. **No inventes reglas nuevas**; ante cualquier caso no cubierto, pregunta antes de modelar.
3. Solo después: diseño del dominio → aplicación (CQRS) → infraestructura → presentación, respetando la regla de dependencias.
4. **Ante cualquier duda o decisión de diseño relevante, pregunta.** No hagas nada sin considerar al usuario y no cambies el alcance por tu cuenta.
5. Documenta el código conforme lo escribes.

---

## 14. Definition of Done (para cada caso de uso)

- [ ] Regla de negocio en el **dominio**, no en handlers ni controllers.
- [ ] Cumple la **regla de dependencias** (sin imports de framework/ORM en dominio).
- [ ] Command/Query + handler delgado en aplicación.
- [ ] DTOs validados en presentación; errores de dominio mapeados a HTTP por el filter.
- [ ] Puerto de repositorio en dominio + adaptador TypeORM en infraestructura + migración.
- [ ] **Pruebas Jest** del dominio/caso de uso (incluye casos de error y de fecha).
- [ ] **Request(s) en la colección Bruno** (caso feliz + errores).
- [ ] Código **documentado** (TSDoc) citando el requisito que satisface.
- [ ] `lint` y `test` en verde.
```
