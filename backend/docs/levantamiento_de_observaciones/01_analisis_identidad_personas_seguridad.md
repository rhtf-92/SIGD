# Análisis Funcional de Identidad, Personas y Seguridad

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" - Pucallpa, Ucayali, Perú  
**Módulo:** IdentiCore  
**Grupo:** Grupo 4 - IdentiCore  
**Responsable:** Tapullima (`B_TAPULLIMA`)  
**Fase:** 2 - Levantamiento de observaciones  
**Versión:** 2.0  
**Estado del documento:** **EN PROCESO DE SUBSANACIÓN**  
**Fecha:** 30 de agosto de 2026

> **Taxonomía de decisiones:** `CONFIRMADO` identifica una regla adoptada para esta fase; `PROPUESTO` identifica una solución técnica sujeta a aprobación; `PENDIENTE` identifica una definición institucional aún no confirmada; `EJEMPLO` identifica únicamente un caso ilustrativo.

## 1. Objetivo

Definir los requisitos funcionales y de seguridad de IdentiCore para identificar personas naturales y jurídicas, administrar cuentas de usuario, validar representaciones legales, gestionar casillas electrónicas y proteger los datos personales en el Sistema Integral de Gestión Documentaria.

Este documento subsana las observaciones del dictamen técnico mediante reglas verificables y contratos claros con TramiCore, RutaDoc y OrganiCore.

## 2. Alcance y exclusiones

### 2.1 Alcance

IdentiCore administra:

- La entidad base `persona` y sus subtipos exclusivos `persona_natural` y `persona_juridica`.
- La relación de representación legal sustentada en información de SUNARP.
- Las cuentas de acceso, sesiones y controles de autenticación.
- La casilla electrónica de externos registrados.
- El consentimiento para notificaciones electrónicas y sus evidencias de auditoría.
- La ofuscación de datos personales en APIs públicas.

### 2.2 Exclusiones de esta fase

- No se realizarán consultas activas con costo a RENIEC PIDE, SUNAT ni SUNARP.
- Se usarán adaptadores simulados (Mock Services) para validar estructura, formato y checksum de DNI/RUC.
- La aprobación institucional de roles, permisos, plazos operativos y textos legales queda sujeta a validación del IESTP "Suiza".

## 3. Clasificación oficial y unificada de usuarios

La siguiente clasificación es la única nomenclatura oficial del módulo. No deben utilizarse como categorías alternativas los términos "externo no registrado", "externo de ventanilla" o "usuario ocasional" fuera de una explicación descriptiva.

| Categoría oficial | Definición | Cuenta de usuario | Casilla electrónica | Autenticación | Integración principal |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **Usuario Interno** | Docente, administrativo o directivo con vínculo vigente con el instituto. | Sí | Según política institucional | Credencial institucional o del sistema | OrganiCore |
| **Externo Registrado con Casilla Electrónica** | Ciudadano o empresa con identidad registrada, cuenta activa, casilla digital activa y consentimiento vigente para notificaciones electrónicas. | Sí | Sí | Credenciales del portal y sesiones controladas | TramiCore |
| **Externo No Registrado Atendido en Ventanilla** | Persona natural o jurídica identificada en el padrón de personas, sin cuenta de usuario y sin casilla electrónica. | No | No | Verificación presencial por Mesa de Partes | TramiCore / Mesa de Partes |

### 3.1 Reglas de clasificación

1. Una persona puede existir en el padrón sin tener una cuenta de usuario.
2. Una persona solo es **Externo Registrado con Casilla Electrónica** cuando cuenta simultáneamente con `cuenta_usuario` activa, casilla activa y consentimiento activo para notificaciones electrónicas.
3. Una persona jurídica puede presentar trámites mediante un representante legal vigente; la cuenta y la sesión pertenecen a la persona natural que se autentica.
4. Un Usuario Interno debe tener un vínculo y un rol vigente en OrganiCore para acceder a funciones institucionales.
5. La atención en ventanilla no crea automáticamente una cuenta ni una casilla electrónica.

**Estado:** `CONFIRMADO`.

## 4. Modelo polimórfico de identidad

### 4.1 Entidades y discriminador

`persona` es la tabla base del modelo de identidad. Contiene los datos comunes y el discriminador obligatorio `tipo_persona`, cuyos únicos valores permitidos son `NATURAL` y `JURIDICA`.

| Entidad | Propósito | Identificador o dato principal |
| :--- | :--- | :--- |
| `persona` | Datos comunes de toda persona del padrón. | `id_persona`, correo, teléfono, dirección, `tipo_persona` |
| `persona_natural` | Datos de ciudadanos o apoderados naturales. | DNI/CE/Pasaporte, nombres, apellidos, fecha de nacimiento, sexo |
| `persona_juridica` | Datos de empresas o instituciones. | RUC, razón social, nombre comercial, partida registral SUNARP |
| `cuenta_usuario` | Credenciales y estado de acceso de una persona. | `id_persona`, identificador de acceso, hash de contraseña |
| `sesion_usuario` | Ciclo de vida de sesiones y refresh tokens rotativos. | Familia de token, expiración y revocación |
| `consentimiento_datos` | Evidencia versionada de aceptación o revocación. | Persona, finalidad, versión y fecha UTC |

### 4.2 Regla de herencia exclusiva 1:1

La herencia se implementará mediante tablas relacionadas, no mediante herencia física de PostgreSQL.

- Cada fila de `persona` debe tener **exactamente una** fila en `persona_natural` o `persona_juridica`.
- Si `tipo_persona = 'NATURAL'`, debe existir una fila en `persona_natural` y no debe existir una fila en `persona_juridica`.
- Si `tipo_persona = 'JURIDICA'`, debe existir una fila en `persona_juridica` y no debe existir una fila en `persona_natural`.
- Las tablas de subtipo tendrán una clave primaria que sea también clave foránea a `persona(id_persona)`, garantizando la cardinalidad máxima 1.
- La consistencia entre el discriminador y el subtipo se validará con restricciones y triggers diferibles o una función transaccional de alta, de modo que no pueda quedar una persona sin subtipo ni con dos subtipos al finalizar la transacción.
- No se permitirá cambiar `tipo_persona` si el cambio deja datos de subtipo incompatibles.

**Estado:** `CONFIRMADO`.  
**Implementación detallada del DDL:** `PROPUESTO`, a cargo de `B_SEGUNDO`.

### 4.3 Identificadores y unicidad

- DNI, CE y Pasaporte deben almacenar el tipo y número normalizados, sin espacios ni guiones.
- El número de documento debe ser único dentro de su tipo documental.
- El RUC debe ser único en `persona_juridica`.
- Los correos se normalizarán para comparación según la política definida por el equipo técnico; no se debe alterar el valor original declarado sin conservar la evidencia correspondiente.
- Los índices únicos se definirán en PostgreSQL sobre los valores normalizados.

## 5. Validaciones de documentos

### 5.1 DNI

El DNI peruano debe contener exactamente 8 dígitos decimales. La validación de existencia o titularidad en RENIEC no se ejecutará en esta fase.

**Estado:** `CONFIRMADO` para formato. `PENDIENTE` para validación externa en tiempo real.

### 5.2 RUC

El RUC debe contener exactamente 11 dígitos. Los prefijos permitidos en esta fase son `10`, `15`, `17` y `20`.

La validación deberá comprobar el dígito verificador mediante Módulo 11:

1. Tomar los primeros 10 dígitos del RUC.
2. Multiplicarlos, de izquierda a derecha, por los pesos `5, 4, 3, 2, 7, 6, 5, 4, 3, 2`.
3. Sumar los diez productos.
4. Calcular el residuo de la suma entre 11.
5. Calcular el dígito esperado como `11 - residuo`.
6. Normalizar el resultado para un dígito decimal: si el resultado es `10`, corresponde `0`; si es `11`, corresponde `1`.
7. Comparar el dígito esperado con el undécimo dígito recibido. Si no coincide, el RUC es inválido.

El RUC con prefijo `20` representa a una persona jurídica en este modelo. Los RUC con prefijos `10`, `15` o `17` se tratarán como RUC de persona natural cuando la fuente institucional confirme dicha clasificación.

**Estado:** `CONFIRMADO` para formato y checksum.  
**Fuente externa RENIEC/SUNAT:** `PENDIENTE`.

### 5.3 Correos electrónicos

El correo debe validarse con una regla de formato razonable para direcciones de Internet, rechazando espacios, caracteres de control y valores sin usuario o dominio. La validación de entregabilidad no forma parte de esta fase.

**Estado:** `CONFIRMADO` para formato y unicidad. `PENDIENTE` para verificación de entrega.

## 6. Representación legal y SUNARP

### 6.1 Regla de sujetos

`representacion_legal` vincula estrictamente:

- `id_persona_natural`: persona natural que actúa como apoderado o representante.
- `id_persona_juridica`: persona jurídica representada.

No se aceptarán personas jurídicas como apoderados ni personas naturales como representadas en esta relación.

### 6.2 Vigencia y evidencia

Cada representación debe registrar:

- `fecha_inicio_vigencia`, obligatoria.
- `fecha_fin_vigencia`, opcional; si existe, debe ser posterior o igual a la fecha de inicio.
- Tipo o alcance del poder.
- Número de partida, asiento o documento de SUNARP, cuando exista.
- Estado de validación de la representación.
- Fecha y usuario que registraron o validaron la información.

### 6.3 Prohibición de solapamiento

No se permitirán vigencias superpuestas para el mismo par `id_persona_natural` + `id_persona_juridica` y el mismo poder o alcance.

La restricción se implementará en PostgreSQL mediante una restricción `EXCLUDE` sobre un rango de fechas, o mediante un trigger transaccional equivalente cuando la fecha final sea abierta. Las vigencias abiertas se considerarán activas hasta que sean cerradas o revocadas.

### 6.4 Impacto de poderes vencidos o revocados

- Una representación vencida o revocada no autoriza la presentación de nuevos trámites en nombre de la persona jurídica.
- El sistema debe rechazar el registro digital del trámite y la validación de Mesa de Partes cuando la fecha de presentación no esté cubierta por una representación vigente.
- Los trámites presentados mientras el poder estaba vigente conservan su trazabilidad histórica; la revocación posterior no modifica retroactivamente al representante registrado.
- El rechazo debe indicar que se requiere acreditar una representación vigente, sin exponer datos personales innecesarios.
- Un trámite podrá continuar su flujo únicamente si la unidad competente valida una nueva representación según las reglas institucionales.

**Estado:** `CONFIRMADO` para integridad y vigencia.  
**Criterio jurídico-operativo y alcance de poderes:** `PENDIENTE` de aprobación institucional.

## 7. Cuentas, autenticación y sesiones

### 7.1 Cuenta de usuario

`cuenta_usuario` se relaciona con una sola persona y controla los estados `ACTIVA`, `BLOQUEADA_TEMPORAL` e `INACTIVA`.

- La contraseña se almacenará únicamente como hash Argon2id.
- Parámetros mínimos: `memoryCost = 65536` KiB (64 MiB), `timeCost = 3` e `parallelism = 4`.
- Ninguna contraseña, hash de refresh token ni credencial equivalente aparecerá en logs, respuestas HTTP o mensajes de error.
- El acceso debe responder de forma uniforme cuando el usuario no exista, la contraseña sea incorrecta o la cuenta esté inactiva, evitando enumeración de cuentas.

### 7.2 Bloqueo temporal

- Cinco intentos fallidos consecutivos provocan el estado `BLOQUEADA_TEMPORAL`.
- El contador de fallos se incrementará de forma atómica.
- Un inicio de sesión válido reinicia el contador y conserva la cuenta activa.
- La duración del bloqueo será configurable y deberá quedar registrada en la configuración aprobada del sistema.
- Durante el bloqueo no se procesarán nuevos intentos de contraseña.
- Cumplido el plazo, la cuenta podrá volver a `ACTIVA` mediante una transición controlada, sin borrar el historial de intentos.
- El desbloqueo administrativo y los cambios de estado deben quedar auditados.

**Estado:** `CONFIRMADO` para cinco intentos y estados.  
**Duración exacta del bloqueo:** `PENDIENTE` de aprobación.

### 7.3 Sesiones y refresh tokens

`sesion_usuario` administrará refresh tokens rotativos con estas reglas:

- Solo se almacenará el hash del refresh token, nunca el token en texto plano.
- Cada renovación invalida el refresh token anterior y emite uno nuevo.
- La sesión tendrá una familia de tokens (`token_family`) para detectar reutilización.
- Debe registrar creación, último uso, expiración, revocación, IP y User-Agent.
- La reutilización de un token ya rotado o revocado marca un incidente y revoca toda la familia de tokens.
- Una sesión expirada o revocada no puede emitir nuevos access tokens.
- La revocación manual, el cierre de sesión y el cambio de contraseña deben invalidar las sesiones según la política institucional aprobada.
- Los access tokens JWT se firmarán asimétricamente con RS256; las claves privadas se gestionarán fuera del código fuente y los secretos no se incluirán en el repositorio.

**Estado:** `CONFIRMADO` para rotación, hash y detección de reuso.  
**TTL exacto de access/refresh token y gestión de claves:** `PENDIENTE` de aprobación técnica.

## 8. Casilla electrónica y Ley N.° 29733

### 8.1 Condiciones de activación

La casilla electrónica solo podrá activarse para un Externo Registrado con identidad y cuenta verificadas. La activación de notificaciones electrónicas exige aceptación explícita del consentimiento aplicable.

### 8.2 Entidad `consentimiento_datos`

La entidad debe registrar una evidencia auditable con los siguientes campos mínimos:

| Campo | Requerimiento |
| :--- | :--- |
| `id_consentimiento` | Identificador único del registro. |
| `id_persona` | Persona que otorga o revoca el consentimiento. |
| `finalidad_tratamiento` | Finalidad concreta, no una descripción genérica. |
| `version_terminos` | Versión exacta de los términos o aviso informado aceptado. |
| `acepta_notificacion` | Booleano que indica la aceptación explícita de notificaciones electrónicas. |
| `fecha_hora_utc` | Fecha y hora en UTC de la acción. |
| `ip_origen` | IP desde la que se registró la acción, con protección de acceso. |
| `user_agent` | User-Agent de la solicitud, cuando esté disponible. |
| `estado_consentimiento` | Solo `ACTIVO` o `REVOCADO`. |

### 8.3 Revocación e historial

La revocación debe registrarse como un nuevo evento histórico inmutable, vinculado al consentimiento original; no se permite sobrescribir ni eliminar físicamente la evidencia original. No se permite el borrado físico de registros de consentimiento necesarios para auditoría de la ANPD.

La revocación debe registrar fecha, hora, origen y versión vigente de los términos. Desde su efectividad, el sistema no debe enviar nuevas notificaciones digitales basadas en ese consentimiento, salvo la conservación y atención de obligaciones legales que correspondan.

**Estado:** `CONFIRMADO` para campos, estados y conservación histórica.  
**Texto legal definitivo, plazos de conservación y responsable del tratamiento:** `PENDIENTE` de validación institucional.

## 9. Ofuscación de datos sensibles en APIs públicas

La ofuscación se aplica **exclusivamente en serializadores o DTOs de APIs públicas** de consulta. Nunca se modifica, trunca ni reemplaza el dato guardado en la base de datos. Las APIs internas autorizadas pueden devolver el valor completo conforme a permisos y auditoría.

| Dato | Regla exacta | Ejemplo |
| :--- | :--- | :--- |
| DNI de 8 dígitos | Conservar los 2 primeros y 2 últimos; reemplazar los 4 centrales por `****`. | `71****23` |
| CE / Pasaporte | Si es corto, conservar el primer y último carácter; si no, conservar los 2 primeros y 2 últimos y ofuscar la parte central. | `A****9` |
| RUC de persona natural (`10`, `15`, `17`) | Conservar el prefijo de 3 dígitos y los últimos 2; ofuscar los caracteres intermedios. | `107*****231` |
| RUC de persona jurídica (`20`) | No ofuscar en consultas públicas, por tratarse de un dato mercantil público, sujeto a la política institucional de publicación. | `20123456789` |
| Correo electrónico | Conservar el primer carácter del usuario, reemplazar el resto del usuario por `****` y conservar el dominio. | `j****@gmail.com` |
| Nombres | Mostrar primer nombre, inicial paterna e inicial materna. | `Tania T. N.` |
| Teléfono | Conservar los 2 primeros y 3 últimos dígitos; ofuscar los intermedios. | `96****567` |

Reglas adicionales:

- Los valores nulos o ausentes no se reemplazan con texto ficticio.
- La función de ofuscación debe ser determinista, testeable y aplicada antes de construir la respuesta pública.
- Las consultas de administración y auditoría deben aplicar autorización explícita para mostrar valores completos.
- La publicación del RUC jurídico sin ofuscación no autoriza a exponer otros datos personales asociados.

**Estado:** `CONFIRMADO` para reglas de transformación.  
**Catálogo definitivo de endpoints públicos y perfiles autorizados:** `PENDIENTE`.

## 10. Contratos con otros módulos

| Módulo consumidor | Dato provisto por IdentiCore | Uso |
| :--- | :--- | :--- |
| TramiCore | `id_persona`, tipo de persona y representación vigente | Asignar solicitante o titular del expediente. |
| RutaDoc | `id_usuario` y datos mínimos del actor autenticado | Registrar funcionario que deriva, atiende o ejecuta movimientos. |
| OrganiCore | `id_usuario` y estado de vínculo | Resolver cargos, roles y permisos institucionales. |

Los módulos consumidores no deben duplicar contraseñas, refresh tokens, consentimientos ni reglas de identidad. La validación de representación debe consultar el contrato de IdentiCore o un servicio autorizado.

## 11. Matriz de entregables de la Fase 2

| Entregable | Responsable | Rama | Estado | Evidencia requerida |
| :--- | :--- | :--- | :--- | :--- |
| `01_analisis_identidad_personas_seguridad.md` | Tapullima | `B_TAPULLIMA` | **EN PROCESO DE SUBSANACIÓN** | Documento funcional aprobado y revisión de observaciones atendida. |
| `02_modelo_datos_identicore_v2.md` | Jair | `B_JAIR` | **PENDIENTE** | Modelo lógico con cardinalidades, subtipos y representación legal. |
| `02_diccionario_datos_identicore_v2.md` | Jair | `B_JAIR` | **PENDIENTE** | Diccionario con campos, tipos, nulabilidad, índices y reglas. |
| Diagrama ER editable y PNG | Jair | `B_JAIR` | **PENDIENTE** | Archivos `.drawio` y `.png` actualizados. |
| `03_esquema_sigd_auth_v2.sql` | Segundo | `B_SEGUNDO` | **PENDIENTE** | DDL PostgreSQL con restricciones, triggers, índices y tablas. |
| `04_validacion_identicore_v2.md` | Segundo | `B_SEGUNDO` | **PENDIENTE** | Pruebas positivas y negativas ejecutadas con resultados. |
| `05_decisiones_levantamiento_identicore.md` | Segundo | `B_SEGUNDO` | **PENDIENTE** | Registro de decisiones etiquetadas con la taxonomía oficial. |
| Integración y Pull Request | Segundo | `B_SEGUNDO` hacia `B_GERIC` | **PENDIENTE** | PR, revisión y aprobación del líder general. |

## 12. Criterios de aceptación

El levantamiento se considerará subsanado cuando:

- El modelo garantice exactamente un subtipo por persona.
- DNI, RUC y correo tengan restricciones de formato y unicidad verificables.
- El RUC se valide con prefijo permitido y algoritmo Módulo 11.
- Las representaciones exijan persona natural como apoderado, persona jurídica como representada, vigencia y ausencia de solapamientos.
- Los poderes vencidos o revocados impidan nuevos trámites.
- Las contraseñas y refresh tokens no se almacenen ni registren en texto plano.
- Se prueben rotación, expiración, revocación y reutilización de refresh tokens.
- El bloqueo ocurra después de cinco intentos fallidos consecutivos y quede auditado.
- `consentimiento_datos` conserve aceptación y revocación como historial no eliminable.
- Las APIs públicas apliquen exactamente la matriz de ofuscación sin alterar la base de datos.
- Los documentos, DDL, pruebas y diagramas estén vinculados en la matriz de entregables y revisados mediante Pull Request.

## 13. Preguntas pendientes de validación institucional

1. ¿Cuál será la duración exacta del bloqueo temporal?
2. ¿Qué TTL tendrán los access tokens y refresh tokens?
3. ¿Qué autoridad aprobará y revocará las representaciones legales?
4. ¿Cuál es el texto legal y la versión oficial del consentimiento?
5. ¿Cuál es el plazo de conservación de consentimientos y evidencias de auditoría?
6. ¿Qué endpoints serán públicos y qué perfiles podrán consultar datos completos?
7. ¿Los Usuarios Internos usarán LDAP, proveedor institucional o credenciales propias del SIGD?
8. ¿Qué alcance exacto de poder permitirá presentar cada tipo de trámite?

## 14. Dictamen del documento

**Estado:** **EN PROCESO DE SUBSANACIÓN**.  

El presente documento incorpora las reglas funcionales y técnicas necesarias para que IdentiCore sea implementado sin ambigüedades en el modelo de datos, el DDL y las pruebas de validación. La aprobación definitiva queda condicionada a cerrar los puntos marcados como `PENDIENTE` y a verificar las evidencias de los entregables de la Fase 2.

| Rol | Responsable | Conformidad |
| :--- | :--- | :--- |
| Líder General Backend | Geric (`B_GERIC`) | Pendiente de revisión |
| Sublíder IdentiCore | Segundo (`B_SEGUNDO`) | Pendiente de revisión |
| Analista Funcional | Tapullima (`B_TAPULLIMA`) | En proceso de subsanación |
