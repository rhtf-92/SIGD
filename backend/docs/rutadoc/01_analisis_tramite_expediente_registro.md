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

* **Trámite `[PROPUESTO]`:** Gestión, petición o requerimiento administrativo formal que promueve un administrado o trabajador con un propósito específico[cite: 1].  
  * *`[EJEMPLO]`*: Un estudiante solicita la emisión de su "Certificado Oficial de Estudios" o un docente solicita "Licencia con goce de haber".
* **Expediente `[PROPUESTO]`:** Unidad documental lógica, acumulativa y cronológica que agrupa todos los escritos, proveídos, informes técnicos y resoluciones vinculadas a un mismo trámite[cite: 1].  
  * *`[EJEMPLO]`*: La carpeta digital identificada provisionalmente con el código `EXP-2026-000104`, que reúne el FUT, el comprobante de pago, el informe de notas y la resolución de entrega.
* **Documento Presentado `[PROPUESTO]`:** Unidad física o digital de sustento (solicitud, oficio, informe en PDF, comprobante) que acredita o fundamenta una actuación dentro del expediente[cite: 1].  
  * *`[EJEMPLO]`*: El archivo digitalizado `FUT_solicitud_firmada.pdf` de 2 folios o el comprobante de caja `recibo_pago_0891.pdf`.
* **Asiento del Libro de Registro `[PROPUESTO]`:** Constancia oficial, fechada, numerada de forma secuencial e inmutable en el Libro General de Registros que acredita formalmente un evento ocurrido[cite: 1].  
  * *`[EJEMPLO]`*: Asiento Nº `00004521`, asentado el `28/08/2026 09:15:02`, que certifica que el expediente `EXP-2026-000104` ingresó por Mesa de Partes Virtual y se derivó a Secretaría Académica.

---

## 3. Identificadores Técnicos Internos vs. Códigos Visibles

* **Identificadores Técnicos Internos `[PROPUESTO]`:**
  * Claves primarias (`id` autoincremental / `BIGSERIAL` o `UUID`) gestionadas internamente por el motor PostgreSQL[cite: 1].
  * Nunca se exponen al usuario final ni se emplean como código de trámite en ventanilla[cite: 1].
  * Aseguran la integridad referencial y las relaciones entre tablas de la base de datos[cite: 1].
* **Códigos Visibles y de Negocio `[PROPUESTO]`:**
  * Estructuras de texto legibles para el administrado y los operadores[cite: 1].
  * Sujetos a modificación según directiva institucional sin alterar las claves primarias técnicas de la base de datos[cite: 1].
  * Se prohíbe el uso de `MAX() + 1` para su generación; se gestionan mediante secuencias transaccionales seguras de PostgreSQL (`SEQUENCE`)[cite: 1].

---

## 4. Actores del Sistema y Roles Definidos

* **Administrado / Solicitante (Externo o Interno) `[PROPUESTO]`:**
  * *Responsabilidad:* Registra la solicitud por Mesa de Partes (presencial o virtual), aporta datos de contacto, adjunta requisitos y realiza el seguimiento del trámite[cite: 1].
* **Operador de Mesa de Partes `[PROPUESTO]`:**
  * *Responsabilidad:* Valida formalmente los requisitos y folios, apertura el expediente, asienta el ingreso en el Libro de Registro y emite el cargo oficial[cite: 1].
* **Especialista / Funcionario de Área Resolutora `[PROPUESTO]`:**
  * *Responsabilidad:* Revisa el fondo del requerimiento, emite informes u oficios de respuesta, solicita subsanaciones o deriva el expediente a otra oficina[cite: 1].
* **Jefe de Área / Autoridad Institucional `[PROPUESTO]`:**
  * *Responsabilidad:* Suscribe el acto resolutivo final, autoriza reasignaciones y dispone el cierre o reapertura formal del expediente[cite: 1].
* **Administrador del Sistema SIGD `[PROPUESTO]`:**
  * *Responsabilidad:* Configura periodos de numeración, audita la inmutabilidad de los asientos y ejecuta anulaciones lógicas bajo justificación administrativa[cite: 1].

---

## 5. Datos de Entrada, Remitente y Destinatario

### 5.1 Datos del Remitente `[CONFIRMADO]`
* **Tipo de Persona:** Natural o Jurídica `[PROPUESTO]`.
* **Tipo y Número de Identificación:** DNI, Carné de Extranjería o RUC `[PROPUESTO]`.
* **Nombres y Apellidos / Razón Social:** Nombre legal acreditable `[PROPUESTO]`.
* **Datos de Contacto:** Correo electrónico, teléfono celular y domicilio fiscal o real `[PROPUESTO]`.
* *Regla de integración:* Se vincula mediante clave foránea al módulo de usuarios (Grupo 4) sin duplicar datos personales en las tablas de trámite[cite: 1].

### 5.2 Datos del Destinatario `[CONFIRMADO]`
* **Unidad Orgánica / Dependencia:** Área de destino competente (ej. Dirección General, Secretaría Académica, Logística) `[PROPUESTO]`.
* **Funcionario Destino:** Usuario asignado dentro del área destinataria `[PENDIENTE]`.
* *Regla de integración:* Se vincula mediante referencia al catálogo organizacional del Grupo 3[cite: 1].

### 5.3 Datos del Cuerpo del Registro `[CONFIRMADO]`
* **Tipo de Documento de Origen:** Solicitud (FUT), Oficio, Memorándum, Carta `[PROPUESTO]`.
* **Número de Documento de Origen:** Código visible del documento presentado (ej. `OF-015-2026-MINEDU`) `[EJEMPLO]`.
* **Asunto / Sumilla:** Resumen del requerimiento solicitado (máximo 500 caracteres) `[PROPUESTO]`.
* **Folios Declarados:** Cantidad física de hojas sustentatorias `[PROPUESTO]`.
* **Canal de Ingreso:** `MESA_PRESENCIAL` o `MESA_VIRTUAL` `[PROPUESTO]`.
* **Documentos Digitalizados:** Archivos adjuntos en formato PDF/A `[PROPUESTO]`.

---

## 6. Reglas de Códigos, Formatos y Numeración

> **Aclaración Metodológica:** Los siguientes formatos, estructuras y reglas corresponden a propuestas técnicas de trabajo y ejemplos demostrativos; no representan una especificación institucional oficial[cite: 1].

### 6.1 Código de Expediente / Trámite
* **Formato Propuesto `[PROPUESTO]`:** `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `EXP-2026-000001`
* **Criterio de Negocio `[PROPUESTO]`:** Unicidad por año fiscal; el correlativo se reinicia cada 1 de enero si la directiva institucional así lo estipula `[PENDIENTE]`.

### 6.2 Código de Documento de Origen
* **Formato Propuesto `[PROPUESTO]`:** `[TIPO_DOC]-[CORRELATIVO 4 DÍGITOS]-[AÑO]-[SIGLA_AREA]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `OFIC-0012-2026-DSI`
* **Criterio de Negocio `[PROPUESTO]`:** Identifica la procedencia y tipología del escrito dentro del expediente `[PROPUESTO]`.

### 6.3 Numeración de Asientos en el Libro General de Registros
* **Propuesta de Correlativo Global `[PROPUESTO]`:** La numeración de asientos **NO** es individual por expediente, sino una secuencia única, ininterrumpida y global de todo el sistema documental para garantizar auditoría institucional[cite: 1].
* **Ejemplos Demostrativos de Secuencia `[EJEMPLO]`:** `00000001`, `00000002`, `00000003`, etc.
* **Criterio Técnico de Generación `[PROPUESTO]`:** Se prohíbe el uso de `SELECT MAX(...) + 1` por fallas ante peticiones simultáneas; se generará mediante secuencias transaccionales nativas de PostgreSQL (`SEQUENCE`)[cite: 1].

### 6.4 Tratamiento de Anulaciones y Preservación de Historial
* **Mecanismo de Borrado Lógico `[PROPUESTO]`:** Ante anulaciones autorizadas, los registros nunca se eliminan físicamente de la base de datos (`NO DELETE`)[cite: 1]. Se aplica la bandera de estado `is_active = false` sobre el registro `[PROPUESTO]`.
* **Registro de Auditoría `[PROPUESTO]`:** El asiento original permanece inmutable en el Libro de Registros y se emite un nuevo asiento con el motivo, fecha y resolución de la anulación para auditoría pública[cite: 1].

---

## 7. Flujos Operativos Detallados Paso a Paso

### 7.1 Flujo Normal: Presentación y Registro Inicial
1. **Presentación de Documentación:**
   * *Entrada:* Datos del remitente, asunto, dependencia destino, folios y archivo PDF[cite: 1].
   * *Responsable:* Administrado / Operador de Mesa de Partes[cite: 1].
2. **Validación Formal de Requisitos:**
   * *Validación:* Verificación de legibilidad, identificación del solicitante y cumplimiento de requisitos TUPA[cite: 1].
   * *Responsable:* Operador de Mesa de Partes[cite: 1].
3. **Creación del Expediente:**
   * *Procesamiento:* El sistema crea el contenedor con estado `REGISTRADO` y genera su código visible propuesto (ej. `EXP-2026-000001` `[EJEMPLO]`)[cite: 1].
   * *Responsable:* Sistema SIGD[cite: 1].
4. **Asentado en el Libro General de Registros:**
   * *Procesamiento:* Generación automática del asiento de correlativo global propuesto (ej. Asiento `00001205` `[EJEMPLO]`)[cite: 1].
   * *Responsable:* Sistema SIGD[cite: 1].
5. **Emisión de Cargo:**
   * *Resultado:* Comprobante con sello de recepción y código de verificación[cite: 1].
   * *Responsable:* Mesa de Partes[cite: 1].
6. **Derivación Inicial y Trazabilidad:**
   * *Procesamiento:* El expediente cambia a estado `EN_TRAMITE`, pasa a la bandeja del área de destino y despacha el evento al módulo de trazabilidad (Grupo 1)[cite: 1].
   * *Responsable:* Mesa de Partes / Sistema[cite: 1].

### 7.2 Flujos Excepcionales Paso a Paso

* **Excepción 1: Requisitos Incompletos o Defectuosos `[PROPUESTO]`**
  * *Condición:* Documentación ilegible o ausencia de requisitos obligatorios[cite: 1].
  * *Acción:* Mesa de Partes asigna estado `OBSERVADO`, registra la observación formal y notifica al administrado otorgando un plazo legal de 48 horas (2 días hábiles) para subsanar[cite: 1]. Si vence el plazo sin subsanación, pasa a estado `ARCHIVADO` por abandono[cite: 1].
* **Excepción 2: Destino Inválido o Devolución por Incompetencia `[PROPUESTO]`**
  * *Condición:* El área receptora determina que la atención no compete a sus funciones[cite: 1].
  * *Acción:* El especialista registra la devolución motivada. El expediente retorna a Mesa de Partes mediante un nuevo asiento de retorno, sin alterar asientos previos, para su reasignación[cite: 1].
* **Excepción 3: Intento de Numeración Repetida / Concurrencia Simultánea `[PROPUESTO]`**
  * *Condición:* Dos operadores intentan registrar un documento en el mismo milisegundo[cite: 1].
  * *Acción:* Se descarta `MAX() + 1`[cite: 1]. Se implementan secuencias atómicas de PostgreSQL (`SEQUENCE`) para asegurar correlatividad lineal sin saltos ni duplicados[cite: 1].
* **Excepción 4: Detección de Trámite Duplicado `[PROPUESTO]`**
  * *Condición:* Ingreso de una solicitud con idéntico remitente, tipo de documento y número dentro del mismo año fiscal[cite: 1].
  * *Acción:* El sistema emite advertencia bloqueante en pantalla[cite: 1]. El operador valida si es reiteración o si debe anexarse al expediente preexistente[cite: 1].
* **Excepción 5: Expediente sin Documentos Adjuntos Requeridos `[PROPUESTO]`**
  * *Condición:* Formulario enviado sin PDF de sustento adjunto[cite: 1].
  * *Acción:* Validación que aborta la operación (`ROLLBACK`). No se autoriza la creación de expedientes vacíos[cite: 1].
* **Excepción 6: Registro Anulado `[PROPUESTO]`**
  * *Condición:* Error material comprobado o registro fraudulento[cite: 1].
  * *Acción:* Se aplica borrado lógico (`is_active = false` `[PROPUESTO]`)[cite: 1]. El asiento original permanece inmutable en el Libro de Registros, el expediente pasa al estado `ANULADO` y se asienta el evento de anulación con la resolución autorizada[cite: 1].
* **Excepción 7: Desistimiento Voluntario `[PROPUESTO]`**
  * *Condición:* El solicitante desiste formalmente antes de la resolución final[cite: 1].
  * *Acción:* Se anexa el documento de desistimiento y el expediente cambia al estado `CERRADO`[cite: 1].
* **Excepción 8: Reapertura Excepcional `[PROPUESTO]`**
  * *Condición:* Presentación de recurso impugnatorio fundado contra un trámite cerrado[cite: 1].
  * *Acción:* Con autorización de la autoridad institucional, el expediente cambia a estado `REABIERTO`, preservando su historial íntegro[cite: 1].

---

## 8. Matriz Funcional Propuesta

| Operación / Función `[PROPUESTO]` | Entradas (Inputs)[cite: 1] | Procesamiento y Reglas de Negocio[cite: 1] | Salidas (Outputs)[cite: 1] | Estado Resultante[cite: 1] | Responsable[cite: 1] |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar Trámite** | Remitente, destinatario, asunto, folios, PDF. | Valida requisitos, asigna ID técnico, genera código visible y crea asiento global. | Expediente creado, Asiento emitido, Cargo de recepción. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | Código visible o Documento de Identidad. | Filtra por permisos de usuario y expone metadatos y cronología de asientos. | Ficha del expediente, lista de documentos y trazabilidad. | *(Sin cambio)* | Público / Funcionarios |
| **Corregir / Subsanar** | Escrito de subsanación o corrección material. | Válido únicamente en estado `OBSERVADO` o error justificado. No destruye historial. | Asiento de subsanación, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | Cód. expediente, área destino, proveído. | Verifica tenencia activa; genera nuevo asiento de movimiento. | Notificación al área receptora, Asiento de derivación. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento resolutivo final, notificación. | Valida resolución del caso y bloquea nuevos trámites ordinarios. | Expediente concluido, Asiento de cierre. | `CERRADO` | Jefe de Área Resolutora |
| **Reabrir Expediente** | Solicitud justificada, recurso legal. | Requiere validación de estado `CERRADO` y permiso de jefatura. | Expediente reactivado, Asiento de reapertura. | `REABIERTO` | Jefe de Área / Administrador |
| **Anular Registro** | Código de expediente, justificación formal. | Borrado lógico (`is_active = false` `[PROPUESTO]`), mantiene auditoría en el libro. | Expediente invalidado, Asiento de anulación registrado. | `ANULADO` | Administrador del Sistema |
| **Entregar a Trazabilidad** | Eventos originados por cualquier operación. | Despacha la carga estructurada al bus de seguimiento del Grupo 1. | Confirmación de recepción en el módulo de seguimiento. | *(Según evento)* | Sistema SIGD (Core) |

---

## 9. Registro de Decisiones Tomadas y Propuestas

| Código | Decisión Adoptada | Categoría[cite: 1] | Justificación Técnica o Normativa[cite: 1] |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Separación conceptual de Trámite, Expediente, Documento y Asiento. | `[PROPUESTO]` | Previene la sobrecarga de datos en una sola entidad y asegura escalabilidad bajo el Modelo de Gestión Documental (MGD)[cite: 1]. |
| **DEC-02** | Propuesta de asientos con correlativo global ininterrumpido. | `[PROPUESTO]` | El Libro de Registro certifica el flujo general de toda la entidad y no debe reiniciarse por cada expediente individual[cite: 1]. |
| **DEC-03** | Generación de correlativos mediante secuencias nativas de PostgreSQL (`SEQUENCE`). | `[PROPUESTO]` | Elimina problemas de colisión por concurrencia provocados por consultas manuales del tipo `MAX + 1`[cite: 1]. |
| **DEC-04** | Preservación de registros anulados mediante borrado lógico (`is_active = false`). | `[PROPUESTO]` | Garantiza auditoría e inmutabilidad legal exigida por la normativa administrativa pública[cite: 1]. |
| **DEC-05** | No duplicación de entidades de personas ni unidades orgánicas. | `[CONFIRMADO]` | Arquitectura modular: consumo de identificadores de los Grupos 4 (usuarios) y 3 (áreas)[cite: 1]. |
| **DEC-06** | Estructura visible de expediente `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`. | `[PROPUESTO]` | Formato de trabajo representativo sujeto a la directiva que determine la institución[cite: 1]. |
| **DEC-07** | Periodicidad del reinicio de correlativo del Libro de Registros. | `[PENDIENTE]` | Debe validarse con el profesor si el correlativo se reinicia el 1 de enero o si es histórico continuo[cite: 1]. |
| **DEC-08** | Implementación obligatoria de firma digital criptográfica (X.509). | `[PENDIENTE]` | Pendiente definir si el sistema exigirá certificado digital o validará mediante firma escaneada y hash de verificación[cite: 1]. |

---

## 10. Investigación de Buenas Prácticas de Gestión Documental

* **Ley Nº 27444 – Texto Único Ordenado de la Ley del Procedimiento Administrativo General (LPAG):**  
  * *Explicación con palabras propias:* Esta norma rige el funcionamiento administrativo del Estado[cite: 1]. Establece los principios de **celeridad, legalidad y debido procedimiento**, exigiendo que toda recepción documental sea registrada en estricto orden de llegada y que se entregue un cargo con fecha y hora cierta al administrado[cite: 1]. Dispone que si una solicitud carece de requisitos formales, la institución no puede rechazarla de plano; debe conceder un plazo (habitualmente 48 horas / 2 días hábiles) para que el administrado subsane la omisión antes de declarar el abandono[cite: 1].
* **Modelo de Gestión Documental (MGD) – Presidencia del Consejo de Ministros (PCM / SGTD):**  
  * *Explicación con palabras propias:* Es el marco normativo peruano que define la digitalización documental pública[cite: 1]. Exige dividir el ciclo documental en **recepción, emisión, despacho, seguimiento y archivo**, manteniendo expedientes electrónicos íntegros, foliados digitalmente e inalterables[cite: 1]. Señala que los asientos registrales no pueden modificarse una vez generados, debiendo implementarse pistas de auditoría que garanticen autenticidad e integridad[cite: 1].
* **Directivas Institucionales de Trámite Documentario:**  
  * *Explicación con palabras propias:* Son las normas internas de cada institución que regulan la apertura anual de los Libros de Registros[cite: 1]. Fijan las atribuciones para autorizar cierres o reasignaciones de expedientes y dictaminan que toda corrección por error material deba asentarse mediante notas marginales o nuevos asientos rectificatorios, quedando prohibido eliminar físicamente registros del sistema[cite: 1].

---

## 11. Preguntas Oficiales para Definición Institucional (§10 del Plan)

1. ¿Qué diferencia oficial existe entre trámite, expediente, documento presentado y asiento del libro de registro? `[PENDIENTE]`[cite: 1]
2. ¿Un trámite crea siempre un expediente y un único número de registro, o pueden existir otras cardinalidades? `[PENDIENTE]`[cite: 1]
3. ¿El código de trámite y el código de expediente son el mismo dato? ¿Qué formato y longitud deben tener? `[PENDIENTE]`[cite: 1]
4. ¿El número de registro se reinicia por año, libro, sede o área, y quién está autorizado para generarlo? `[PENDIENTE]`[cite: 1]
5. ¿El destinatario inicial será un usuario, un área, una oficina o una combinación de ellos? `[PENDIENTE]`[cite: 1]
6. ¿Qué estados oficiales existen y qué operaciones se permiten después del cierre, anulación o archivamiento? `[PENDIENTE]`[cite: 1]
7. ¿Cómo se corrige un asiento equivocado sin perder el historial ni reutilizar su número? `[PENDIENTE]`[cite: 1]
8. ¿Qué información pasa a trazabilidad y qué debe ocurrir si faltan documentos o requisitos del trámite? `[PENDIENTE]`[cite: 1]