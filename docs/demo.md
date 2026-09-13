# Guion de demostración

_Cómo enseñar el microservicio en cinco minutos sin improvisar el recorrido. Cada paso indica
**qué ejecutar**, **qué se ve** y **qué regla demuestra**._

> Las respuestas de este guion son **reales**: se capturaron ejecutándolo de principio a fin el
> **13 de septiembre de 2026**, partiendo de una base recién creada. Si lo corres en otro mes cambia qué bimestres están disponibles: el calendario se
> evalúa contra el reloj (RN-04). En septiembre sólo octubre sigue abierto.

---

## Antes de empezar: punto de partida limpio

Cinco comandos. Tarda menos de un minuto y deja la base en un estado conocido, que es lo que
evita sorpresas delante de alguien.

```bash
docker compose down -v      # borra el volumen: parte de cero
npm run db:up               # PostgreSQL 18
npm run migration:run       # crea el esquema
npm run seed                # tres usuarios de prueba
npm run start:dev           # API en http://localhost:3000 (déjalo corriendo en otra terminal)
```

Comprueba que responde antes de empezar:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/me
# 401  ← correcto: sin token no se entra (RN-17)
```

**Prepara los tokens** y déjalos en variables; así los comandos del guion se copian y pegan sin
tocar nada:

```bash
TOKEN() { curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" -d "{\"correo\":\"$1\",\"contrasena\":\"prestamos2026\"}" \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).token"; }

TRAB=$(TOKEN trabajador@tecnm.mx)
ALUM=$(TOKEN alumno@tecnm.mx)
echo "${#TRAB} ${#ALUM}"   # dos números ~210: los tokens están listos
```

> Se extrae el token con `node` y no con `jq` porque Node ya es requisito del proyecto y `jq`
> puede no estar instalado. En Windows, todos los comandos van en Git Bash.

---

## Minuto 1 · El calendario se decide por fecha, no por una lista

```bash
curl -s http://localhost:3000/bimestres -H "Authorization: Bearer $TRAB"
```

**Qué señalar:** devuelve **los cinco bimestres siempre**, cada uno con su estado. Hoy
—septiembre— febrero, abril, junio y agosto salen `BLOQUEADO` con el motivo, y sólo octubre
`DISPONIBLE`.

> No se ocultan los bloqueados: el cliente merece saber **por qué** faltan. Y ocultar no
> protege: la protección de verdad está en la escritura, que es el minuto 2.

Fíjate en dos campos: `temporadaCerrada` (será `true` a partir del 1 de noviembre, RN-05) y
`montoEnPesos: "1975.31"`, que es el 16 % del sueldo del trabajador **calculado al vuelo**, sin
haber solicitado nada.

---

## Minuto 2 · El bloqueo es una regla, no un adorno visual

```bash
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $TRAB" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":2}]}'
```

```json
{ "statusCode": 409, "codigo": "BIMESTRE_BLOQUEADO",
  "mensaje": "El bimestre 2026-02 ya transcurrió (su periodo terminó el 2026-02-28) y no puede solicitarse." }
```

**Qué señalar:** aunque el cliente lo pida a mano saltándose la consulta, **la API lo rechaza**
(RN-04). El error trae un `codigo` estable: la traducción a HTTP se hace por ese código y no por
el mensaje, así que reescribir un texto no rompe el contrato.

---

## Minuto 3 · Dos tipos de usuario, dos comportamientos opuestos

**El trabajador no captura monto: se lo calculan.**

```bash
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $TRAB" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":10}]}'
```

→ `agregados: ["2026-10"]`, `montoEnPesos: "1975.31"` — el 16 % del sueldo base (RN-08).

Si lo intenta capturar, se rechaza **aunque el monto coincida** con el calculado:

```bash
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $TRAB" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":10,"montoEnPesos":"1975.31"}]}'
# 400 MONTO_NO_CAPTURABLE
```

**El alumno sí elige, dentro de un rango con tope.**

```bash
# Un centavo por encima del tope: rechazado
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $ALUM" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":10,"montoEnPesos":"3500.01"}]}'
# 422 MONTO_EXCEDE_LIMITE

# Justo en el tope: aceptado
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $ALUM" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":10,"montoEnPesos":"3500.00"}]}'
# 200 · agregados: ["2026-10"]
```

**Qué señalar:** no es la misma operación con un parámetro distinto, **cambia quién decide**. Por
eso son dos estrategias (`PoliticaPrestamoAlumno` / `PoliticaPrestamoTrabajador`) y no un `if`:
añadir un tipo de usuario no obliga a tocar las existentes.

Y el tope es **por bimestre**: cinco bimestres a $3,500.00 son $17,500.00 y es válido.

---

## Minuto 4 · Solicitar es idempotente

Repite **exactamente la misma petición** del minuto 3:

```bash
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $TRAB" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":10}]}'
```

→ `agregados: []`, `sinCambios: ["2026-10"]`, y un solo periodo en el registro.

**Qué señalar:** no duplica, no falla y **no vuelve a escribir en la base** (RN-18). Esto último
importa: una escritura inútil avanzaría la versión del registro y provocaría conflictos de
concurrencia falsos.

Si el alumno reintenta el bimestre que acaba de registrar con **otro monto**, sí es conflicto:

```bash
curl -s -X POST http://localhost:3000/solicitudes/bimestres \
  -H "Authorization: Bearer $ALUM" -H "Content-Type: application/json" \
  -d '{"bimestres":[{"mesReferencia":10,"montoEnPesos":"1000.00"}]}'
# 409 PERIODO_YA_SOLICITADO_CON_OTRO_MONTO — y no modifica nada
```

---

## Minuto 5 · El remate: el monto del trabajador no está guardado

Éste es el paso que más explica el diseño. Primero, pide diciembre y mira el registro:

```bash
curl -s -X POST http://localhost:3000/solicitudes/diciembre -H "Authorization: Bearer $TRAB"
curl -s http://localhost:3000/solicitudes/me -H "Authorization: Bearer $TRAB"
```

```
  2026-10  1975.31
  2026-12  3950.61     ← el 32 %, RN-10
  TOTAL    5925.92
```

Ahora **enseña lo que hay realmente en la base**:

```bash
docker exec prestamos-bimestrales-db psql -U prestamos -d prestamos_bimestrales \
  -c "SELECT p.tipo, p.mes_referencia, p.monto_capturado, s.version
      FROM periodos_solicitados p
      JOIN solicitudes_prestamo s ON s.id = p.solicitud_id
      JOIN solicitantes so ON so.id = s.solicitante_id
      WHERE so.sueldo_base = '12345.67' ORDER BY p.mes_referencia;"
```

**`monto_capturado` está vacío.** No es un olvido: el monto del trabajador **no se almacena**.

Sube el sueldo y vuelve a consultar:

```bash
curl -s -X PUT http://localhost:3000/trabajadores/me/sueldo-base \
  -H "Authorization: Bearer $TRAB" -H "Content-Type: application/json" \
  -d '{"sueldoBaseEnPesos":"20000.00"}'

curl -s http://localhost:3000/solicitudes/me -H "Authorization: Bearer $TRAB"
```

```
  2026-10  3200.00
  2026-12  6400.00
  TOTAL    9600.00
```

Repite la consulta a la base: **`monto_capturado` sigue vacío y `version` sigue siendo la misma**.
Los montos cambiaron sin que se tocara una sola fila del registro.

**Qué señalar:** el "recálculo" de CU-B02 no reescribe ni una fila. El monto es función pura del
sueldo vigente, así que cambiar el sueldo **ya recalculó todo** (RN-13, RN-20). La alternativa
—guardar el monto y actualizarlo en cascada— hace el mismo trabajo con más código y añade un modo
de fallo: que la base quede desincronizada del sueldo.

---

## Si sobra tiempo: la concurrencia

No se enseña con `curl`, se enseña con la prueba:

```bash
npm run test:int
```

Dos operaciones simultáneas sobre el mismo registro: **una gana y la otra recibe
`ConflictoDeConcurrenciaError`**, la versión avanza una sola vez y sólo se persiste el periodo del
ganador (RN-15).

Y el detalle que conviene contar: **está verificada por mutación**. Quitando la condición
`WHERE version = :version` del `UPDATE`, esas dos pruebas fallan. Una prueba de concurrencia que
pasa siempre no demuestra nada.

---

## Preguntas probables y dónde está la respuesta

| Pregunta | Respuesta corta | Dónde mirar |
|---|---|---|
| ¿Y si dos personas solicitan a la vez? | Bloqueo optimista por versión + índice único; una recibe 409 | `solicitud-prestamo.repository.impl.ts`; `npm run test:int` |
| ¿Por qué el dominio no usa NestJS? | Para que las reglas no dependan del framework; lo verifica el linter | `eslint.config.js`; `npm run lint` |
| ¿Cómo pruebas el bloqueo por fecha sin esperar meses? | El dominio no lee el reloj: lo recibe por `ClockPort` | `test/domain/bimestre.spec.ts` |
| ¿Por qué los montos son cadenas y no números? | `0.1 + 0.2 !== 0.3`; se opera en centavos enteros | `monto.ts`; `test/domain/monto.spec.ts` |
| ¿Dónde está la regla del 16 %? | En una estrategia del dominio, no en el controller | `politica-prestamo-trabajador.ts` |
| ¿Por qué `POST` responde 200 y no 201? | Es un upsert acumulativo idempotente, no crea un recurso nuevo | `solicitudes.controller.ts` |
| ¿Qué pasa el 1 de noviembre? | `temporadaCerrada: true`; diciembre sigue abierto hasta el 31 | `docs/arquitectura.md` §6 |
| ¿Por qué diciembre no es un bimestre? | Lo dice el planteamiento; tiene calendario y monto propios | `periodo-diciembre.ts` |

---

## Plan B

| Si pasa esto | Haz esto |
|---|---|
| La API no arranca: `EADDRINUSE` | Quedó un proceso vivo. Mátalo por puerto y vuelve a arrancar. |
| El contenedor reinicia en bucle | Volumen de una versión anterior: `docker compose down -v` y repetir la puesta a punto. |
| `npm run migration:run` da error de autenticación | Hay otro PostgreSQL en el puerto. El contenedor usa el **5433** vía `DB_PORT`. |
| No hay tiempo para la demo en vivo | `npm test` (226) y `npm run test:int` (14) cuentan la misma historia en 20 segundos. |
| Nada funciona | Enseña la colección Bruno: `cd bruno && npx bru run --env local -r` recorre los 14 endpoints. |
