# Diagnóstico Integral del Módulo IdentiCore

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" - Pucallpa, Ucayali, Perú  
**Área:** Backend  
**Grupo evaluado:** Grupo 4 - IdentiCore  
**Rama de referencia:** `B_TAPULLIMA`  
**Fecha del diagnóstico:** 2 de septiembre de 2026  
**Estado:** **OBSERVADO - REQUIERE SUBSANACIÓN Y EVIDENCIA TÉCNICA**

## 1. Propósito

Evaluar el estado funcional, técnico, documental y de trazabilidad del módulo IdentiCore a partir de los cuatro documentos de referencia:

1. [INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md](INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md).
2. [Plan_de_mejora_nivel_backend_SIGD.md](Plan_de_mejora_nivel_backend_SIGD.md).
3. [README.md](README.md) del portal maestro de documentación.
4. [01_plan_levantamiento_observaciones_grupo_1_rutadoc.md](levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md), usado como referencia de estructura, gobernanza y dependencias intermodulares.

Para verificar el estado real de IdentiCore también se contrastaron sus artefactos publicados: análisis funcional, modelo de datos, SQL y validación técnica.

> Este documento distingue entre existencia documental, propuesta de diseño y evidencia de ejecución. Un archivo publicado no demuestra por sí mismo que el diseño haya sido ejecutado, integrado o validado.

## 2. Resumen ejecutivo

IdentiCore dispone de una primera separación conceptual entre identidad civil, cuenta de usuario y perfil institucional. Esta base permite continuar el diseño, pero todavía no satisface el blueprint de Fase 2 ni puede declararse conforme al 100%.

El riesgo principal es la **desalineación entre lo que se declara y lo que está demostrado**:

- El README afirma una conformidad global de `62 / 62 (100%)`.
- El informe de validación de IdentiCore declara expresamente `NO VERIFICADA EN ESTE ENTORNO` y marca todos sus casos como `NO EJECUTADO`.
- El plan de mejora propone modelo polimórfico, Argon2id, JWT RS256, 2FA y casilla electrónica, pero el SQL actual conserva un modelo único `personas`, usa un hash de prueba con formato bcrypt y no contiene sesiones, consentimiento ni representación legal.
- El informe forense presenta calificaciones y autorías que no son consistentes entre su gráfico y su detalle narrativo.

**Dictamen:** el módulo se encuentra en estado **documental preliminar / subsanación en curso**. La prioridad inmediata es congelar una fuente de verdad v2.0, corregir el contrato de autoría y ejecutar pruebas reproducibles sobre PostgreSQL antes de afirmar conformidad.

## 3. Estado frente a los criterios principales

| Área evaluada | Estado actual | Evidencia | Diagnóstico |
| :--- | :--- | :--- | :--- |
| Clasificación de usuarios | Parcial | Análisis funcional y `perfil_usuario` | Distingue interno/externo y con/sin cuenta, pero no formaliza casilla electrónica ni una taxonomía única de Fase 2. |
| Personas naturales y jurídicas | No implementado | Modelo y SQL actuales | Existe una sola tabla `personas`; no existen `persona_natural` ni `persona_juridica`. |
| Representación legal SUNARP | No implementado | Artefactos actuales | No existe `representacion_legal`, vigencia, revocación ni control de solapamiento. |
| DNI/RUC | Insuficiente | SQL actual | Hay unicidad documental, pero no CHECK estricto de DNI/RUC ni checksum Módulo 11. |
| Credenciales | Insuficiente | `cuenta_usuario` y datos de prueba | El algoritmo Argon2id no está definido en el SQL; el dato de prueba usa una cadena con apariencia bcrypt. |
| Bloqueo de cuenta | Parcial | `intentos_fallidos`, `bloqueado_hasta` | Hay columnas, pero no existe lógica demostrada de cinco intentos, duración, reinicio ni actualización atómica. |
| Sesiones y refresh tokens | No implementado | Ausencia en SQL/modelo | No existe `sesion_usuario`, rotación, hash de token ni detección de reutilización. |
| Consentimiento Ley N.° 29733 | No implementado | Ausencia en SQL/modelo | No existe `consentimiento_datos` ni historial de revocación inmutable. |
| Casilla electrónica | No implementado | Plan de mejora como propuesta | No existe entidad, estado, activación ni contrato de notificaciones. |
| Ofuscación pública | No implementado | No hay DTOs ni serializadores | No se demostraron reglas de transformación para DNI, RUC, correo, nombres o teléfono. |
| Validación técnica | Pendiente | `04_validacion_usuarios.md` | Los cinco casos están documentados como no ejecutados. |
| Integración intermodular | Parcial | Referencias conceptuales | Los IDs y dependencias están descritos, pero no existe contrato físico v2.0 consolidado. |
| Trazabilidad de autoría | Observado | Auditoría, plan y ramas | Hay discrepancias entre responsables, calificaciones y entregables efectivos. |

## 4. Hallazgos priorizados

### H-01. Declaración de conformidad incompatible con la evidencia

**Severidad:** Crítica  
**Tipo:** Gobernanza y calidad

El portal maestro declara que Grupo 4 cumple `10 / 10 (100%)`, mientras que la validación técnica del módulo indica que los casos no fueron ejecutados y que los resultados son únicamente esperados.

**Impacto:** Se puede aprobar un diseño no probado y transmitir a los grupos consumidores contratos que aún no existen.

**Acción requerida:** Cambiar el estado global de IdentiCore a `OBSERVADO` o `PENDIENTE DE VALIDACIÓN`; actualizar la matriz solo después de adjuntar evidencia de ejecución, salida de comandos y commit verificable.

### H-02. El modelo actual no implementa la solución polimórfica

**Severidad:** Crítica  
**Tipo:** Arquitectura de datos

El modelo y el DDL usan `personas` como entidad única con nombres, apellidos y documento. El plan de mejora exige `persona` como base y los subtipos `persona_natural` y `persona_juridica`, además de `representacion_legal`.

**Impacto:** No se puede representar de forma íntegra una empresa, su razón social, RUC, partida SUNARP y representantes vigentes. También queda sin garantía la herencia exclusiva 1:1.

**Acción requerida:** Definir una única fuente de verdad v2.0 y migrar el modelo, diccionario, diagrama, SQL y pruebas de forma coordinada.

### H-03. No hay controles suficientes para documentos de identidad

**Severidad:** Alta  
**Tipo:** Integridad de datos

El SQL solo aplica `UNIQUE (tipo_documento_id, numero_documento)`. No valida que el DNI tenga 8 dígitos, que el RUC tenga prefijo permitido ni que su dígito verificador cumpla Módulo 11.

**Impacto:** Pueden registrarse identificadores con formato inválido y la unicidad puede proteger datos incorrectos.

**Acción requerida:** Incorporar normalización, restricciones de formato y función de checksum RUC; cubrir casos válidos e inválidos en la suite.

### H-04. Credenciales y sesiones no alcanzan el estándar propuesto

**Severidad:** Crítica  
**Tipo:** Seguridad

`cuenta_usuario` solo contiene `password_hash`, contador y fecha de bloqueo. El diseño no fija Argon2id, no contiene `sesion_usuario`, no almacena hashes de refresh tokens, no define familias de tokens y no demuestra RS256.

Aunque el dato de prueba no es una contraseña real, su prefijo `$2b$` representa bcrypt y contradice la decisión propuesta de Argon2id si se interpreta como valor operativo.

**Impacto:** No hay rotación ni detección de reuso de tokens y no puede auditarse el ciclo de vida de sesiones.

**Acción requerida:** Definir parámetros Argon2id (`memoryCost = 65536` KiB, `timeCost = 3`, `parallelism = 4`), crear `sesion_usuario`, aplicar hash de refresh token, revocación por familia y pruebas de bloqueo/rotación.

### H-05. Casilla electrónica y consentimiento no están modelados

**Severidad:** Crítica  
**Tipo:** Cumplimiento y privacidad

No existe `consentimiento_datos` ni una entidad o estado de casilla electrónica. El modelo actual no registra finalidad, versión de términos, aceptación de notificaciones, fecha UTC, IP, User-Agent ni revocación histórica.

**Impacto:** No existe evidencia auditable suficiente para demostrar aceptación explícita ni para impedir notificaciones después de la revocación.

**Acción requerida:** Incorporar la entidad de consentimiento con historial inmutable, vincular su estado a la activación de la casilla y definir la política institucional de conservación.

### H-06. Representación legal carece de integridad y efecto operativo

**Severidad:** Alta  
**Tipo:** Negocio y legal

No existe una relación estricta entre persona natural apoderada y persona jurídica representada. Tampoco existen fechas de vigencia, fuente SUNARP, revocación ni prohibición de solapamiento.

**Impacto:** El sistema no puede determinar si una persona está habilitada para presentar un nuevo trámite en nombre de una empresa.

**Acción requerida:** Crear `representacion_legal` con FKs a los subtipos correctos, rango de vigencia, alcance del poder y restricción de no solapamiento. Rechazar nuevos trámites con poder vencido o revocado y conservar el historial de trámites anteriores.

### H-07. La ofuscación pública no tiene implementación demostrable

**Severidad:** Alta  
**Tipo:** Privacidad

El plan de mejora menciona ofuscación, pero los artefactos actuales no incluyen serializadores, DTOs, endpoints ni pruebas. Por tanto, no se demuestra que los datos permanezcan completos en la base y se transformen únicamente en APIs públicas.

**Impacto:** Exposición accidental de datos personales o aplicación incorrecta de la ofuscación sobre datos persistidos.

**Acción requerida:** Implementar funciones deterministas en la capa de presentación y probar la matriz exacta de DNI, CE/Pasaporte, RUC, correo, nombres y teléfono.

### H-08. Dependencias intermodulares aún están parcialmente abiertas

**Severidad:** Media  
**Tipo:** Integración

El plan de RutaDoc mantiene como pendiente el identificador del actor y la referencia de solicitantes externos sin cuenta. TramiCore también describe la referencia a IdentiCore como propuesta. Esto es compatible con una fase preliminar, pero no con una afirmación de contrato consolidado.

**Impacto:** Riesgo de duplicar personas o usar tipos incompatibles de identificadores entre esquemas.

**Acción requerida:** Publicar un contrato de integración que defina `id_persona`, `id_cuenta_usuario`, actor histórico, solicitante sin cuenta y comportamiento de identidades inactivas.

### H-09. Inconsistencias en la auditoría de autoría y calificaciones

**Severidad:** Alta  
**Tipo:** Trazabilidad académica

El informe forense muestra discrepancias internas: el gráfico presenta a Jair con `17/20`, mientras el detalle indica `16/20`; el gráfico presenta a Segundo con `10/20`, mientras el detalle cambia a Jhair Valdivieso con `00/20`. Además, el diagnóstico de Tapullima se basa en una entrega preliminar, mientras que el plan de Fase 2 exige un nuevo documento funcional de subsanación.

**Impacto:** La evaluación individual y la responsabilidad de los entregables no son reproducibles.

**Acción requerida:** Corregir el informe con una tabla única de identidad, correo Git, rama, commit, archivo, líneas computables y calificación. Separar claramente evidencia histórica de la entrega de Fase 2.

## 5. Diagnóstico funcional

### 5.1 Fortalezas

- El análisis inicial identifica actores relevantes: administrador, Mesa de Partes, servidor interno y ciudadano/entidad.
- Se reconoce que una persona externa puede intervenir sin una cuenta permanente.
- El modelo separa conceptualmente identidad, credenciales y perfil institucional.
- Se evita utilizar el número de documento como clave primaria técnica.
- El plan de trabajo define una secuencia razonable: análisis funcional, modelo, SQL, pruebas e integración.

### 5.2 Brechas funcionales

- La clasificación de Fase 2 debe unificar definitivamente las categorías: Usuario Interno, Externo Registrado con Casilla Electrónica y Externo No Registrado Atendido en Ventanilla.
- El flujo de registro no define activación de casilla ni consentimiento explícito.
- El flujo empresarial no define cómo se acredita el poder ni qué ocurre ante vencimiento o revocación.
- El flujo de autenticación no define bloqueo, sesiones, cierre de sesión, rotación ni recuperación segura.
- La consulta pública no tiene reglas de privacidad implementadas ni criterios de autorización.
- Los responsables institucionales y los plazos de validación externa siguen pendientes.

## 6. Diagnóstico técnico

### 6.1 Persistencia

El DDL actual es un borrador ejecutable de seis tablas, pero corresponde al modelo preliminar y no a la arquitectura v2.0 descrita en el plan de mejora. Usa `BIGSERIAL`, referencias conceptuales a OrganiCore y restricciones básicas, pero no implementa el esquema `sigd_auth` ni sus entidades nuevas.

### 6.2 Seguridad

El contador y la fecha de bloqueo son solo almacenamiento de estado; no constituyen por sí mismos un mecanismo de defensa contra fuerza bruta. Tampoco hay evidencia de comparación segura de hashes, límites de tasa, auditoría de login, rotación de claves RS256 o invalidación de sesiones.

### 6.3 Calidad de pruebas

La validación existente es una especificación de pruebas, no una ejecución. El criterio mínimo para cerrar esta brecha es conservar:

- Comando ejecutado y versión del motor.
- Base de prueba limpia y datos ficticios.
- Resultado real por caso.
- Error esperado en casos negativos.
- Evidencia de restricciones consultadas en PostgreSQL.
- Commit y rama del responsable.

## 7. Plan de subsanación priorizado

| Prioridad | Acción | Responsable sugerido | Evidencia de cierre |
| :---: | :--- | :--- | :--- |
| P0 | Corregir la matriz global y el informe forense para que no declaren conformidad sin ejecución. | Líder / Sublíder | Informe y README corregidos con fuente de evidencia. |
| P0 | Aprobar la fuente de verdad v2.0 para entidades, nombres, PK y contratos. | Segundo / Jair / Tapullima | Modelo, diccionario y decisiones alineados. |
| P0 | Implementar `persona`, `persona_natural`, `persona_juridica` y herencia exclusiva 1:1. | Jair / Segundo | DDL y pruebas de integridad. |
| P0 | Implementar `representacion_legal` y vigencias sin solapamiento. | Jair / Tapullima | DDL, casos vencido/revocado y flujo funcional. |
| P0 | Implementar Argon2id, sesiones rotativas y bloqueo temporal. | Segundo | Pruebas de hash, rotación, reuso, expiración y bloqueo. |
| P1 | Implementar `consentimiento_datos` y casilla electrónica. | Segundo / Tapullima | Modelo, DDL y auditoría de revocación. |
| P1 | Implementar serializadores de ofuscación y matriz de pruebas. | Backend / CoreLink | Pruebas de DTO público e inspección de dato persistido. |
| P1 | Cerrar contrato con TramiCore, RutaDoc y OrganiCore. | Segundo / Líderes de módulo | Documento de contrato firmado o aprobado. |
| P2 | Ejecutar validación en PostgreSQL 18 y publicar resultados reales. | Jair | `04_validacion_identicore_v2.md` con evidencia. |
| P2 | Integrar mediante Pull Request conservando commits individuales. | Segundo / Geric | PR aprobado y ramas verificables. |

## 8. Criterios para cambiar a conforme

IdentiCore podrá pasar a `CONFORME` solo cuando se cumplan simultáneamente estas condiciones:

1. El README, el informe de auditoría y los planes muestran el mismo estado.
2. El modelo, diccionario, diagrama y DDL usan los mismos nombres y cardinalidades.
3. Cada persona tiene exactamente un subtipo natural o jurídico.
4. DNI y RUC se rechazan cuando incumplen formato o checksum.
5. La representación legal solo permite apoderado natural, representada jurídica y vigencia no superpuesta.
6. Las contraseñas usan Argon2id y los refresh tokens se almacenan únicamente como hash.
7. La reutilización de refresh token revoca la familia correspondiente.
8. Cinco intentos fallidos producen bloqueo temporal y el comportamiento está probado.
9. Consentimientos y revocaciones se conservan como historial inmutable.
10. La casilla solo envía notificaciones con consentimiento vigente.
11. Las APIs públicas aplican la matriz de ofuscación sin modificar la base de datos.
12. La suite técnica se ejecuta en una base limpia y sus resultados son reproducibles.
13. La autoría de cada entregable se verifica en la rama personal y en el historial Git.

## 9. Conclusión

El Grupo 4 cuenta con una base documental útil y una dirección arquitectónica clara, pero la evidencia actual corresponde a un **borrador preliminar**, no a una implementación v2.0 validada. Las observaciones más urgentes son la falta del modelo polimórfico real, las capacidades de seguridad y sesión, el consentimiento de datos, la representación legal y la contradicción entre conformidad declarada y pruebas no ejecutadas.

**Dictamen final:** **OBSERVADO - EN PROCESO DE SUBSANACIÓN**. La aprobación debe condicionarse a la implementación y ejecución de las acciones P0, seguida de una revisión cruzada del modelo, SQL, pruebas y contratos intermodulares.
