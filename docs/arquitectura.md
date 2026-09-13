# Arquitectura — `prestamos-bimestrales`

_Vista técnica del microservicio: capas, dependencias, dónde vive cada regla de negocio y por
qué. Complementa a [`planteamiento.md`](planteamiento.md) (qué hace el sistema) y a
[`casos-de-uso.md`](casos-de-uso.md) (qué casos cubre)._

---

## 1. La idea en una frase

**Las reglas del préstamo viven en el centro y no saben que existen NestJS, TypeORM ni HTTP.**
Todo lo demás —el framework, la base de datos, el token— son detalles intercambiables que se
conectan por puertos.

## 2. Vista de capas y regla de dependencias

```mermaid
flowchart LR
    subgraph PRE["PRESENTACIÓN"]
        CTRL["Controllers<br/>14 endpoints"]
        DTO["DTOs + ValidationPipe<br/>sólo forma"]
        GRD["JwtAuthGuard<br/>RolesGuard"]
        FIL["DomainExceptionFilter<br/>dominio → HTTP"]
    end

    subgraph APP["APLICACIÓN"]
        CMD["6 Commands<br/>+ handlers"]
        QRY["8 Queries<br/>+ handlers"]
        CARG["CargadorDelRegistro"]
        RMOD["Read models<br/>+ mappers"]
    end

    subgraph DOM["DOMINIO"]
        AGG["SolicitudPrestamo<br/>raíz del agregado"]
        SOL["Solicitante"]
        POL["PoliticaPrestamo<br/>alumno / trabajador"]
        VOS["Value objects<br/>Monto · Bimestre"]
        PTOS["PUERTOS<br/>ClockPort<br/>repositorios"]
        ERRS["26 errores<br/>de dominio"]
    end

    subgraph INF["INFRAESTRUCTURA"]
        REPO["Repositorios TypeORM<br/>+ mappers ORM"]
        AUTH["JWT + scrypt"]
        CLK["SystemClock"]
        CFG["Config · migraciones"]
    end

    PRE ==>|"depende de"| APP
    APP ==>|"depende de"| DOM
    INF -.->|"implementan los puertos"| PTOS

    style DOM fill:#e8f5e9,stroke:#2e7d32,stroke-width:4px
    style PTOS fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style PRE fill:#e3f2fd,stroke:#1565c0
    style APP fill:#fff8e1,stroke:#f9a825
    style INF fill:#fce4ec,stroke:#c2185b
```

**Todas las flechas apuntan hacia adentro.** El dominio no tiene ninguna saliente: es el único
paquete del proyecto sin una sola dependencia externa. Y no hay atajos: presentación **no salta**
al dominio ni a la infraestructura, siempre pasa por un caso de uso.

> **La regla no se confía a la disciplina: la verifica el linter.** `eslint.config.js` prohíbe
> que `src/domain/**` importe `@nestjs/*`, `typeorm`, `express` o cualquier capa externa, y que
> `src/application/**` importe adaptadores concretos. Saltársela es un error de `npm run lint`,
> no un descuido que se cuela en una revisión.

## 3. Inversión de dependencias: puertos y adaptadores

El dominio y la aplicación **declaran lo que necesitan**; la infraestructura lo provee. El
cableado vive entero en `src/app.module.ts`, y siempre contra tokens de interfaz.

| Puerto (quién lo declara) | Token | Adaptador (infraestructura) |
|---|---|---|
| `ClockPort` — dominio | `CLOCK_PORT` | `SystemClock` |
| `SolicitudPrestamoRepository` — dominio | `SOLICITUD_PRESTAMO_REPOSITORY` | `SolicitudPrestamoRepositoryImpl` |
| `SolicitanteRepository` — dominio | `SOLICITANTE_REPOSITORY` | `SolicitanteRepositoryImpl` |
| `CredencialesPort` — aplicación | `CREDENCIALES_PORT` | `CredencialesAdapter` (scrypt) |
| `TokenIssuerPort` — aplicación | `TOKEN_ISSUER_PORT` | `JwtTokenIssuerAdapter` |
| `IdGeneratorPort` — aplicación | `ID_GENERATOR_PORT` | `UuidGeneratorAdapter` |

Cambiar PostgreSQL por otra cosa, o el JWT por otro esquema, es escribir un adaptador nuevo y
cambiar **una línea** del módulo. Ni el dominio ni los casos de uso se enteran.

Es también lo que hace que las pruebas sean baratas: el mismo contrato lo cumplen
`SystemClock` y el `RelojFijo` de las pruebas, o el repositorio de TypeORM y uno en memoria.

## 4. Modelo de dominio

```mermaid
classDiagram
    class Solicitante {
        +SolicitanteId id
        +TipoUsuario tipoUsuario
        -SueldoBase sueldoBaseVigente
        +capturarSueldoBase()
        +actualizarSueldoBase()
        +politicaPrestamo() PoliticaPrestamo
    }

    class SolicitudPrestamo {
        <<raiz del agregado>>
        +SolicitanteId solicitanteId
        +number anio
        +number version
        +agregar(solicitudes, politica, hoy)
        +montoTotalVigente(politica)
    }

    class PeriodoSolicitado {
        +Monto montoCapturado
        +FechaCivil fechaSolicitud
        +montoVigente(politica) Monto
        +estadoDeEntrega(hoy) EstadoEntrega
    }

    class PeriodoSolicitable {
        <<interface>>
        +validarQuePuedeSolicitarse(hoy)
        +montoSegun(politica, monto) Monto
    }

    class Bimestre {
        +MesReferencia mesReferencia
        +estaBloqueado(hoy) bool
        +temporadaCerrada(anio, hoy) bool
    }

    class PeriodoDiciembre {
        +estaBloqueado(hoy) bool
    }

    class PoliticaPrestamo {
        <<interface>>
        +montoParaBimestre(capturado) Monto
        +tieneDerechoADiciembre() bool
        +montoParaDiciembre() Monto
    }

    class PoliticaPrestamoAlumno {
        +Monto MONTO_MINIMO_POR_BIMESTRE
        +Monto MONTO_MAXIMO_POR_BIMESTRE
    }

    class PoliticaPrestamoTrabajador {
        +Porcentaje PORCENTAJE_POR_BIMESTRE
        +Porcentaje PORCENTAJE_DICIEMBRE
    }

    Solicitante --> PoliticaPrestamo : entrega la suya
    SolicitudPrestamo "1" *-- "0..6" PeriodoSolicitado
    PeriodoSolicitado --> PeriodoSolicitable
    PeriodoSolicitable <|.. Bimestre
    PeriodoSolicitable <|.. PeriodoDiciembre
    PoliticaPrestamo <|.. PoliticaPrestamoAlumno
    PoliticaPrestamo <|.. PoliticaPrestamoTrabajador
    PeriodoSolicitable ..> PoliticaPrestamo : delega el monto
```

`TipoUsuario` es **inmutable** tras el alta, y `montoCapturado` es **nulo para el trabajador**:
su monto no se guarda, se deriva. Los límites del alumno son $0.01 y $3,500.00 **por bimestre**;
los del trabajador, 16 % y 32 % del sueldo base vigente.

**Las dos jerarquías se cruzan sin conocerse.** El monto depende de dos cosas a la vez —el tipo
de usuario y el tipo de periodo— y ninguna de las dos pregunta por la otra: `Bimestre` pide
`montoParaBimestre` y `PeriodoDiciembre` pide `montoParaDiciembre`; cada política responde a su
manera. Añadir un tipo de usuario no toca el calendario, y añadir un periodo no toca las
políticas (principio Abierto/Cerrado).

## 5. Flujo de una petición

`POST /solicitudes/bimestres` — el botón **"Solicitar"** del planteamiento:

```mermaid
sequenceDiagram
    autonumber
    actor U as Cliente
    participant G as Guards
    participant C as SolicitudesController
    participant H as SolicitarBimestresHandler
    participant L as CargadorDelRegistro
    participant R as Repositorios
    participant A as SolicitudPrestamo
    participant P as PoliticaPrestamo

    U->>G: POST + Bearer token
    G->>G: verifica firma y rol
    G->>C: request.user = id + tipoUsuario
    C->>C: ValidationPipe valida FORMA del DTO
    C->>H: SolicitarBimestresCommand
    H->>L: cargar(solicitanteId)
    L->>R: buscar solicitante y registro del año
    R-->>L: Solicitante + SolicitudPrestamo
    L-->>H: hoy + solicitante + solicitud
    H->>P: solicitante.politicaPrestamo()
    H->>A: agregar(periodos, politica, hoy)
    A->>A: fase 1 · valida TODO el lote
    A->>P: monto de cada periodo
    A->>A: calendario · idempotencia · conflictos
    A->>A: fase 2 · aplica, ya no puede fallar
    A-->>H: agregados + sinCambios
    alt se agregó algo
        H->>R: guardar (transacción + bloqueo optimista)
    else nada nuevo
        Note over H,R: no se escribe: evita avanzar la versión<br/>y provocar conflictos artificiales
    end
    H-->>C: modelo de lectura
    C-->>U: 200 + estado actual del registro
```

Si algo falla, el error de dominio **sube sin tocarse** hasta el `DomainExceptionFilter`, que
lo traduce a HTTP por su código estable. La aplicación no convierte errores; la presentación no
inventa reglas.

## 6. Dónde vive cada regla de negocio

La tabla que responde a "¿y esto dónde se decide?":

| Regla | Pieza responsable | Capa |
|---|---|---|
| RN-02 · Cuáles son los cinco bimestres | `Bimestre.MESES_REFERENCIA` | Dominio |
| RN-04 · Bloqueo de un bimestre transcurrido | `Bimestre.validarQuePuedeSolicitarse` | Dominio |
| RN-05 · Cierre de temporada tras octubre | `Bimestre.temporadaCerrada` | Dominio |
| RN-06 · Un registro por usuario y año | `SolicitudPrestamo` + índice único | Dominio + BD |
| RN-07 · La entrega no se adelanta | `EstadoEntrega.derivar` sobre `Periodo` | Dominio |
| RN-08 · 16 % del sueldo base | `PoliticaPrestamoTrabajador` | Dominio |
| RN-09 · Rango 0.01–3500 por bimestre | `PoliticaPrestamoAlumno` | Dominio |
| RN-10 / RN-12 · Diciembre, sólo trabajadores | `PeriodoDiciembre` + política | Dominio |
| RN-11 · Diciembre ajeno al cierre de octubre | `PeriodoDiciembre` (calendario propio) | Dominio |
| RN-13 · El sueldo flota | `Solicitante.actualizarSueldoBase` | Dominio |
| RN-14 / RN-19 · Centavos y redondeo half-up | `Monto` | Dominio |
| RN-15 · Concurrencia | `UPDATE … WHERE version` + índice único | Infraestructura |
| RN-18 · Idempotencia y atomicidad | `SolicitudPrestamo.agregar` (dos fases) | Dominio |
| RN-17 · Autenticación y roles | Guards + estrategia JWT | Presentación + Infra |
| Forma de la petición | DTOs + `ValidationPipe` | Presentación |

**Catorce de dieciséis filas caen en el dominio.** Ése es el resultado que persigue la
arquitectura: que casi ninguna regla dependa del framework.

## 7. Modelo de datos

```mermaid
erDiagram
    solicitantes ||--o| credenciales : "tiene"
    solicitantes ||--o{ solicitudes_prestamo : "abre una por año"
    solicitudes_prestamo ||--o{ periodos_solicitados : "acumula"

    solicitantes {
        uuid id PK
        enum tipo_usuario "alumno o trabajador"
        numeric sueldo_base "nullable, CHECK positivo"
    }
    credenciales {
        varchar correo PK
        uuid solicitante_id FK "UNIQUE"
        varchar hash_contrasena "scrypt-sal-derivada"
    }
    solicitudes_prestamo {
        uuid id PK
        uuid solicitante_id FK
        int anio
        int version "bloqueo optimista"
    }
    periodos_solicitados {
        uuid id PK
        uuid solicitud_id FK
        enum tipo "bimestre o diciembre"
        int mes_referencia "CHECK 2,4,6,8,10,12"
        numeric monto_capturado "nullable · sólo alumno"
        date fecha_solicitud
    }
```

Dos detalles que el esquema hace cumplir y conviene señalar en la defensa:

- **`UQ_solicitud_solicitante_anio`** es RN-06 escrito en la base: un registro por usuario y año.
- **`monto_capturado` es nulo para el trabajador**, y no es un olvido: su monto **no se
  almacena**, se deriva del sueldo vigente en cada lectura.

## 8. Las cuatro decisiones que explican el resto

| Decisión | Por qué | Consecuencia |
|---|---|---|
| **El monto del trabajador no se persiste, se deriva** | Es función pura del sueldo vigente, y no hay historial ni snapshots (RN-13, RN-20) | Actualizar el sueldo **recalcula todo por construcción**: CU-B02 no reescribe ni una fila y la base no puede desincronizarse |
| **El dominio nunca lee el reloj** | El "ahora" entra por `ClockPort` y se convierte una sola vez a día civil de `America/Mexico_City` | El bloqueo de bimestres se prueba en cualquier fecha del año de forma determinista |
| **Dinero en centavos enteros, half-up en un solo sitio** | `0.1 + 0.2 !== 0.3`, y aquí se acumulan montos y se calculan porcentajes | Los montos viajan por la API como cadena (`"1975.31"`), nunca como `number` |
| **CQRS con interfaces propias, no `@nestjs/cqrs`** | Deja la capa de aplicación libre de framework | Los casos de uso se prueban instanciándolos con dobles, sin contenedor ni módulos de prueba |

## 9. Estrategia de pruebas

```mermaid
flowchart LR
    U["226 unitarias<br/>npm test<br/>sin base de datos"] --> UD["Dominio: reglas, calendario,<br/>dinero, invariantes"]
    U --> UA["Aplicación: casos de uso<br/>con dobles en memoria"]
    U --> UP["Presentación: mapeo de errores<br/>y validación de DTOs"]
    U --> UI["Infraestructura: scrypt, JWT,<br/>config, mappers"]

    I["14 de integración<br/>npm run test:int<br/>PostgreSQL real"] --> IC["Bloqueo optimista<br/>ante escrituras simultáneas"]
    I --> IM["Mapeo ORM ↔ dominio<br/>y restricciones de la migración"]

    B["35 peticiones Bruno<br/>API completa por HTTP"] --> BF["Casos felices"]
    B --> BE["Todos los escenarios<br/>de error del catálogo"]

    style U fill:#e8f5e9,stroke:#2e7d32
    style I fill:#fff8e1,stroke:#f9a825
    style B fill:#e3f2fd,stroke:#1565c0
```

El reparto no es casual: **si una regla de negocio necesitara PostgreSQL para probarse, estaría
mal ubicada.** Las de integración existen sólo para lo que un doble no puede demostrar —que dos
transacciones simultáneas no se pisen, que el `numeric` vuelva sin perder centavos— y por eso
van en un comando aparte, para que `npm test` siga corriendo sin base de datos.

La prueba de concurrencia está verificada por mutación: quitando la condición `WHERE version`
del `UPDATE`, falla. Una prueba de concurrencia que pasa siempre no demuestra nada.

## 10. Qué queda fuera del alcance, y por qué

Por decisión del planteamiento y del registro de decisiones (RN-16): **intereses, plazos y
formas de pago**, el **proceso de desembolso** —la entrega es estado derivado de la fecha, no un
comando—, la **cancelación** de periodos, el **historial de sueldos** y la provisión externa del
sueldo base.

No están "pendientes": están **descartados** con su justificación en
[`casos-de-uso.md`](casos-de-uso.md) §7.
