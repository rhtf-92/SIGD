# Análisis Funcional: Trámite, Expediente y Libro de Registro (SIGD)
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)
**Grupo de Trabajo:** Documentos de Trabajo Grupo 2 – “TramiCore”
**Responsable del Análisis:** Leysglin Riquelmer Fachin Rojas (Rama: `B_RIQUELMER`)
**Sublíder / Integrador:** Elmer Ramírez (`B_RAMIREZ`)
**Versión:** 2.1 (Fase 1 – Cumplimiento estricto de rotulado y criterios de aceptación)

---

## 1. Objetivo y Alcance del Módulo

### 1.1 Objetivo
Definir el núcleo documental del SIGD, diferenciando conceptualmente trámite, expediente, documento y asiento del libro de registro. Se establece la separación entre identificadores técnicos internos y códigos visibles, se definen los actores, se detallan los flujos operativos paso a paso y se formulan las preguntas institucionales pendientes.

### 1.2 Alcance
Comprende desde la presentación de la solicitud en Mesa de Partes hasta el asentado en el Libro de Registro, la conformación del expediente, la actualización controlada, la atención por las áreas y la entrega de eventos al módulo de trazabilidad (Grupo 1). No fija formatos definitivos ni reemplaza las reglas oficiales que determine la institución.

---

## 2. Diferenciación Conceptual con Ejemplos Propios

* **Trámite `[PROPUESTO]`:** Gestión, petición o requerimiento administrativo formal que promueve un administrado o trabajador con un propósito específico.
  * *`[EJEMPLO]`*: Un estudiante solicita la emisión de su "Certificado Oficial de Estudios" o un docente solicita "Licencia con goce de haber".
* **Expediente `[PROPUESTO]`:** Unidad documental lógica, acumulativa y cronológica que agrupa todos los escritos, proveídos, informes técnicos y resoluciones vinculadas a un mismo trámite.
  * *`[EJEMPLO]`*: La carpeta digital identificada provisionalmente con el código `EXP-2026-000104`, que reúne el FUT, el comprobante de pago, el informe de notas y la resolución de entrega.
* **Documento Presentado `[PROPUESTO]`:** Unidad física o digital de sustento (solicitud, oficio, informe en PDF, comprobante) que acredita o fundamenta una actuación dentro del expediente.
  * *`[EJEMPLO]`*: El archivo digitalizado `FUT_solicitud_firmada.pdf` de 2 folios o el comprobante de caja `recibo_pago_0891.pdf`.
* **Asiento del Libro de Registro `[PROPUESTO]`:** Constancia oficial, fechada y numerada de forma secuencial en el Libro General de Registros que acredita formalmente un evento ocurrido. Una vez generado, el asiento **no se elimina y su número no se reutiliza**; solo pueden actualizarse sus campos de control de anulación.
  * *`[EJEMPLO]`*: Asiento Nº `00004521`, asentado el `28/08/2026 09:15:02`, que certifica que el expediente `EXP-2026-000104` ingresó por Mesa de Partes Virtual y se derivó a Secretaría Académica.

---

## 3. Identificadores Técnicos Internos vs. Códigos Visibles

* **Identificadores Técnicos Internos `[PROPUESTO]`:**
  * Claves primarias (`id` autoincremental / `BIGSERIAL` o `UUID`) gestionadas internamente por el motor PostgreSQL.
  * Nunca se exponen al usuario final ni se emplean como código de trámite en ventanilla.
  * Aseguran la integridad referencial y las relaciones entre tablas de la base de datos.
* **Códigos Visibles y de Negocio `[PROPUESTO]`:**
  * Estructuras de texto legibles para el administrado y los operadores.
  * Sujetos a modificación según directiva institucional sin alterar las claves primarias técnicas de la base de datos.
  * Se prohíbe el uso de `MAX() + 1` para su generación; se gestionan mediante secuencias transaccionales seguras de PostgreSQL (`SEQUENCE`).

---

## 4. Actores del Sistema y Roles Definidos

* **Administrado / Solicitante (Externo o Interno) `[PROPUESTO]`:**
  * *Responsabilidad:* Registra la solicitud por Mesa de Partes (presencial o virtual), aporta datos de contacto, adjunta requisitos y realiza el seguimiento del trámite.
* **Operador de Mesa de Partes `[PROPUESTO]`:**
  * *Responsabilidad:* Valida formalmente los requisitos y folios, apertura el expediente, asienta el ingreso en el Libro de Registro y emite el cargo oficial.
* **Especialista / Funcionario de Área Resolutora `[PROPUESTO]`:**
  * *Responsabilidad:* Revisa el fondo del requerimiento, emite informes u oficios de respuesta, solicita subsanaciones o deriva el expediente a otra oficina.
* **Jefe de Área / Autoridad Institucional `[PROPUESTO]`:**
  * *Responsabilidad:* Suscribe el acto resolutivo final, autoriza reasignaciones y dispone el cierre o reapertura formal del expediente.
* **Administrador del Sistema SIGD `[PROPUESTO]`:**
  * *Responsabilidad:* Configura periodos de numeración, audita la inmutabilidad de los asientos y ejecuta anulaciones lógicas bajo justificación administrativa.

---

## 5. Datos de Entrada, Remitente y Destinatario

### 5.1 Datos del Remitente `[CONFIRMADO]`
* **Tipo de Persona:** Natural o Jurídica `[PROPUESTO]`.
* **Tipo y Número de Identificación:** DNI, Carné de Extranjería o RUC `[PROPUESTO]`.
* **Nombres y Apellidos / Razón Social:** Nombre legal acreditable `[PROPUESTO]`.
* **Datos de Contacto:** Correo electrónico, teléfono celular y domicilio fiscal o real `[PROPUESTO]`.
* *Regla de integración:* Se vincula mediante clave foránea al módulo de personas/administrados del Grupo 4 sin duplicar datos personales en las tablas de trámite. El solicitante externo puede ser registrado de forma asistida por Mesa de Partes sin exigir credenciales (ver §5.4).

### 5.2 Datos del Destinatario `[CONFIRMADO]`
* **Unidad Orgánica / Dependencia:** Área de destino competente (ej. Dirección General, Secretaría Académica, Logística) `[PROPUESTO]`.
* **Funcionario Destino:** Usuario asignado dentro del área destinataria `[PENDIENTE]`.
* *Regla de integración:* Se vincula mediante referencia al catálogo organizacional del Grupo 3.

### 5.3 Datos del Cuerpo del Registro `[CONFIRMADO]`
* **Tipo de Documento de Origen:** Solicitud (FUT), Oficio, Memorándum, Carta `[PROPUESTO]`.
* **Número de Documento de Origen:** Código visible del documento presentado (ej. `OF-015-2026-MINEDU`) `[EJEMPLO]`.
* **Asunto / Sumilla:** Resumen del requerimiento solicitado (máximo 500 caracteres) `[PROPUESTO]`.
* **Folios Declarados:** Cantidad física de hojas sustentatorias `[PROPUESTO]`.
* **Canal de Ingreso:** `MESA_PRESENCIAL` o `MESA_VIRTUAL` `[PROPUESTO]`.
* **Documentos Digitalizados:** Archivos adjuntos en formato PDF/A `[PROPUESTO]`.

### 5.4 Solicitante Externo sin Usuario Registrado `[PROPUESTO]`
* **Contexto:** Todo administrado puede presentar documentos ante Mesa de Partes sin haber creado una cuenta ni haber ingresado al SIGD (Grupo 4).
* **Representación propuesta:** Los datos de identidad (tipo y número de identificación, nombres y apellidos, contacto) se capturan en Mesa de Partes mediante un registro **asistido** en el módulo de personas/administrados del Grupo 4, sin exigir credenciales de acceso.
* **Referencia técnica:** `fk_remitente` referencia el registro interno de la persona (correlativo de administrado), no una cuenta de usuario; los trámites internos de funcionarios sí usan su cuenta de usuario existente.
* **Caso pendiente:** Validar con el profesor si el SIGD mantiene un registro maestro de administrados externos o si se conserva un duplicado mínimo de datos en cada trámite.

---

## 6. Reglas de Códigos, Formatos y Numeración

> **Aclaración Metodológica:** Los siguientes formatos, estructuras y reglas corresponden a propuestas técnicas de trabajo y ejemplos demostrativos; no representan una especificación institucional oficial.

### 6.1 Código de Expediente / Trámite
* **Formato Propuesto `[PROPUESTO]`:** `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `EXP-2026-000001`
* **Criterio de Negocio `[PROPUESTO]`:** Unicidad por año fiscal; el correlativo se reinicia cada 1 de enero si la directiva institucional así lo estipula `[PENDIENTE]`.

### 6.2 Código de Documento de Origen
* **Formato Propuesto `[PROPUESTO]`:** `[TIPO_DOC]-[CORRELATIVO 4 DÍGITOS]-[AÑO]-[SIGLA_AREA]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `OFIC-0012-2026-DSI`
* **Criterio de Negocio `[PROPUESTO]`:** Identifica la procedencia y tipología del escrito dentro del expediente `[PROPUESTO]`.

### 6.3 Numeración de Asientos en el Libro General de Registros
* **Propuesta de Correlativo Global `[PROPUESTO]`:** La numeración de asientos **NO** es individual por expediente, sino una secuencia única y global de todo el sistema documental para garantizar auditoría institucional. La secuencia es monotónica y sin duplicados; si una transacción consume un valor de `nextval()` y luego se revierte, quedará un hueco en la numeración, lo cual es aceptable y no afecta la integridad del Libro.
* **Ejemplos Demostrativos de Secuencia `[EJEMPLO]`:** `00000001`, `00000002`, `00000003`, etc.
* **Criterio Técnico de Generación `[PROPUESTO]`:** Se prohíbe el uso de `SELECT MAX(...) + 1` por fallas ante peticiones simultáneas; se generará mediante secuencias transaccionales nativas de PostgreSQL (`SEQUENCE`).

### 6.4 Tratamiento de Anulaciones y Preservación de Historial
* **Mecanismo de Anulación `[PROPUESTO]`:** Ante anulaciones autorizadas, los registros nunca se eliminan físicamente de la base de datos (`NO DELETE`). La anulación se aplica **sobre el propio asiento** mediante la bandera `anulado = true` más el campo `motivo_anulacion`, sin reutilizar ni reasignar su `numero_registro`.
* **Registro de Auditoría `[PROPUESTO]`:** El asiento original no se elimina y su número no se reutiliza; únicamente se actualizan sus campos de control de anulación (`anulado`, `motivo_anulacion`). La anulación **no genera un asiento nuevo** y el evento se entrega al módulo de trazabilidad (Grupo 1) para auditoría pública.

---

## 7. Flujos Operativos Detallados Paso a Paso

### 7.1 Flujo Normal: Presentación y Registro Inicial
1. **Presentación de Documentación:**
   * *Entrada:* Datos del remitente, asunto, dependencia destino, folios y archivo PDF.
   * *Responsable:* Administrado / Operador de Mesa de Partes.
2. **Validación Formal de Requisitos:**
   * *Validación:* Verificación de legibilidad, identificación del solicitante y cumplimiento de requisitos TUPA.
   * *Responsable:* Operador de Mesa de Partes.
3. **Creación del Expediente:**
   * *Procesamiento:* El sistema crea el contenedor con estado `REGISTRADO` y genera su código visible propuesto (ej. `EXP-2026-000001` `[EJEMPLO]`).
   * *Responsable:* Sistema SIGD.
4. **Asentado en el Libro General de Registros:**
   * *Procesamiento:* Generación automática del asiento de correlativo global propuesto (ej. Asiento `00001205` `[EJEMPLO]`).
   * *Responsable:* Sistema SIGD.
5. **Emisión de Cargo:**
   * *Resultado:* Comprobante con sello de recepción y código de verificación.
   * *Responsable:* Mesa de Partes.
6. **Derivación Inicial y Trazabilidad:**
   * *Procesamiento:* El expediente cambia a estado `EN_TRAMITE`, pasa a la bandeja del área de destino y despacha el evento al módulo de trazabilidad (Grupo 1).
   * *Responsable:* Mesa de Partes / Sistema.

### 7.2 Flujos Excepcionales Paso a Paso

* **Excepción 1: Requisitos Incompletos o Defectuosos `[PROPUESTO]`**
  * *Condición:* Documentación ilegible o ausencia de requisitos obligatorios.
  * *Acción:* Mesa de Partes asigna estado `OBSERVADO`, registra la observación formal y notifica al administrado otorgando un plazo legal de 48 horas (2 días hábiles) para subsanar. Si vence el plazo sin subsanación, pasa a estado `ARCHIVADO` por abandono.
* **Excepción 2: Destino Inválido o Devolución por Incompetencia `[PROPUESTO]`**
  * *Condición:* El área receptora determina que la atención no compete a sus funciones.
  * *Acción:* El especialista registra la devolución motivada. El expediente retorna a Mesa de Partes mediante un nuevo asiento de retorno, sin alterar asientos previos, para su reasignación.
* **Excepción 3: Intento de Numeración Repetida / Concurrencia Simultánea `[PROPUESTO]`**
  * *Condición:* Dos operadores intentan registrar un documento en el mismo milisegundo.
*   *Acción:* Se descarta `MAX() + 1`. Se implementan secuencias atómicas de PostgreSQL (`SEQUENCE`) para asegurar correlatividad monotónica y **sin duplicados**; se admite que existan **huecos** ante reversiones (`ROLLBACK`) posteriores a la consumición de un valor.
* **Excepción 4: Detección de Trámite Duplicado `[PROPUESTO]`**
  * *Condición:* Ingreso de una solicitud con idéntico remitente, tipo de documento y número dentro del mismo año fiscal.
  * *Acción:* El sistema emite advertencia bloqueante en pantalla. El operador valida si es reiteración o si debe anexarse al expediente preexistente.
* **Excepción 5: Expediente sin Documentos Adjuntos Requeridos `[PROPUESTO]`**
  * *Condición:* Formulario enviado sin PDF de sustento adjunto.
  * *Acción:* Validación que aborta la operación (`ROLLBACK`). No se autoriza la creación de expedientes vacíos.
* **Excepción 6: Registro Anulado `[PROPUESTO]`**
  * *Condición:* Error material comprobado o registro fraudulento.
  * *Acción:* Se marca el asiento como `anulado = true` con su `motivo_anulacion`, sin `DELETE` ni reutilización del número. El asiento original no se elimina y solo se actualizan sus campos de control de anulación; el expediente pasa al estado `ANULADO` y el evento de anulación queda registrado en trazabilidad (Grupo 1).
* **Excepción 7: Desistimiento Voluntario `[PROPUESTO]`**
  * *Condición:* El solicitante desiste formalmente antes de la resolución final.
  * *Acción:* Se anexa el documento de desistimiento y el expediente cambia al estado `CERRADO`.
* **Excepción 8: Reapertura Excepcional `[PROPUESTO]`**
  * *Condición:* Presentación de recurso impugnatorio fundado contra un trámite cerrado.
  * *Acción:* Con autorización de la autoridad institucional, el expediente cambia a estado `REABIERTO`, preservando su historial íntegro.

---

## 8. Matriz Funcional Propuesta

| Operación / Función `[PROPUESTO]` | Entradas (Inputs) | Procesamiento y Reglas de Negocio | Salidas (Outputs) | Estado Resultante | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar Trámite** | Remitente, destinatario, asunto, folios, PDF. | Valida requisitos, asigna ID técnico, genera código visible y crea asiento global. | Expediente creado, Asiento emitido, Cargo de recepción. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | Código visible o Documento de Identidad. | Filtra por permisos de usuario y expone metadatos y cronología de asientos. | Ficha del expediente, lista de documentos y trazabilidad. | *(Sin cambio)* | Público / Funcionarios |
| **Corregir / Subsanar** | Escrito de subsanación o corrección material. | Válido únicamente en estado `OBSERVADO` o error justificado. No destruye historial. | Asiento de subsanación, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | Cód. expediente, área destino, proveído. | Verifica tenencia activa; genera nuevo asiento de movimiento. | Notificación al área receptora, Asiento de derivación. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento resolutivo final, notificación. | Valida resolución del caso y bloquea nuevos trámites ordinarios. | Expediente concluido, Asiento de cierre. | `CERRADO` | Jefe de Área Resolutora |
| **Reabrir Expediente** | Solicitud justificada, recurso legal. | Requiere validación de estado `CERRADO` y permiso de jefatura. | Expediente reactivado, Asiento de reapertura. | `REABIERTO` | Jefe de Área / Administrador |
| **Anular Registro** | Código de expediente, justificación formal. | Anulación lógica (`anulado = true` + `motivo_anulacion`), mantiene auditoría en el libro. | Expediente invalidado, evento de anulación para trazabilidad. | `ANULADO` | Administrador del Sistema |
| **Entregar a Trazabilidad** | Eventos originados por cualquier operación. | Despacha la carga estructurada al bus de seguimiento del Grupo 1. | Confirmación de recepción en el módulo de seguimiento. | *(Según evento)* | Sistema SIGD (Core) |

---

## 9. Registro de Decisiones Tomadas y Propuestas

| Código | Decisión Adoptada | Categoría | Justificación Técnica o Normativa |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Separación conceptual de Trámite, Expediente, Documento y Asiento. | `[PROPUESTO]` | Previene la sobrecarga de datos en una sola entidad y asegura escalabilidad bajo el Modelo de Gestión Documental (MGD). |
| **DEC-02** | Propuesta de asientos con correlativo global secuencial. | `[PROPUESTO]` | El Libro de Registro certifica el flujo general de toda la entidad y no debe reiniciarse por cada expediente individual. |
| **DEC-03** | Generación de correlativos mediante secuencias nativas de PostgreSQL (`SEQUENCE`). | `[PROPUESTO]` | Elimina problemas de colisión por concurrencia provocados por consultas manuales del tipo `MAX + 1`. |
| **DEC-04** | Preservación de registros anulados mediante anulación lógica (`anulado = true` + motivo). | `[PROPUESTO]` | Garantiza auditoría e inmutabilidad legal exigida por la normativa administrativa pública. |
| **DEC-05** | No duplicación de entidades de personas ni unidades orgánicas. | `[CONFIRMADO]` | Arquitectura modular: consumo de identificadores de los Grupos 4 (usuarios) y 3 (áreas). |
| **DEC-06** | Estructura visible de expediente `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`. | `[PROPUESTO]` | Formato de trabajo representativo sujeto a la directiva que determine la institución. |
| **DEC-07** | Periodicidad del reinicio de correlativo del Libro de Registros. | `[PENDIENTE]` | Debe validarse con el profesor si el correlativo se reinicia el 1 de enero o si es histórico continuo. |
| **DEC-08** | Implementación obligatoria de firma digital criptográfica (X.509). | `[PENDIENTE]` | Pendiente definir si el sistema exigirá certificado digital o validará mediante firma escaneada y hash de verificación. |
| **DEC-09** | Representación del solicitante externo sin credenciales mediante registro asistido en el Grupo 4. | `[PROPUESTO]` | Garantiza que todo administrado pueda tramitar sin crear cuenta, conservando la integridad referencial de `fk_remitente`. |

---

## 10. Investigación de Buenas Prácticas de Gestión Documental

* **Ley Nº 27444 – Texto Único Ordenado de la Ley del Procedimiento Administrativo General (LPAG):**
  * *Explicación con palabras propias:* Esta norma rige el funcionamiento administrativo del Estado. Establece los principios de **celeridad, legalidad y debido procedimiento**, exigiendo que toda recepción documental sea registrada en estricto orden de llegada y que se entregue un cargo con fecha y hora cierta al administrado. Dispone que si una solicitud carece de requisitos formales, la institución no puede rechazarla de plano; debe conceder un plazo (habitualmente 48 horas / 2 días hábiles) para que el administrado subsane la omisión antes de declarar el abandono.
* **Modelo de Gestión Documental (MGD) – Presidencia del Consejo de Ministros (PCM / SGTD):**
  * *Explicación con palabras propias:* Es el marco normativo peruano que define la digitalización documental pública. Exige dividir el ciclo documental en **recepción, emisión, despacho, seguimiento y archivo**, manteniendo expedientes electrónicos íntegros, foliados digitalmente e inalterables. Señala que los asientos registrales no pueden modificarse una vez generados, debiendo implementarse pistas de auditoría que garanticen autenticidad e integridad.
* **Directivas Institucionales de Trámite Documentario:**
  * *Explicación con palabras propias:* Son las normas internas de cada institución que regulan la apertura anual de los Libros de Registros. Fijan las atribuciones para autorizar cierres o reasignaciones de expedientes y dictaminan que toda corrección por error material deba asentarse mediante notas marginales o nuevos asientos rectificatorios, quedando prohibido eliminar físicamente registros del sistema.

---

## 11. Preguntas Oficiales para Definición Institucional (§10 del Plan)

1. ¿Qué diferencia oficial existe entre trámite, expediente, documento presentado y asiento del libro de registro? `[PENDIENTE]`
2. ¿Un trámite crea siempre un expediente y un único número de registro, o pueden existir otras cardinalidades? `[PENDIENTE]`
3. ¿El código de trámite y el código de expediente son el mismo dato? ¿Qué formato y longitud deben tener? `[PENDIENTE]`
4. ¿El número de registro se reinicia por año, libro, sede o área, y quién está autorizado para generarlo? `[PENDIENTE]`
5. ¿El destinatario inicial será un usuario, un área, una oficina o una combinación de ellos? `[PENDIENTE]`
6. ¿Qué estados oficiales existen y qué operaciones se permiten después del cierre, anulación o archivamiento? `[PENDIENTE]`
7. ¿Cómo se corrige un asiento equivocado sin perder el historial ni reutilizar su número? `[PENDIENTE]`
8. ¿Qué información pasa a trazabilidad y qué debe ocurrir si faltan documentos o requisitos del trámite? `[PENDIENTE]`
9. ¿El solicitante externo debe registrarse previamente como usuario, o basta con capturar sus datos al momento de la recepción en Mesa de Partes? `[PENDIENTE]`