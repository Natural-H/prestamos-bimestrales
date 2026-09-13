# Préstamos Bimestrales TECNM

_Planteamiento del problema y especificación de requisitos_

> **Nota sobre este documento.** Reescribe y estructura el planteamiento original entregado en clase, integrando las aclaraciones de reglas de negocio acordadas con el equipo. Es la **fuente de verdad funcional** del microservicio `prestamos-bimestrales` y debe mantenerse consistente con la sección 6 del `CLAUDE.md`. Si en algún momento el planteamiento y la implementación discrepan, prevalece este documento y se plantea la duda antes de continuar.

---

## 1. Descripción general

El Tecnológico Nacional de México (TECNM) requiere un microservicio de préstamos (API REST) mediante el cual sus **alumnos** y **trabajadores** puedan solicitar préstamos asociados a los **bimestres** del año. La solicitud es en línea: el usuario ingresa, consulta los bimestres disponibles y selecciona uno o más para tramitar su préstamo.

El sistema no es un simple catálogo de altas y bajas: concentra reglas de negocio propias del TECNM —disponibilidad de bimestres según la fecha, cálculo del monto según el tipo de usuario y un beneficio adicional de diciembre para los trabajadores— que deben aplicarse de forma consistente y protegida, con independencia de la interfaz que consuma la API.

## 2. Actores

El sistema reconoce dos tipos de usuario, y el tipo determina tanto la forma de calcular el monto como los periodos a los que tiene acceso:

- **Alumno.** Solicita préstamos por bimestre eligiendo el monto dentro de un rango con tope.
- **Trabajador.** Solicita préstamos por bimestre con un monto fijo calculado a partir de su sueldo base, y además tiene acceso a un beneficio exclusivo en diciembre.

## 3. Bimestres y disponibilidad

El año se organiza en **cinco bimestres**, identificados por su mes de referencia: **febrero, abril, junio, agosto y octubre**. El bimestre de octubre es el último del año.

El **mes de referencia es el mes final del periodo**: el bimestre "de febrero" comprende enero y febrero. El calendario completo del año, con la fecha exacta en que cada periodo queda bloqueado, es el siguiente:

| Periodo | Mes de referencia | Comprende | Se bloquea a partir de | Aplica a |
|---|---|---|---|---|
| Bimestre 1 | **Febrero** | 1 ene – 28/29 feb | **1 de marzo** | alumno, trabajador |
| Bimestre 2 | **Abril** | 1 mar – 30 abr | **1 de mayo** | alumno, trabajador |
| Bimestre 3 | **Junio** | 1 may – 30 jun | **1 de julio** | alumno, trabajador |
| Bimestre 4 | **Agosto** | 1 jul – 31 ago | **1 de septiembre** | alumno, trabajador |
| Bimestre 5 | **Octubre** (último) | 1 sep – 31 oct | **1 de noviembre** → *cierre de temporada* | alumno, trabajador |
| Beneficio de diciembre | **Diciembre** (no es bimestre) | 1 dic – 31 dic | **1 de enero** | **solo trabajador** |

Noviembre no pertenece a ningún periodo solicitable: entre el cierre de temporada y el beneficio de diciembre no hay bimestres disponibles, pero el beneficio de diciembre sigue pudiéndose solicitar (§6).

Todos los bimestres están **disponibles para selección desde el inicio del año**, de modo que un usuario puede, por ejemplo, encontrarse en febrero y seleccionar bimestres posteriores. Sin embargo, un bimestre cuyo periodo **ya transcurrió** respecto a la fecha actual queda **bloqueado**: no puede seleccionarse ni validarse. Un bimestre se considera transcurrido cuando la fecha actual **supera el fin de su periodo** (por ejemplo, el bimestre de febrero se bloquea a partir del 1 de marzo). Este bloqueo es una **regla de negocio**, no un mero ocultamiento visual: la API debe **rechazar** cualquier intento de solicitar un bimestre bloqueado. En consecuencia, una vez transcurrido el bimestre de octubre ya no quedan bimestres disponibles para ese año.

## 4. Solicitud de préstamos

El usuario solicita su préstamo seleccionando **uno o más bimestres** disponibles y confirmando con la acción de **"Solicitar"**.

Cada usuario mantiene **un único registro de solicitud** que **acumula** los bimestres que va seleccionando; no se genera un registro independiente por bimestre. Por ello, la acción de "Solicitar" **agrega** los bimestres seleccionados al registro del usuario (sin reemplazar los previamente solicitados) y debe comportarse de forma segura ante solicitudes repetidas o simultáneas, evitando duplicar o sobrescribir bimestres ya registrados.

Aunque la selección puede hacerse por adelantado, **el préstamo de cada bimestre se recibe en el bimestre que le corresponde**; la selección anticipada no adelanta la entrega.

## 5. Cálculo del monto del préstamo

El monto depende del tipo de usuario y se calcula **por bimestre**:

| Tipo de usuario | Periodo | Monto | Naturaleza |
|---|---|---|---|
| Trabajador | Bimestre (feb, abr, jun, ago, oct) | **16 % del sueldo base** por bimestre | **Préstamo fijo**: lo calcula el sistema; el usuario no lo captura |
| Trabajador | Diciembre | **32 % del sueldo base** | Beneficio exclusivo de trabajadores; se solicita; se paga con el aguinaldo |
| Alumno | Bimestre (feb, abr, jun, ago, oct) | Monto elegido entre **$0.01 y $3,500.00** por bimestre | **Rango con tope**: lo define el alumno y el sistema lo valida |

Consideraciones del cálculo:

- Para el trabajador, si selecciona *N* bimestres, el total de sus préstamos bimestrales equivale a *N* × 16 % del sueldo base.
- Para el alumno, el tope de **$3,500.00 es por bimestre**, no un acumulado de todos los bimestres seleccionados.
- El **sueldo base del trabajador se captura manualmente** y puede **aumentar** con el tiempo. El monto del préstamo **flota con el sueldo vigente**: al actualizarse el sueldo base, los montos calculados se recalculan en consecuencia.
- La moneda de todos los montos es el **peso mexicano (MXN)**.

## 6. Beneficio de diciembre (solo trabajadores)

En **diciembre**, **únicamente los trabajadores** tienen derecho a un monto equivalente al **32 % del sueldo base**, que se entrega junto con el pago del **aguinaldo**. Este beneficio **debe solicitarse** de forma explícita (no es automático) y es el único monto del año que asciende al 32 %; los bimestres ordinarios corresponden al 16 %.

Diciembre **no es un bimestre** (no forma parte de la lista febrero–octubre) y, por tratarse de un beneficio de fin de año, **no está sujeto al cierre del bimestre de octubre**. Los **alumnos no reciben ningún préstamo en diciembre**.

## 7. Restricciones y alcance

- **Entregable:** únicamente el **microservicio (API REST)**. **No se desarrolla ninguna interfaz de usuario (UI/frontend).** Los flujos que este documento describe desde la óptica del usuario ("ingresar al sitio", "consultar bimestres", "Solicitar") se exponen como **endpoints HTTP**, no como pantallas.
- **Moneda:** pesos mexicanos (MXN).
- **Zona horaria de referencia para las fechas:** `America/Mexico_City`.
- **Fuera de alcance:** el cálculo de **intereses** y la gestión de **plazos o formas de pago** del préstamo. No formaron parte de los requisitos entregados y no se contemplan en este microservicio salvo indicación posterior.

## 8. Glosario

- **Bimestre.** Periodo del año identificado por su mes de referencia (febrero, abril, junio, agosto u octubre) sobre el que se solicita un préstamo.
- **Sueldo base.** Salario del trabajador, capturado manualmente en el sistema, que sirve de base para el cálculo del monto; puede actualizarse.
- **Préstamo fijo.** Monto que el sistema calcula automáticamente para el trabajador (16 % del sueldo base por bimestre; 32 % en diciembre).
- **Rango con tope.** Modalidad del alumno, que elige libremente el monto de cada bimestre entre $0.01 y $3,500.00.
- **Aguinaldo.** Pago de fin de año a los trabajadores, con el que se entrega el beneficio de diciembre.
