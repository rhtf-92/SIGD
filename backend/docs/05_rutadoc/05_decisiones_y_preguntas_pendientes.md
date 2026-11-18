# Decisiones y preguntas pendientes de RutaDoc

- Responsable: Geric
- Rama: B_GERIC
- Grupo: Grupo 1 — RutaDoc
- Estado: PROPUESTA PRELIMINAR
- Validación institucional: PENDIENTE

## 1. Propósito

Este documento centraliza las decisiones adoptadas para el modelo lógico de RutaDoc, los supuestos utilizados para continuar el diseño, las alternativas descartadas preliminarmente y las preguntas que requieren confirmación institucional o coordinación con otros grupos. También registra el impacto que una respuesta futura podría producir sobre el modelo, el diccionario, el diagrama y la implementación posterior.

El contenido no reemplaza una validación institucional. Distingue expresamente decisiones confirmadas para el diseño técnico del Grupo 1 de aquellas que siguen **PROPUESTAS**, se utilizan como **SUPUESTOS** o permanecen **PENDIENTES**. No contiene implementación SQL ni decisiones físicas de PostgreSQL.

## 2. Decisiones confirmadas

Los niveles utilizados son:

- **CONFIRMADA PARA EL DISEÑO:** decisión técnica adoptada por el Grupo 1 para mantener coherencia entre análisis, modelo, diccionario y diagrama.
- **CONFIRMADA INSTITUCIONALMENTE:** solo aplicable cuando exista evidencia institucional explícita. En esta versión no se registra ninguna decisión con este nivel.
- **PENDIENTE DE VALIDACIÓN INSTITUCIONAL:** aspecto que no debe presentarse como regla oficial.

| ID | Decisión | Nivel de confirmación | Fuente o fundamento | Consecuencia para el modelo |
| --- | --- | --- | --- | --- |
| DC-01 | El historial de movimientos es la fuente principal de trazabilidad. | **CONFIRMADA PARA EL DISEÑO** | Análisis funcional y modelo lógico. | `movimiento_tramite` conserva el recorrido; la proyección no lo sustituye. |
| DC-02 | Una corrección o rectificación genera un movimiento nuevo y no modifica destructivamente el anterior. | **CONFIRMADA PARA EL DISEÑO** | Principio de conservación histórica aprobado para el diseño. | Se requieren relaciones entre movimientos y evidencia del evento original. |
| DC-03 | Usuarios, áreas, expedientes y documentos pertenecen a otros módulos y se mantienen como referencias externas. | **CONFIRMADA PARA EL DISEÑO** | Límites funcionales y contratos conceptuales. | RutaDoc conserva identificadores externos, no entidades duplicadas. |
| DC-04 | RutaDoc no duplica datos personales, archivos ni entidades administradas por otros grupos. | **CONFIRMADA PARA EL DISEÑO** | Alcance, privacidad y diccionario. | El modelo limita sus datos al contexto de trazabilidad. |
| DC-05 | El modelo lógico y el diccionario preceden a la implementación física de B_JHASY. | **CONFIRMADA PARA EL DISEÑO** | Distribución técnica del Grupo 1. | Tipos físicos, índices y SQL se difieren. |
| DC-06 | Solicitante y actor del movimiento son conceptos diferentes. | **CONFIRMADA PARA EL DISEÑO** | Análisis funcional y contratos con Grupos 2 y 4. | `usuario_actor_id` identifica al ejecutor, no obliga a representar al solicitante en cada movimiento. |
| DC-07 | Las decisiones no confirmadas se identifican como propuestas o pendientes. | **CONFIRMADA PARA EL DISEÑO** | Criterio de documentación del proyecto. | Acciones, estados, permisos y plazos no se presentan como oficiales. |

## 3. Decisiones propuestas

| ID | Decisión propuesta | Justificación | Impacto | Estado | Validación necesaria |
| --- | --- | --- | --- | --- | --- |
| DP-01 | Usar `movimiento_tramite` como entidad histórica central. | Unifica el orden y contexto del recorrido. | Estructura el modelo completo. | **PROPUESTO** | Revisión técnica del Grupo 1. |
| DP-02 | Mantener catálogos configurables para acciones, estados y tipos de relación. | Evita fijar términos no confirmados. | Permite vigencia histórica. | **PROPUESTO** | Vocabulario institucional. |
| DP-03 | Usar `transicion_estado_tramite` para definir conceptualmente transiciones permitidas. | Facilita validar coherencia entre estado, acción y resultado. | Condiciona el registro de movimientos. | **PROPUESTO** | Matriz institucional definitiva. |
| DP-04 | Utilizar detalles para derivación, recepción, observación y atención. | Separa información específica sin cargar todos los movimientos. | Crea relaciones uno a cero o uno. | **PROPUESTO** | Compatibilidad por acción. |
| DP-05 | Representar inicialmente cierre, reapertura y rectificación mediante movimientos, acciones y relaciones, sin detalles propios. | No existe necesidad funcional demostrada para más entidades. | Mantiene el modelo mínimo. | **PROPUESTO** | Reglas institucionales de esas acciones. |
| DP-06 | Mantener una secuencia única por expediente. | Permite ordenar sin depender solo de fecha-hora. | Afecta unicidad y concurrencia. | **PROPUESTO** | Implementación posterior por B_JHASY. |
| DP-07 | Relacionar movimientos `N:M` mediante `relacion_movimiento`. | Una actuación puede rectificar, subsanar o responder a varias actuaciones. | Preserva relaciones históricas. | **PROPUESTO** | Tipos y multiplicidades permitidos. |
| DP-08 | Relacionar conceptualmente movimientos y documentos `N:M` mediante `movimiento_documento`. | Evita duplicar documentos y admite varias finalidades. | Depende del contrato del Grupo 5. | **PROPUESTO** | Identificadores y versiones documentales. |
| DP-09 | Mantener `estado_actual_tramite` como proyección opcional y reconstruible. | Puede acelerar consultas sin reemplazar el historial. | Añade consistencia derivada. | **PROPUESTA PENDIENTE DE DECISIÓN** | Necesidad técnica y estrategia física. |
| DP-10 | Permitir como máximo una recepción confirmatoria por derivación. | Coincide con la cardinalidad preliminar. | Restringe confirmaciones repetidas. | **PENDIENTE** | Confirmación institucional de recepción manual. |
| DP-11 | Usar códigos lógicos estables en catálogos. | Conserva interpretación histórica aunque un valor se desactive. | Afecta claves únicas conceptuales. | **PROPUESTO** | Definición técnica e institucional. |
| DP-12 | Considerar una clave de idempotencia para prevenir solicitudes duplicadas. | Reduce duplicación ante reintentos. | Añade control técnico al movimiento. | **PENDIENTE** | Diseño físico por B_JHASY. |

## 4. Supuestos de trabajo

| ID | Supuesto | Razón | Riesgo si resulta falso | Acción necesaria |
| --- | --- | --- | --- | --- |
| ST-01 | Los otros grupos proporcionarán identificadores externos estables. | RutaDoc no administra esos recursos. | Referencias ambiguas o historial difícil de interpretar. | Acordar contratos y tratamiento de cambios. |
| ST-02 | Expedientes, áreas, usuarios y documentos podrán consultarse mediante contratos futuros. | Las actuaciones requieren validación externa. | No podría validarse el contexto antes del movimiento. | Definir disponibilidad y respuesta ante fallas. |
| ST-03 | El orden podrá determinarse por expediente y secuencia. | La fecha-hora no resuelve sola la concurrencia. | Movimientos sin orden inequívoco. | B_JHASY deberá definir asignación segura. |
| ST-04 | Las áreas de origen y destino se validarán externamente. | El Grupo 3 es propietario de las áreas. | Derivaciones hacia referencias inválidas. | Coordinar validación de vigencia y autorización. |
| ST-05 | Los catálogos podrán conservar vigencia histórica. | Un valor desactivado puede aparecer en movimientos anteriores. | Pérdida de interpretación del historial. | Definir reglas de activación y consulta histórica. |
| ST-06 | Las actuaciones internas tendrán actor y fecha-hora identificables. | La trazabilidad requiere responsabilidad y tiempo. | Eventos sin atribución suficiente. | Validar excepciones institucionales. |
| ST-07 | Los datos de prueba serán ficticios. | Evita exposición de información real. | Riesgo de privacidad y uso indebido. | Preparar casos académicos ficticios. |
| ST-08 | La institución confirmará después permisos, plazos y nombres oficiales. | Esos datos aún no están disponibles. | El diseño preliminar podría necesitar cambios. | Mantener configurabilidad y registrar impactos. |

## 5. Alternativas descartadas

Estas alternativas se descartan preliminarmente para el diseño actual. Podrán revisarse si aparece evidencia funcional, institucional o técnica nueva.

| ID | Alternativa descartada | Motivo del descarte preliminar |
| --- | --- | --- |
| AD-01 | Guardar únicamente el estado actual sin historial. | Impediría reconstruir el recorrido y explicar cambios anteriores. |
| AD-02 | Sobrescribir movimientos anteriores para corregir errores. | Destruiría evidencia; la rectificación debe crear un movimiento relacionado. |
| AD-03 | Duplicar usuarios, áreas, expedientes o documentos dentro de RutaDoc. | Invadiría responsabilidades externas y produciría datos divergentes. |
| AD-04 | Crear una entidad independiente para cada acción sin necesidad demostrada. | Aumentaría complejidad sin aportar información específica suficiente. |
| AD-05 | Incorporar nombres institucionales no confirmados. | Convertiría propuestas académicas en supuestas reglas oficiales. |
| AD-06 | Fijar acciones y estados directamente en código sin catálogos. | Dificultaría la validación, configuración y vigencia histórica. |
| AD-07 | Definir tipos físicos, índices o bloqueos antes del trabajo de B_JHASY. | Anticiparía decisiones de implementación sin cerrar el modelo lógico. |
| AD-08 | Tratar automáticamente atención, cierre y archivo como una misma acción. | El análisis los diferencia y sus reglas permanecen pendientes. |
| AD-09 | Considerar que el solicitante siempre es el actor interno. | Ambos conceptos pueden corresponder a personas diferentes y un externo puede no estar registrado. |

## 6. Preguntas pendientes

### 6.1 Institucionales

1. ¿Cuáles son los nombres oficiales de las acciones y estados?
2. ¿La recepción en destino requiere confirmación manual?
3. ¿Cuál es la diferencia institucional entre devolución y observación?
4. ¿`DEVUELTO` debe existir como estado o solo como acción?
5. ¿Qué permisos se requieren para derivar, observar, atender, cerrar y reabrir?
6. ¿Qué plazos oficiales afectan cada etapa?
7. ¿Cuándo se considera cerrado y cuándo archivado un trámite?
8. ¿Qué causales y autorizaciones permiten reabrirlo?
9. ¿Se permiten rutas paralelas o intervención simultánea de varias áreas?
10. ¿Cómo se identifica y consulta a un solicitante externo no registrado?
11. ¿Los intentos rechazados deben registrarse en auditoría técnica?
12. ¿Qué reglas de retención, visibilidad y anonimización aplican al historial?

### 6.2 Contratos con otros grupos

1. **Grupo 2:** ¿cuál será el identificador estable del expediente, cómo se referenciará al solicitante y cómo se comprobará la existencia o vigencia del trámite?
2. **Grupo 3:** ¿qué identificadores y reglas de vigencia tendrán áreas, jerarquías, roles y permisos?
3. **Grupo 4:** ¿cuál será el identificador del usuario y cómo se interpretarán usuarios inactivos y actores históricos?
4. **Grupo 5:** ¿cómo se identificarán documentos, versiones y adjuntos, y cómo se expresará la finalidad documental?

### 6.3 Modelo lógico

1. ¿Es necesaria definitivamente la proyección `estado_actual_tramite`?
2. ¿Cuál es la cardinalidad definitiva entre derivación y recepción confirmatoria?
3. ¿Cómo se conservará la vigencia histórica de los catálogos?
4. ¿Cierre, reapertura o rectificación necesitan detalles específicos en el futuro?
5. ¿Existen casos válidos de múltiples atenciones o recepciones para un mismo contexto?
6. ¿Cómo debe interpretarse lógicamente una competencia entre movimientos simultáneos?

### 6.4 Implementación física para B_JHASY

1. ¿Qué tipos físicos representarán cada formato conceptual?
2. ¿Qué estrategia se usará para los identificadores?
3. ¿Cómo se implementarán las claves foráneas locales?
4. ¿Cómo se validarán las referencias externas sin duplicarlas?
5. ¿Qué índices serán necesarios?
6. ¿Qué restricciones físicas implementarán las reglas aprobadas?
7. ¿Qué estrategia de concurrencia y bloqueos se utilizará?
8. ¿Cómo se implementará la idempotencia?
9. ¿Qué límites transaccionales garantizarán movimiento, detalle y proyección coherentes?
10. ¿Cómo se organizarán las migraciones?
11. ¿Qué pruebas PostgreSQL verificarán integridad, concurrencia y recuperación?

## 7. Dependencias con otros grupos

| Grupo | Información requerida | Entidades locales afectadas | Riesgo si no se define | Estado | Acción de coordinación |
| --- | --- | --- | --- | --- | --- |
| Grupo 2 | Identificador del expediente, referencia del solicitante y vigencia. | `movimiento_tramite`, `estado_actual_tramite` | No asociar o interpretar correctamente el recorrido. | **PENDIENTE** | Acordar identificadores, consulta e históricos. |
| Grupo 3 | Identificadores y vigencia de áreas, roles y permisos. | `movimiento_tramite`, `derivacion_tramite`, `recepcion_tramite` | Traslados o autorizaciones inválidos. | **PENDIENTE** | Definir validación, inactivos y permisos. |
| Grupo 4 | Identificador del actor, usuarios inactivos y externo no registrado. | `movimiento_tramite` | Actuaciones sin atribución o duplicación personal. | **PENDIENTE** | Coordinar actor histórico y solicitante con Grupo 2. |
| Grupo 5 | Identificador de documentos, versiones, adjuntos y finalidades. | `movimiento_documento`, `atencion_tramite` | Vínculos documentales ambiguos o rotos. | **PENDIENTE** | Acordar contratos, versiones y acceso histórico. |

B_JHASY pertenece al Grupo 1 y depende de la aprobación del modelo lógico y el diccionario para desarrollar la implementación física. Esa dependencia no convierte decisiones pendientes en reglas aprobadas.

## 8. Impacto de futuras validaciones

| Decisión pendiente | Posible respuesta | Archivos afectados | Impacto esperado | Responsable de actualización |
| --- | --- | --- | --- | --- |
| Nombres oficiales de acciones y estados | Confirmar o renombrar términos. | Modelo, diccionario, diagrama, catálogos y transiciones. | Ajuste de códigos y descripciones sin perder historia. | Geric; coordinación institucional. |
| Recepción manual | Exigida o automática. | Modelo, diccionario, diagrama y matriz de transiciones. | Cambia cardinalidad y obligatoriedad de recepción. | Geric; luego B_JHASY en implementación. |
| `DEVUELTO` | Estado o solo acción. | Modelo, diccionario, catálogos y transiciones. | Elimina una alternativa preliminar. | Geric. |
| Rutas paralelas | Permitidas o no. | Modelo, diccionario y futura implementación. | Puede requerir nuevas reglas de secuencia y concurrencia. | Geric y B_JHASY. |
| Proyección de estado actual | Aprobar o descartar. | Modelo, diccionario, diagrama e implementación futura. | Mantiene o elimina la proyección sin afectar el historial. | Geric y B_JHASY. |
| Solicitante externo no registrado | Definir referencia contractual. | Modelo, diccionario y contratos. | Precisa integración sin convertirlo en actor obligatorio. | Grupos 2 y 4; actualización de Geric. |
| Cierre, reapertura y archivo | Confirmar reglas y diferencias. | Modelo, diccionario, catálogos y transiciones. | Ajusta condiciones o detalles especializados. | Geric; implementación posterior de B_JHASY. |
| Permisos y plazos | Definir reglas oficiales. | Modelo, diccionario, matriz y futura implementación. | Añade validaciones configuradas sin reescribir eventos anteriores. | Grupos propietarios y B_JHASY. |
| Contratos externos | Confirmar identificadores y vigencia. | Modelo, diccionario e implementación futura. | Estabiliza referencias y tratamiento histórico. | Grupos 2, 3, 4 y 5. |
| Concurrencia e idempotencia | Elegir estrategia física. | Diccionario e implementación futura. | Define controles sin alterar el modelo histórico. | B_JHASY. |

Las validaciones futuras no deberán provocar pérdida del historial ni reescribir evidencias anteriores. Todo cambio deberá preservar la interpretación de movimientos ya registrados.

## 9. Registro de revisiones

| Versión | Fecha | Responsable | Cambio | Estado |
| --- | --- | --- | --- | --- |
| 0.1 | 2026-08-27 | Geric | Registro preliminar de decisiones, supuestos, alternativas, preguntas, dependencias e impactos de RutaDoc. | **PROPUESTA PRELIMINAR — VALIDACIÓN PENDIENTE** |
