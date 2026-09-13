# prestamos-bimestrales

Microservicio de **préstamos bimestrales del TECNM** (API REST). Alumnos y trabajadores
solicitan préstamos asociados a los bimestres del año.

- **Requisitos funcionales:** [`docs/planteamiento.md`](docs/planteamiento.md) — fuente de verdad.
- **Catálogo de casos de uso y decisiones cerradas:** [`docs/casos-de-uso.md`](docs/casos-de-uso.md).
- **Reglas de arquitectura y convenciones:** [`CLAUDE.md`](CLAUDE.md).

## Puesta en marcha

```bash
npm install
cp .env.example .env        # ajusta lo que necesites
npm run db:up               # PostgreSQL 18 en Docker (puerto 5433)
npm run migration:run       # crea el esquema
npm run seed                # usuarios de prueba
npm run start:dev           # API en http://localhost:3000
```

> El contenedor publica el **5433** y no el 5432 porque es habitual tener ya un PostgreSQL
> local en el puerto estándar. `DB_PORT` del `.env` fija a la vez el puerto publicado y el
> que usa la API, así que basta cambiarlo ahí.

**Usuarios del seed** (contraseña `prestamos2026`):

| Correo | Para qué sirve |
|---|---|
| `alumno@tecnm.mx` | Rango con tope: elige el monto (RN-09) |
| `trabajador@tecnm.mx` | Préstamo calculado: 16 % y 32 % de $12,345.67 (RN-08, RN-10) |
| `trabajador-sin-sueldo@tecnm.mx` | Provoca `SUELDO_BASE_NO_REGISTRADO` (EC-06). **No le captures sueldo** |

## Comandos

```bash
npm test          # 197 pruebas unitarias de dominio, aplicación y presentación (sin BD)
npm run test:int  # 6 pruebas de integración contra PostgreSQL (requiere db:up + migration:run)
npm run test:cov  # Cobertura
npm run lint      # ESLint: incluye la regla de dependencias de Clean Architecture
npm run format    # Prettier
npm run build     # Compila a dist/
npm run db:up     # Levanta PostgreSQL 18
npm run db:down   # Lo apaga
npm run migration:run / migration:revert / migration:generate
npm run seed      # Datos de prueba (idempotente)
```

### Pruebas de integración

`npm test` no toca la base de datos a propósito: si una regla de negocio necesitara Postgres
para probarse, estaría mal ubicada. Pero hay dos garantías que **sólo existen dentro de
Postgres** y que un doble en memoria no puede demostrar, y para eso está `npm run test:int`:

1. **El bloqueo optimista** (RN-15): dos operaciones simultáneas sobre el mismo registro no se
   pisan. Una gana y la otra recibe `ConflictoDeConcurrenciaError` → `409`, en vez de
   sobrescribir en silencio.
2. **El mapeo entre las filas y el agregado**: que el `numeric` vuelva como cadena sin perder
   precisión (RN-14) y que diciembre se reconstruya como su propio value object y no como un
   bimestre (RN-11).

### Pruebas de API (Bruno)

Colección versionada en [`bruno/`](bruno), con 35 peticiones y 65 aserciones: casos felices y
todos los escenarios de error del catálogo. Con la API levantada:

```bash
cd bruno && npx bru run --env local -r
```

Es **repetible**: las peticiones que crean usuarios generan un correo distinto en cada
ejecución, así que la colección pasa las veces que haga falta sin reiniciar la base.

## Endpoints

| Método y ruta | Caso de uso | Rol |
|---|---|---|
| `POST /auth/registro` | CU-A01 Alta de usuario | público |
| `POST /auth/login` | CU-A02 Inicio de sesión (JWT) | público |
| `GET /me` | CU-A03 Perfil | autenticado |
| `GET /bimestres` | CU-C01/CU-C04 Bimestres del año y cierre de temporada | autenticado |
| `GET /bimestres/:mes` | CU-C02 Disponibilidad de un bimestre concreto | autenticado |
| `GET /diciembre` | CU-C03 Disponibilidad del beneficio de diciembre | trabajador |
| `POST /solicitudes/bimestres` | CU-D01/CU-D02 Solicitar bimestres | autenticado |
| `POST /solicitudes/diciembre` | CU-D03 Solicitar diciembre | trabajador |
| `GET /solicitudes/me` | CU-D04 Mi registro del año | autenticado |
| `GET /solicitudes/me/periodos` | CU-D05 Desglose periodo a periodo | autenticado |
| `GET /solicitudes/me/entregas` | CU-E01 Estado de entrega derivado de la fecha | autenticado |
| `POST /trabajadores/me/sueldo-base` | CU-B01 Capturar sueldo base | trabajador |
| `PUT /trabajadores/me/sueldo-base` | CU-B02 Actualizar con recálculo | trabajador |
| `GET /trabajadores/me/sueldo-base` | CU-B03 Sueldo base vigente | trabajador |

`POST /solicitudes/*` responde **200 y no 201**: es un upsert acumulativo idempotente sobre el
registro único del año (RN-06, RN-18), no la creación de un recurso nuevo cada vez.

## Arquitectura

```
src/
├─ domain/          # Entidades, value objects, políticas, puertos y errores. Cero framework.
├─ application/     # Casos de uso CQRS (command/query + handler delgado). Sin framework.
├─ infrastructure/  # Adaptadores: TypeORM, auth (JWT + scrypt), reloj, config, seed
└─ presentation/    # Controllers, DTOs, guards, exception filter
test/               # Pruebas Jest, con dobles de los puertos en test/support
bruno/              # Colección de pruebas de API
```

### La regla de dependencias se verifica con el linter

`eslint.config.js` prohíbe que `src/domain/**` importe `@nestjs/*`, `typeorm`, `express` o
cualquier capa externa, y que `src/application/**` importe adaptadores concretos. No es una
convención que haya que recordar: es un error de lint (CLAUDE.md §2.2, §4.1).

### Tres decisiones que explican el resto del código

1. **El monto del trabajador no se persiste, se deriva.** Al ser función pura del sueldo
   vigente y no haber historial ni snapshots, el agregado guarda *qué* periodos se
   solicitaron, no *cuánto* (RN-20). Por eso el "recálculo" de CU-B02 no reescribe ninguna
   fila: cambiar el sueldo ya cambió todos los montos, y la base no puede desincronizarse.
2. **El dominio nunca lee el reloj.** El instante entra por `ClockPort` y se convierte una
   sola vez a día civil de `America/Mexico_City` (RN-04). Es lo que permite probar el bloqueo
   de bimestres en cualquier fecha del año de forma determinista.
3. **Dinero en centavos enteros con redondeo half-up**, en un único value object `Monto`
   (RN-14, RN-19). Los montos viajan por la API como cadena decimal (`"1975.31"`), nunca como
   `number`, para no reintroducir el error de coma flotante en el camino.

### Un colaborador para el contexto del registro

Ocho casos de uso empezaban con las mismas cinco líneas: resolver el día de hoy desde el
reloj, cargar al solicitante, fallar si no existe y cargar el registro del año creándolo vacío
si hacía falta. Eso está ahora en
[`CargadorDelRegistro`](src/application/services/cargador-del-registro.ts), así que decisiones
como "el registro es por usuario y año" o "se crea al vuelo" (RN-06) están escritas **una vez**
y no en ocho sitios que había que cambiar a la vez. Los handlers quedan con una sola
dependencia y con lo único que los distingue: qué le piden al dominio.

Los casos de uso que sólo tocan al solicitante —sueldo base, perfil, login— **no lo usan**: no
tienen registro que cargar, y dárselo les colgaría un reloj y un repositorio que no necesitan.

### CQRS sin framework

La capa de aplicación usa dos interfaces propias (`CommandHandler` / `QueryHandler`) en lugar
de `@nestjs/cqrs` —CLAUDE.md §3 admite ambas—, así que se prueba instanciando el handler con
dobles en memoria, sin contenedor. El cableado de qué adaptador satisface qué puerto vive
entero en [`src/app.module.ts`](src/app.module.ts).

## Estado

| Capa | Estado |
|---|---|
| Dominio | Completo |
| Aplicación (CQRS) | 14 casos de uso: el catálogo completo salvo lo que está fuera de alcance |
| Infraestructura | PostgreSQL 18 + TypeORM con migraciones, JWT + scrypt, reloj, seed |
| Presentación | 14 endpoints con DTOs validados, guards y filtro de errores |

Fuera de alcance por decisión del planteamiento (RN-16): intereses, plazos y formas de pago,
el proceso de desembolso, la cancelación de periodos y el historial de sueldos.
