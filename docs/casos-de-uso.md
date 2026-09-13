# Catálogo de casos de uso — `prestamos-bimestrales`

_Primer entregable (CLAUDE.md §13). Documento de análisis previo a cualquier línea de código de la aplicación._

> **Fuentes de verdad:** `docs/planteamiento.md` (requisitos funcionales) y `CLAUDE.md` §6 (reglas de negocio y decisiones cerradas), más el **registro de decisiones** de la §7 de este documento (resueltas con el usuario el **2026-09-12**).
> Este catálogo **no introduce reglas de negocio nuevas**. Lo que queda sin cubrir se marca como `PENDIENTE` y se recoge en la §8.
> **Alcance:** solo API REST. No hay UI. Cada "pantalla" del planteamiento se materializa como endpoint HTTP.

**Estado:** **catálogo cerrado e implementado**. Los **16 casos de uso** que quedaron tras las decisiones de la §7 están construidos y probados, mediante **14 handlers** —`SolicitarBimestres` sirve a CU-D01 y CU-D02, y `ListarBimestres` a CU-C01 y CU-C04—. Quedaron fuera de alcance (CU-B04 historial de sueldos, CU-D06 cancelación, y los tres casos de escritura de desembolso, sustituidos por la consulta derivada CU-E01). Ver `README.md` para el estado por capa.

**Estado del catálogo:** Las 12 dudas iniciales (D-01…D-12) y las 2 derivadas (P-01, P-02) están resueltas con el usuario; ver el registro de decisiones en la §7. No quedan supuestos pendientes: el modelado puede comenzar.

---

## 1. Cómo leer este catálogo

| Columna | Significado |
|---|---|
| **ID** | Identificador estable. `CU-x##` = caso de uso; `TR-##` = capacidad transversal; `EC-##` = escenario de error. |
| **Actor/Rol** | Rol autenticado que lo ejecuta (`alumno`, `trabajador`). El rol viaja en el JWT y se valida en presentación con `RolesGuard`. |
| **Reglas (RN)** | Reglas de negocio de la §2 a las que responde. Es la trazabilidad que debe citar el TSDoc de cada pieza. |
| **Capa y patrón** | Capa donde vive la lógica y patrón CQRS. *Command* = modifica estado; *Query* = solo lectura. El handler es delgado: la regla vive en el dominio. |
| **Estimación** | `Complejidad · puntos (Fibonacci) · horas ideales`. Incluye dominio + aplicación + infraestructura + presentación + pruebas Jest + request Bruno (Definition of Done, CLAUDE.md §14). |

**Escala de complejidad**

- **Baja** — lectura o escritura directa, invariante simple, 0–1 colaborador de dominio nuevo.
- **Media** — varios value objects / servicios de dominio, mapeo entre los tres modelos, errores propios.
- **Alta** — agregado con invariantes múltiples, polimorfismo/estrategias, concurrencia o efectos en cascada.

---

## 2. Reglas de negocio de referencia (RN)

Extraídas de `docs/planteamiento.md`, `CLAUDE.md` §6.1/§6.2 y del registro de decisiones (§7). **Ninguna regla inventada.**

| RN | Regla | Fuente |
|---|---|---|
| **RN-01** | Existen dos tipos de usuario: `alumno` y `trabajador`. El tipo determina el cálculo del monto y los periodos accesibles, y es **inmutable tras el alta**. | Planteamiento §2; decisión **D-12** |
| **RN-02** | El año tiene **cinco bimestres**, identificados por su mes de referencia: febrero, abril, junio, agosto y octubre. **El mes de referencia es el mes final del periodo** (ver tabla §2.1): el bimestre "de febrero" comprende **enero–febrero**. | Planteamiento §3; decisión **P-01** |
| **RN-03** | Todos los bimestres son **seleccionables desde el inicio del año**; se pueden seleccionar bimestres posteriores por adelantado. | Planteamiento §3 |
| **RN-04** | Un bimestre queda **bloqueado** cuando la fecha actual **supera el fin de su periodo** (el bimestre de febrero se bloquea el **1 de marzo**). El bloqueo es regla de negocio: la API **rechaza**, no oculta. Zona horaria `America/Mexico_City`; el corte es el instante final del último día del periodo. | Planteamiento §3; CLAUDE.md §6.2.4; decisión **P-01** |
| **RN-05** | Octubre es el **último bimestre del año**; una vez transcurrido (**a partir del 1 de noviembre**) no queda ningún bimestre disponible: **cierre de temporada**. | Planteamiento §3; decisión **P-01** |
| **RN-06** | **Un único registro de solicitud por usuario y año.** Acumula periodos: "Solicitar" hace **upsert acumulativo** (agrega, nunca reemplaza). Al cambiar de año se abre un registro nuevo y los bimestres vuelven a estar disponibles. | Planteamiento §4; CLAUDE.md §6.2.1; decisión **D-02** |
| **RN-07** | La selección anticipada **no adelanta la entrega**: cada periodo se recibe en el periodo que le corresponde. La **entrega es estado derivado de la fecha**: no existe proceso ni endpoint de desembolso, y el monto entregado **no se congela**. | Planteamiento §4; decisiones **D-05**, **D-09** |
| **RN-08** | **Trabajador, bimestre normal:** monto **fijo calculado** = **16 % del sueldo base vigente** por bimestre. El usuario **no lo captura**. N bimestres ⇒ N × 16 %. | Planteamiento §5 |
| **RN-09** | **Alumno, bimestre normal:** monto **elegido** entre **$0.01 y $3,500.00 por bimestre** (tope por bimestre, no acumulado). El sistema lo **valida**. | Planteamiento §5 |
| **RN-10** | **Diciembre:** exclusivo de **trabajadores**, monto = **32 % del sueldo base vigente**, **se solicita explícitamente** (no es automático), se paga con el **aguinaldo**. Único monto del año al 32 %. | Planteamiento §6 |
| **RN-11** | Diciembre **no es un bimestre** y **no está sujeto al cierre de octubre** (RN-05). Es **solicitable hasta el 31 de diciembre** inclusive; a partir del 1 de enero queda bloqueado. | Planteamiento §6; CLAUDE.md §6.1; decisión **D-03** |
| **RN-12** | Los **alumnos no reciben nada en diciembre**. | Planteamiento §6 |
| **RN-13** | El **sueldo base se captura manualmente**. Al actualizarlo se **acepta cualquier valor válido** (puede subir o bajar) y los montos **se recalculan**: el monto **flota con el sueldo vigente**, incluso en periodos ya transcurridos. **No se guarda historial de sueldos** ni snapshots de monto (ver RN-20). | Planteamiento §5; CLAUDE.md §6.2.2/§6.2.3; decisiones **D-07**, **D-08**, **D-09** |
| **RN-14** | Moneda: **peso mexicano (MXN)**. Dinero modelado como value object `Monto` sobre **enteros de centavos**; nunca `float`. | Planteamiento §5/§7; CLAUDE.md §7.4 |
| **RN-15** | El registro debe ser seguro ante solicitudes **repetidas o simultáneas**: sin duplicar ni sobrescribir periodos ya registrados. | Planteamiento §4; CLAUDE.md §6.2.1 |
| **RN-16** | **Fuera de alcance:** intereses, plazos y formas de pago; **el proceso de desembolso**; la **cancelación** de periodos; el historial de sueldos; la provisión externa del sueldo base. | Planteamiento §7; CLAUDE.md §6.2.5; decisiones **D-05**, **D-06**, **D-08**, **D-11** |
| **RN-17** | Autenticación por **JWT** con identificador y rol; autorización por rol en presentación. El dominio nunca conoce el JWT: recibe un `TipoUsuario` de dominio. El **alta se hace por endpoint de registro** (el rol se fija en el alta) y existe un **seed** para pruebas. | CLAUDE.md §9; decisión **D-11** |
| **RN-18** | **"Solicitar" es idempotente y atómico.** Periodo ya registrado con **datos idénticos** ⇒ **no-op**, responde `200` con el estado actual. Alumno que re-solicita un bimestre con **monto distinto** ⇒ `409 Conflict` **sin modificar nada**. Si **cualquier** periodo del request choca, se **rechaza el request completo**: no se persiste ninguno. | Decisión **D-04** |
| **RN-19** | **Redondeo half-up al centavo**, calculado en centavos/decimal (nunca `float`). Regla **única** del sistema, implementada y documentada dentro del value object `Monto`. Ej.: $12,345.67 × 16 % = $1,975.3072 ⇒ **$1,975.31**. Corolario: el 32 % de diciembre se calcula **sobre el sueldo base**, no duplicando el 16 % ya redondeado, así que ambas cuentas pueden diferir en un centavo (con $12,345.67: $3,950.61 frente a $3,950.62). Manda la letra de RN-10, "32 % del sueldo base". | Decisión **D-10**; CLAUDE.md §7.4 |
| **RN-20** | **El monto del trabajador no se persiste: se deriva en lectura.** Al ser función pura del sueldo vigente (RN-13), el agregado guarda *qué* periodos se solicitaron, no *cuánto*; `PoliticaPrestamoTrabajador` calcula el monto en cada consulta. Así el recálculo de RN-13 se cumple por construcción y la BD no puede desincronizarse. El monto del **alumno sí se persiste**, porque lo captura él (RN-09). | Decisión **P-02** |

### 2.1 Calendario del año (derivado de RN-02, RN-04, RN-05, RN-11)

El mes de referencia es el **mes final** del periodo. Todas las fechas se evalúan en `America/Mexico_City`.

| Periodo | Mes de referencia | Comprende | Se bloquea a partir de | Aplica a |
|---|---|---|---|---|
| Bimestre 1 | **Febrero** | 1 ene – 28/29 feb | **1 de marzo** | alumno, trabajador |
| Bimestre 2 | **Abril** | 1 mar – 30 abr | **1 de mayo** | alumno, trabajador |
| Bimestre 3 | **Junio** | 1 may – 30 jun | **1 de julio** | alumno, trabajador |
| Bimestre 4 | **Agosto** | 1 jul – 31 ago | **1 de septiembre** | alumno, trabajador |
| Bimestre 5 | **Octubre** (último) | 1 sep – 31 oct | **1 de noviembre** → *cierre de temporada* | alumno, trabajador |
| Beneficio de diciembre | **Diciembre** (no es bimestre) | 1 dic – 31 dic | **1 de enero** | **solo trabajador** |

Noviembre no pertenece a ningún periodo solicitable: entre el cierre de temporada y la apertura de diciembre no hay bimestres disponibles, pero el beneficio de diciembre sigue siendo solicitable (RN-11).

---

## 3. Catálogo de casos de uso

### 3.1 Módulo A — Identidad y acceso

| ID | Nombre | Actor/Rol | Descripción | Precondiciones | Reglas (RN) | Capa y patrón | Estimación |
|---|---|---|---|---|---|---|---|
| **CU-A01** | Registrar usuario (alta de alumno o trabajador) | Público | Da de alta un usuario con su tipo (`alumno` o `trabajador`) y sus credenciales. **El rol se fija en el alta y es inmutable** (RN-01), porque determina la política de préstamo. El sueldo base **no** se captura aquí: tiene su propio caso de uso (CU-B01). | El identificador (correo/matrícula) no está registrado. | RN-01, RN-17 | Presentación `POST /auth/registro` → **Command** `RegistrarUsuarioCommand` → Dominio `Solicitante` + VO `TipoUsuario`; hashing en `infrastructure/auth`. | Media · 5 pts · 6 h |
| **CU-A02** | Iniciar sesión y emitir JWT | Público | Valida credenciales y emite un JWT con identificador de usuario y rol, consumido por todos los demás endpoints. | Usuario registrado y activo. | RN-01, RN-17 | Presentación `POST /auth/login` → **Command** `IniciarSesionCommand` → puertos `PasswordHasherPort` y `TokenIssuerPort`, adaptadores en infraestructura. | Media · 3 pts · 4 h |
| **CU-A03** | Consultar perfil del usuario autenticado | `alumno`, `trabajador` | Devuelve identidad, tipo de usuario y —si es trabajador— si ya capturó sueldo base. Permite al cliente saber qué operaciones tiene disponibles sin adivinar. | JWT válido. | RN-01, RN-13, RN-17 | Presentación `GET /me` → **Query** `ObtenerPerfilQuery`. | Baja · 2 pts · 2 h |

**Subtotal módulo A: 10 pts · 12 h**

### 3.2 Módulo B — Sueldo base (trabajador)

| ID | Nombre | Actor/Rol | Descripción | Precondiciones | Reglas (RN) | Capa y patrón | Estimación |
|---|---|---|---|---|---|---|---|
| **CU-B01** | Capturar sueldo base inicial | `trabajador` | Registra manualmente el sueldo base. Es la **precondición dura** de todo cálculo: sin sueldo base no se puede solicitar ningún periodo (EC-06). | JWT con rol `trabajador`; aún sin sueldo base capturado. | RN-08, RN-13, RN-14, RN-19 | Presentación `POST /trabajadores/me/sueldo-base` → **Command** `CapturarSueldoBaseCommand` → Dominio: VO `SueldoBase` (monto > 0, MXN). | Media · 3 pts · 4 h |
| **CU-B02** | Actualizar sueldo base con **recálculo de montos** | `trabajador` | Actualiza el sueldo base vigente —**acepta cualquier valor válido, al alza o a la baja**— con el efecto de **recalcular** los montos de todos los periodos del registro (bimestres al 16 %, diciembre al 32 %), incluidos los **ya transcurridos**. Por RN-20 el recálculo **no reescribe filas**: el monto se deriva del sueldo vigente, así que cambiar el sueldo recalcula todo por construcción. La prueba del caso de uso es precisamente ésa: tras el `PUT`, CU-D04 devuelve montos nuevos sin haber tocado los periodos. | JWT rol `trabajador`; sueldo base ya capturado (si no, EC-17). | RN-08, RN-10, RN-13, RN-14, RN-19, RN-20 | Presentación `PUT /trabajadores/me/sueldo-base` → **Command** `ActualizarSueldoBaseCommand` → Dominio: VO `SueldoBase` + `PoliticaPrestamoTrabajador` como única fuente del monto. | Baja · 3 pts · 4 h |
| **CU-B03** | Consultar sueldo base vigente | `trabajador` | Devuelve el sueldo base actual usado como base de cálculo. | JWT rol `trabajador`; sueldo base capturado. | RN-13, RN-14 | Presentación `GET /trabajadores/me/sueldo-base` → **Query** `ObtenerSueldoBaseQuery`. | Baja · 2 pts · 2 h |

**Subtotal módulo B: 8 pts · 10 h**

### 3.3 Módulo C — Bimestres, calendario y disponibilidad

| ID | Nombre | Actor/Rol | Descripción | Precondiciones | Reglas (RN) | Capa y patrón | Estimación |
|---|---|---|---|---|---|---|---|
| **CU-C01** | Consultar bimestres del año con su estado (disponible / bloqueado) | `alumno`, `trabajador` | Devuelve los cinco bimestres del año en curso con periodo, estado (`DISPONIBLE` / `BLOQUEADO`), motivo del bloqueo y si el usuario ya los tiene solicitados. Equivalente HTTP de "consultar bimestres". | JWT válido. | RN-02, RN-03, RN-04, RN-05, RN-06 | Presentación `GET /bimestres` → **Query** `ListarBimestresQuery` → Dominio: VO `Bimestre` + `Periodo` evaluados contra `ClockPort`. | Media · 5 pts · 5 h |
| **CU-C02** | Consultar disponibilidad de un bimestre específico | `alumno`, `trabajador` | Consulta puntual del estado de un bimestre y, para trabajador con sueldo capturado, el monto que le correspondería (16 %, RN-19). Permite validar antes de solicitar, sin efectos secundarios. | JWT válido; el mes es un bimestre válido. | RN-02, RN-04, RN-08, RN-09, RN-19 | Presentación `GET /bimestres/:mes` → **Query** `ObtenerBimestreQuery`. | Baja · 2 pts · 2 h |
| **CU-C03** | Consultar disponibilidad del beneficio de diciembre | `trabajador` | Informa si diciembre está disponible (**hasta el 31 de diciembre**, RN-11), el monto calculado (32 % del sueldo vigente) y si ya fue solicitado. Para `alumno` responde 403 (RN-12). | JWT rol `trabajador`. | RN-10, RN-11, RN-12, RN-19 | Presentación `GET /diciembre` → **Query** `ObtenerDisponibilidadDiciembreQuery`; `@Roles('trabajador')`. | Baja · 2 pts · 2 h |
| **CU-C04** | Consultar cierre de temporada (post-octubre) | `alumno`, `trabajador` | Escenario explícito de CU-C01: transcurrido el bimestre de octubre, no queda ningún bimestre disponible y se marca `temporadaCerrada = true`. Para trabajador, **diciembre sigue disponible** hasta el 31 de diciembre (RN-11). | JWT válido; fecha posterior al fin del bimestre de octubre. | RN-05, RN-11 | Misma **Query** que CU-C01 evaluada con `ClockPort`; se cataloga aparte por ser caso de prueba obligatorio (Jest con reloj falso + Bruno). | Baja · 2 pts · 2 h |

**Subtotal módulo C: 11 pts · 11 h**

### 3.4 Módulo D — Solicitud de préstamo (núcleo del negocio)

| ID | Nombre | Actor/Rol | Descripción | Precondiciones | Reglas (RN) | Capa y patrón | Estimación |
|---|---|---|---|---|---|---|---|
| **CU-D01** | Solicitar uno o más bimestres — **alumno** (monto elegido con tope) | `alumno` | El alumno envía una lista de bimestres, **cada uno con su monto**; el dominio valida que cada monto esté entre $0.01 y $3,500.00 (tope **por bimestre**) y que el bimestre no esté bloqueado. Se agregan al registro del año (upsert acumulativo). **Idempotente y atómico** (RN-18): si algún bimestre del request choca, no se persiste ninguno. | JWT rol `alumno`; al menos un bimestre disponible. | RN-03, RN-04, RN-06, RN-09, RN-14, RN-15, RN-18 | Presentación `POST /solicitudes/bimestres` → **Command** `SolicitarBimestresCommand` → Dominio: `SolicitudPrestamo.agregarBimestres()` + estrategia `PoliticaPrestamoAlumno`. | **Alta · 8 pts · 10 h** |
| **CU-D02** | Solicitar uno o más bimestres — **trabajador** (monto fijo calculado) | `trabajador` | El trabajador envía **solo la lista de bimestres**; el monto de cada uno lo **calcula el dominio** como 16 % del sueldo base vigente con redondeo half-up. Si el request trae montos, se rechaza (EC-05). Mismo upsert acumulativo, misma idempotencia y misma atomicidad. | JWT rol `trabajador`; **sueldo base capturado (CU-B01)**; al menos un bimestre disponible. | RN-03, RN-04, RN-06, RN-08, RN-13, RN-14, RN-15, RN-18, RN-19, RN-20 | Mismo endpoint y **Command** que CU-D01; la variación por tipo de usuario se resuelve con **estrategia** `PoliticaPrestamo` (Abierto/Cerrado, CLAUDE.md §5-O), nunca con `if/else`. Persiste el periodo **sin monto** (RN-20). | **Alta · 5 pts · 6 h** |
| **CU-D03** | Solicitar el beneficio de diciembre | `trabajador` | Solicitud explícita del periodo diciembre: el dominio calcula el 32 % del sueldo vigente y lo agrega al registro como **periodo especial** (no bimestre), marcado para pago con el aguinaldo. Exclusivo de trabajadores; no lo afecta el cierre de octubre; disponible hasta el 31 de diciembre. | JWT rol `trabajador`; sueldo base capturado; fecha ≤ 31 de diciembre. | RN-10, RN-11, RN-12, RN-13, RN-14, RN-18, RN-19 | Presentación `POST /solicitudes/diciembre` → **Command** `SolicitarDiciembreCommand` → Dominio: `SolicitudPrestamo.agregarDiciembre()` + `PoliticaPrestamoTrabajador.montoDiciembre()`. | Media · 5 pts · 5 h |
| **CU-D04** | Consultar mi solicitud (registro acumulado del año) | `alumno`, `trabajador` | Devuelve el registro del año en curso: periodos solicitados, monto vigente de cada uno, fecha de solicitud y **total acumulado**. Para trabajador los montos reflejan el sueldo **vigente** (RN-13), por lo que el total puede variar entre consultas si el sueldo cambió. | JWT válido (si no hay registro, responde 200 con registro vacío). | RN-06, RN-07, RN-08, RN-09, RN-10, RN-13, RN-14 | Presentación `GET /solicitudes/me` → **Query** `ObtenerMiSolicitudQuery` + mapper dominio → DTO de lectura. | Media · 5 pts · 5 h |
| **CU-D05** | Consultar desglose por periodo con fecha de entrega | `alumno`, `trabajador` | Detalle periodo a periodo: monto vigente y **periodo en que se recibe** (RN-07). Hace explícito para el cliente que solicitar ≠ recibir. | JWT válido; registro existente. | RN-07, RN-10, RN-14 | Presentación `GET /solicitudes/me/periodos` → **Query** `ListarPeriodosSolicitadosQuery`. | Media · 3 pts · 3 h |

**Subtotal módulo D: 26 pts · 29 h**

### 3.5 Módulo E — Entrega (estado derivado de la fecha)

> Reducido tras la decisión **D-05**: el proceso de desembolso **no es parte del microservicio**. No hay Commands aquí: la entrega es un **estado derivado** que el dominio calcula comparando el `ClockPort` con el periodo de cada solicitud. Y por **D-09**, el monto mostrado **nunca se congela**: sigue flotando con el sueldo vigente aunque el periodo ya haya pasado.

| ID | Nombre | Actor/Rol | Descripción | Precondiciones | Reglas (RN) | Capa y patrón | Estimación |
|---|---|---|---|---|---|---|---|
| **CU-E01** | Consultar el estado de entrega de mis periodos | `alumno`, `trabajador` | Para cada periodo solicitado (bimestres y, si aplica, diciembre) devuelve el estado **derivado de la fecha**: `PENDIENTE` si su periodo aún no llega, `EN_CURSO` si la fecha actual cae dentro, `ENTREGADO` si ya transcurrió; más el monto vigente. Sin escritura ni marcas persistidas. | JWT válido; registro existente. | RN-07, RN-10, RN-13, RN-14 | Presentación `GET /solicitudes/me/entregas` → **Query** `ConsultarEstadoEntregaQuery` → Dominio: servicio puro `EstadoEntrega.derivar(periodo, ahora)` sobre `ClockPort`. | Baja · 3 pts · 4 h |

**Subtotal módulo E: 3 pts · 4 h**

---

## 4. Capacidades transversales (obligatorias, CLAUDE.md §13)

No son casos de uso CQRS, pero son requisitos de implementación con su propia Definition of Done y estimación.

| ID | Capacidad | Descripción | Reglas (RN) | Capa | Estimación |
|---|---|---|---|---|---|
| **TR-01** | Reloj inyectable y zona horaria | `ClockPort.now()` en dominio + `SystemClock` en infraestructura; toda evaluación de fecha en `America/Mexico_City`. Sin esto, ni el bloqueo (RN-04) ni la entrega derivada (RN-07) son testeables de forma determinista. | RN-04, RN-05, RN-07, RN-11 | Dominio (puerto) + Infraestructura (adaptador) | Baja · 3 pts · 3 h |
| **TR-02** | Value object `Monto` (MXN, centavos, **half-up**) | Dinero como entero de centavos; **única** política de redondeo del sistema (half-up al centavo, RN-19) documentada aquí; columnas `numeric` en BD. Base de RN-08/09/10. | RN-14, RN-19 | Dominio (VO) + Infraestructura (transformer) | Media · 5 pts · 5 h |
| **TR-03** | Upsert acumulativo **idempotente y atómico** | `SolicitudPrestamo` del año se crea al vuelo si no existe y **agrega sin reemplazar**; re-solicitud idéntica = no-op; conflicto de monto = 409 sin efectos; conflicto parcial = rechazo total del request (RN-18). | RN-06, RN-15, RN-18 | Dominio (invariante) + Infraestructura (repositorio, transacción) | Media · 5 pts · 6 h |
| **TR-04** | Control de concurrencia | Dos solicitudes simultáneas del mismo usuario no se pisan ni duplican: bloqueo optimista (columna `version`) + índice único `(usuario, anio, periodo)` + reintento controlado. | RN-06, RN-15 | Infraestructura + contrato del puerto | Media · 5 pts · 6 h |
| **TR-05** | `JwtAuthGuard` | Autenticación por JWT: estrategia Passport en `infrastructure/auth`, guard en presentación. El dominio nunca ve el token. | RN-17 | Presentación + Infraestructura | Baja · 3 pts · 3 h |
| **TR-06** | `RolesGuard` + `@Roles()` + `@CurrentUser()` | Autorización por rol: diciembre solo `trabajador` (RN-12), sueldo base solo `trabajador`. | RN-01, RN-12, RN-17 | Presentación | Baja · 3 pts · 3 h |
| **TR-07** | `DomainExceptionFilter` | Traduce errores de dominio a HTTP (tabla §5). Nunca filtra errores de TypeORM ni stack traces al cliente. | Todas | Presentación | Baja · 3 pts · 4 h |
| **TR-08** | `ValidationPipe` global + DTOs | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Solo forma y tipos; **ninguna regla de negocio** aquí. | RN-09 (solo forma) | Presentación | Baja · 2 pts · 2 h |
| **TR-09** | Persistencia: entidades ORM, mappers y migraciones | Tres modelos separados (DTO ≠ dominio ≠ ORM) con mappers explícitos; `synchronize: false`, migraciones versionadas, enums, `numeric` y `timestamptz`. Clave del registro por `(usuario, anio)` (RN-06). La columna de monto es **anulable y solo la usa el alumno**: el monto del trabajador no se persiste (RN-20). | RN-06, RN-14, RN-20 | Infraestructura | **Alta · 8 pts · 10 h** |
| **TR-10** | Docker Compose + configuración | PostgreSQL 18 con volumen y healthcheck; `@nestjs/config` con esquema de env; `.env.example` versionado. | — | Infraestructura | Baja · 2 pts · 2 h |
| **TR-11** | Colección Bruno versionada | Caso feliz + casos de error por cada caso de uso (bimestre bloqueado, tope excedido, rol incorrecto, temporada cerrada, sueldo no capturado, idempotencia, conflicto de monto). | Todas | Pruebas de API | Media · 5 pts · 6 h |
| **TR-12** | Suite Jest de dominio y aplicación | Value objects (incluido el redondeo half-up), políticas por tipo de usuario, invariantes del agregado, bloqueo por fecha y entrega derivada con reloj falso, handlers con puertos mockeados. **Sin levantar Postgres.** | Todas | Dominio + Aplicación | **Alta · 8 pts · 10 h** |
| **TR-13** | Seed de datos para pruebas | Usuarios `alumno` y `trabajador` precargados (con y sin sueldo base) para que la colección Bruno sea reproducible, sin depender del orden de ejecución. | RN-17 | Infraestructura (migración/script) | Baja · 2 pts · 2 h |

**Subtotal transversales: 54 pts · 62 h**

---

## 5. Escenarios de error (validaciones obligatorias)

Cada fila es un caso de prueba obligatorio en Jest **y** en Bruno.

| ID | Escenario | Error de dominio | HTTP | Origen |
|---|---|---|---|---|
| **EC-01** | Solicitar un bimestre cuyo periodo ya transcurrió | `BimestreBloqueadoError` | 409 Conflict | RN-04 |
| **EC-02** | Solicitar un bimestre cuando ya transcurrió octubre (temporada cerrada) | `PeriodoSolicitudCerradoError` | 409 Conflict | RN-05 |
| **EC-03** | Alumno solicita un monto mayor a $3,500.00 en un bimestre | `MontoExcedeLimiteError` | 422 Unprocessable Entity | RN-09 |
| **EC-04** | Alumno solicita un monto menor a $0.01 (en la práctica, cero) | `MontoMenorAlMinimoError` | 422 Unprocessable Entity | RN-09 |
| **EC-04b** | Alumno solicita un monto negativo | `MontoInvalidoError` — lo rechaza antes el value object `Monto`, que no admite cantidades negativas | 422 Unprocessable Entity | RN-14 |
| **EC-05** | Trabajador envía un monto explícito al solicitar un bimestre | `MontoNoCapturableError` | 400 Bad Request | RN-08 |
| **EC-06** | Trabajador solicita sin haber capturado su sueldo base | `SueldoBaseNoRegistradoError` | 409 Conflict | RN-08, RN-13 |
| **EC-07** | Alumno intenta solicitar el beneficio de diciembre | `DiciembreExclusivoTrabajadoresError` | 403 Forbidden | RN-12 |
| **EC-08** | Solicitar diciembre después del 31 de diciembre | `PeriodoDiciembreCerradoError` | 409 Conflict | RN-11 |
| **EC-09** | Solicitar un mes que no es bimestre válido (p. ej. marzo) | `BimestreInexistenteError` | 400 Bad Request | RN-02 |
| **EC-10** | Re-solicitar un periodo ya registrado **con datos idénticos** | Sin error: **no-op idempotente**, devuelve el estado actual | 200 OK | RN-18 |
| **EC-11** | Alumno re-solicita un bimestre ya registrado **con monto distinto** | `PeriodoYaSolicitadoConOtroMontoError` — **no modifica nada** | 409 Conflict | RN-18 |
| **EC-12** | Request con varios bimestres donde **uno** choca (bloqueado, tope, conflicto) | El error del primer conflicto; **atomicidad**: no se persiste **ningún** bimestre del request | 409 / 422 según el conflicto | RN-18 |
| **EC-13** | Dos solicitudes simultáneas del mismo usuario sobre el mismo periodo | `ConflictoDeConcurrenciaError` tras reintento | 409 Conflict | RN-15 |
| **EC-14** | Lista de bimestres vacía o con duplicados en el request | Validación de DTO (`class-validator`) | 400 Bad Request | TR-08 |
| **EC-15** | Petición sin JWT o con JWT expirado | — (guard) | 401 Unauthorized | RN-17 |
| **EC-16** | Rol incorrecto para el endpoint (p. ej. alumno en `/trabajadores/me/sueldo-base`) | — (guard) | 403 Forbidden | RN-01, RN-17 |
| **EC-17** | Actualizar sueldo base sin haberlo capturado antes | `SueldoBaseNoRegistradoError` | 409 Conflict | RN-13 |
| **EC-18** | Alumno solicita un bimestre **sin indicar monto** | `MontoRequeridoError` — el alumno **elige** el monto y no hay valor por defecto que suponer; es el reverso de EC-05 | 400 Bad Request | RN-09 |
| **EC-19** | Sueldo base capturado en cero | `SueldoBaseInvalidoError` | 422 Unprocessable Entity | RN-13 |
| **EC-20** | Tipo de usuario corrupto al mapear desde la BD o el JWT | `TipoUsuarioInvalidoError` | 500 Internal Server Error (no debería ocurrir: indica datos inconsistentes, no un error del cliente) | RN-01 |

---

## 6. Resumen de estimación

| Bloque | Puntos | Horas ideales |
|---|---:|---:|
| A — Identidad y acceso | 10 | 12 |
| B — Sueldo base | 8 | 10 |
| C — Bimestres y disponibilidad | 11 | 11 |
| D — Solicitud de préstamo | 26 | 29 |
| E — Entrega (estado derivado) | 3 | 4 |
| TR — Capacidades transversales | 54 | 62 |
| **Total** | **112** | **128** |

> Respecto a la primera versión del catálogo (139 pts · 158 h), las decisiones de las §7 recortaron **27 pts · 30 h** de alcance: cancelación de periodos, historial de sueldos, los tres casos de escritura de desembolso y el recálculo persistido de CU-B02.
> **Reparto:** 58 pts (52 %) son casos de uso (módulos A–E) y 54 pts (48 %) capacidades transversales. Es el peso esperable en un microservicio con Clean Architecture: el andamiaje se paga una vez y luego cada caso de uso nuevo es barato.

**Camino crítico sugerido:**
TR-01 + TR-02 → CU-A01/CU-A02 + TR-05/TR-06 → CU-B01 → CU-C01 → **CU-D01 / CU-D02** (núcleo, con TR-03/TR-04) → CU-D03 → CU-B02 → CU-D04 / CU-D05 / CU-E01 → TR-11.

---

## 7. Registro de decisiones (resueltas con el usuario, 2026-09-12)

| # | Duda | Decisión | Impacto en el catálogo |
|---|---|---|---|
| **D-01** | Límites del periodo de un bimestre | Primera respuesta ("bimestre de febrero" = febrero–marzo) **revisada en P-01** por contradecir el ejemplo de bloqueo del planteamiento §3 | Sustituida por **P-01** |
| **D-02** | Alcance del registro único | **Por usuario y año** | RN-06; clave `(usuario, anio)` en TR-09 e índice único en TR-04 |
| **D-03** | Fecha límite de diciembre | Solicitable **hasta el 31 de diciembre** | RN-11; CU-C03, CU-D03, EC-08 |
| **D-04** | Re-solicitar un periodo | **Idempotente y atómico**: idéntico ⇒ no-op 200; monto distinto (alumno) ⇒ 409 sin modificar; conflicto parcial ⇒ se rechaza todo el request | RN-18; TR-03; EC-10, EC-11, EC-12 |
| **D-05** | Actor del desembolso | **Fuera de alcance**: la entrega es **estado derivado de la fecha** | RN-07, RN-16; módulo E reducido a una Query (CU-E01); eliminados los antiguos CU-E01/E02/E04 |
| **D-06** | Cancelación de un periodo | **Fuera de alcance** | RN-16; eliminado el antiguo CU-D06 |
| **D-07** | ¿El sueldo base puede bajar? | Se acepta **cualquier valor válido**; recalcula | RN-13; CU-B02 sin invariante de monotonía |
| **D-08** | Historial de sueldos | **Sin historial** | RN-13, RN-16; eliminado el antiguo CU-B04 |
| **D-09** | ¿Un monto ya entregado sigue flotando? | **Sí**, flota incluso en periodos transcurridos; **no se congela** nada. Consecuencia aceptada de "flota" + sin historial | RN-07, RN-13; CU-B02, CU-D04, CU-E01 |
| **D-10** | Redondeo | **Half-up al centavo**, en centavos/decimal, regla única documentada en `Monto` | RN-19; TR-02 |
| **D-11** | Alta de usuarios | **Endpoint de registro** (rol en el alta) + **seed** para pruebas; provisión externa del sueldo fuera de alcance | RN-16, RN-17; CU-A01 confirmado; TR-13 nuevo |
| **D-12** | Tipo de usuario | **Inmutable** tras el alta | RN-01; CU-A01 |
| **P-01** | Conflicto detectado entre D-01 y el ejemplo de bloqueo del planteamiento §3 (*"el bimestre de febrero se bloquea a partir del 1 de marzo"*): con feb–mar el corte caería el 1 de abril | **El mes de referencia es el mes FINAL del periodo**: feb = ene–feb, abr = mar–abr, jun = may–jun, ago = jul–ago, oct = sep–oct. Se respeta el ejemplo del planteamiento; **corrige D-01** | RN-02, RN-04, RN-05; **§2.1 (calendario)**; pruebas de CU-C01/C04 y CU-E01 |
| **P-02** | ¿El monto del trabajador se persiste o se deriva? (consecuencia de D-08 + D-09: es función pura del sueldo vigente) | **Derivado en lectura**: el agregado no almacena el monto del trabajador; lo calcula `PoliticaPrestamoTrabajador` en cada consulta. El recálculo de RN-13 se cumple por construcción y la BD no puede desincronizarse | RN-20; CU-B02 pasa de 8 a 3 pts; TR-09 (columna de monto anulable, solo alumno) |

### 7.1 Notas de trazabilidad

- **P-01 no modifica `docs/planteamiento.md`**: la lectura elegida es exactamente la que su ejemplo implica. El documento de requisitos solo quedaría **incompleto**, no contradictorio, porque nunca dice dónde empieza un bimestre. Conviene añadir la tabla §2.1 al planteamiento §3 como aclaración.
- **P-02 matiza CLAUDE.md §6.2.2**: el "caso de uso obligatorio de recálculo" (CU-B02) sigue existiendo y sigue teniendo pruebas propias; lo que cambia es que el recálculo se cumple derivando el monto en vez de reescribiendo filas. Si se quiere dejar constancia, vale la pena reflejarlo en CLAUDE.md §6.2.
- **Bus CQRS (decisión de implementación, 2026-09-12).** CLAUDE.md §3 admite `@nestjs/cqrs` **o** buses ligeros propios. La capa de aplicación se implementó con dos interfaces propias (`CommandHandler`, `QueryHandler`, en `src/application/ports/handler.ts`), de modo que queda **libre de framework** y sus pruebas instancian el handler con dobles, sin módulos de NestJS. Al cablear la infraestructura se decidirá si los handlers se envuelven con los decoradores de `@nestjs/cqrs` o si se registra un bus propio; el cuerpo de los handlers no cambia en ninguno de los dos casos.
- **Consecuencia visible de D-09 + P-02**, aceptada explícitamente: el **total histórico de un trabajador cambia retroactivamente** cuando actualiza su sueldo, incluso para bimestres ya transcurridos. Es el precio de "el monto flota" sin historial ni snapshots, y debe documentarse en la respuesta de CU-D04.

---

## 8. Pendientes

**Ninguno.** Las 12 dudas iniciales y las 2 derivadas están cerradas (§7). El catálogo queda listo para pasar al diseño del dominio.

---

_Tercera versión del catálogo (decisiones D-01…D-12, P-01 y P-02 incorporadas). **No se ha escrito código de dominio, aplicación, infraestructura ni presentación**, conforme a CLAUDE.md §13.1._
