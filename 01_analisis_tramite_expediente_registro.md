# Análisis Funcional: Trámite, Expediente y Libro de Registro (SIGD)
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Grupo de Trabajo:** Grupo 2 – “TramiCore”  
**Responsable del Análisis:** Leysglin Riquelmer Fachin Rojas (Rama: `B_RIQUELMER`)  
**Sublíder / Integrador:** Elmer Ramírez (`B_RAMIREZ`)  
**Versión:** 2.0 (Fase 1 – Cumplimiento integral del Plan de Trabajo)

---

## 1. Objetivo y Alcance del Módulo

### 1.1 Objetivo
Definir el núcleo documental del SIGD, diferenciando conceptualmente trámite, expediente, documento y asiento del libro de registro. Asimismo, establecer la separación entre identificadores técnicos internos y códigos visibles, definir los actores, detallar los flujos operativos paso a paso y formular las preguntas para la validación oficial con la institución.

### 1.2 Alcance
Comprende desde la presentación de la solicitud por Mesa de Partes hasta el asentado en el Libro de Registro, la conformación del expediente, la actualización controlada, la atención por las áreas y la entrega de eventos al módulo de trazabilidad (Grupo 1). No abarca la implementación final de endpoints ni migraciones definitivas.

---

## 2. Diferenciación Conceptual con Ejemplos Propios

* **Trámite `[PROPUESTO]`:** Gestión, petición o requerimiento formal que un solicitante promueve para obtener un pronunciamiento institucional.  
  * *`[EJEMPLO]`*: Un alumno solicita la expedición de su "Certificado Oficial de Estudios" o un docente tramita una "Licencia con goce de haber".
* **Expediente `[PROPUESTO]`:** Unidad documental lógica, acumulativa y secuencial que agrupa todos los escritos, proveídos, informes técnicos y resoluciones vinculadas a un mismo trámite a lo largo de su ciclo de vida.  
  * *`[EJEMPLO]`*: La carpeta digital con código `EXP-2026-000104`, que reúne el Formulario Único de Trámite (FUT), el comprobante de pago de caja, el informe de notas emitido por Secretaría y la resolución de entrega.
* **Documento Presentado `[PROPUESTO]`:** Escrito o archivo individual (físico o digital en PDF) que sustenta, acredita o responde a una actuación dentro del expediente.  
  * *`[EJEMPLO]`*: El archivo escaneado `FUT_solicitud_firmada.pdf` de 2 folios o el archivo digitalizado `recibo_caja_0891.pdf`.
* **Asiento del Libro de Registro `[PROPUESTO]`:** Constancia oficial, cronológica, lineal e inmutable asentada en el Libro General de Registros que acredita formalmente el ingreso, egreso o pase de un documento.  
  * *`[EJEMPLO]`*: Asiento Nº `00004521`, registrado el `28/08/2026 09:15:02`, que certifica que el expediente `EXP-2026-000104` ingresó por Mesa de Partes Virtual y fue derivado a Secretaría Académica.

---

## 3. Identificadores Técnicos Internos vs. Códigos Visibles

Para evitar que los cambios institucionales rompan la base de datos, se establece la separación estricta entre identificadores de máquina y códigos de visualización:

* **Identificadores Técnicos Internos `[PROPUESTO]`:**
  * Son claves primarias (`id` autoincremental / `BIGSERIAL` o `UUID`) administradas internamente por PostgreSQL.
  * Nunca se exponen al usuario final ni se usan como referencia de búsqueda en ventanilla.
  * Garantizan la integridad referencial y las relaciones entre tablas.
* **Códigos Visibles y de Negocio `[PROPUESTO]`:**
  * **Código de Expediente / Trámite:** Formato preliminar `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]` (ej. `EXP-2026-000001`) `[EJEMPLO]`.
  * **Número de Asiento del Libro de Registro:** Correlativo global continuo del libro (ej. `REG-2026-00004521`) `[EJEMPLO]`.
  * *Condición técnica:* No se generan mediante `SELECT MAX(...) + 1` para evitar colisiones en concurrencia; se gestionan mediante secuencias atómicas de base de datos (`SEQUENCE`).

---

## 4. Actores del Sistema y Roles Definidos

* **Administrado / Solicitante (Externo o Interno) `[PROPUESTO]`:**
  * *Responsabilidad:* Presenta la solicitud por Mesa de Partes física o virtual, adjunta requisitos, registra datos de contacto y consulta el estado de su trámite.
* **Operador de Mesa de Partes `[PROPUESTO]`:**
  * *Responsabilidad:* Valida formalmente los requisitos y folios, apertura el expediente en el sistema, asienta el ingreso en el Libro de Registro y emite el cargo oficial al solicitante.
* **Especialista / Funcionario de Área Resolutora `[PROPUESTO]`:**
  * *Responsabilidad:* Revisa el fondo del requerimiento, genera documentos de respuesta (informes, oficios), solicita subsanaciones o deriva el expediente a otra oficina.
* **Jefe de Área / Autoridad Institucional `[PROPUESTO]`:**
  * *Responsabilidad:* Suscribe el acto resolutivo final, autoriza reasignaciones y dispone el cierre o la reapertura formal del expediente.
* **Administrador del Sistema SIGD `[PROPUESTO]`:**
  * *Responsabilidad:* Configura periodos de numeración, supervisa la inmutabilidad de los asientos y ejecuta anulaciones lógicas excepcionales bajo estricta auditoría.

---

## 5. Datos de Entrada, Remitente y Destinatario

### 5.1 Datos del Remitente `[CONFIRMADO]`
* **Tipo de Persona:** Natural o Jurídica `[PROPUESTO]`.
* **Tipo y Número de Identificación:** DNI, Carné de Extranjería o RUC `[PROPUESTO]`.
* **Nombres y Apellidos / Razón Social:** Nombre legal acreditado `[PROPUESTO]`.
* **Datos de Contacto:** Correo electrónico, celular y dirección fiscal o domiciliaria `[PROPUESTO]`.
* *Regla de integración:* Se vincula por clave foránea al módulo de usuarios del Grupo 4 sin duplicar datos personales en las tablas del trámite.

### 5.2 Datos del Destinatario `[CONFIRMADO]`
* **Unidad Orgánica / Dependencia:** Oficina a la que se remite el trámite (ej. Dirección General, Secretaría Académica, Logística) `[PROPUESTO]`.
* **Funcionario Destino:** Usuario asignado dentro del área receptora `[PENDIENTE]`.
* *Regla de integración:* Se vincula mediante el catálogo de áreas del Grupo 3.

### 5.3 Datos del Cuerpo del Registro `[CONFIRMADO]`
* **Tipo de Documento:** Solicitud (FUT), Oficio, Memorándum, Carta `[PROPUESTO]`.
* **Número de Documento de Origen:** Código visible del documento presentado (ej. `OF-015-2026-MINEDU`) `[EJEMPLO]`.
* **Asunto / Sumilla:** Resumen del requerimiento (máximo 500 caracteres) `[PROPUESTO]`.
* **Folios Declarados:** Número total de páginas sustentatorias `[PROPUESTO]`.
* **Canal de Ingreso:** `MESA_PRESENCIAL` o `MESA_VIRTUAL` `[PROPUESTO]`.
* **Documentos Digitalizados:** Archivos adjuntos en formato PDF/A `[PROPUESTO]`.

---

## 6. Flujos Operativos Detallados Paso a Paso

### 6.1 Flujo Normal: Presentación y Registro Inicial
1. **Presentación de Documentación:**
   * *Entrada:* Datos del remitente, asunto, dependencia destino, folios y archivo PDF.
   * *Responsable:* Administrado / Operador de Mesa de Partes.
2. **Validación Formal de Requisitos:**
   * *Validación:* Comprobación de legibilidad del documento, acreditación del remitente y cumplimiento de requisitos TUPA.
   * *Responsable:* Operador de Mesa de Partes.
3. **Creación del Expediente:**
   * *Procesamiento:* El sistema crea el contenedor con estado `REGISTRADO` y genera su código visible (ej. `EXP-2026-000001`).
   * *Responsable:* Sistema SIGD.
4. **Asentado en el Libro General de Registros:**
   * *Procesamiento:* Generación automática e inmutable del asiento correlativo global (ej. Asiento Nº `00001205`), sellando fecha, hora, remitente, destino y usuario operador.
   * *Responsable:* Sistema SIGD.
5. **Emisión de Cargo:**
   * *Resultado:* Emisión de comprobante digital o físico con sello de recepción y código de verificación.
   * *Responsable:* Mesa de Partes.
6. **Derivación Inicial y Trazabilidad:**
   * *Procesamiento:* El expediente cambia a estado `EN_TRAMITE`, se envía a la bandeja del área destino y se despacha el evento al módulo de trazabilidad (Grupo 1).
   * *Responsable:* Mesa de Partes / Sistema.

### 6.2 Flujos Excepcionales Paso a Paso

* **Excepción 1: Requisitos Incompletos o Defectuosos `[PROPUESTO]`**
  * *Condición:* Documentación ilegible o ausencia de requisitos obligatorios.
  * *Acción:* Mesa de Partes cambia el estado a `OBSERVADO`, registra la observación formal y notifica al administrado otorgando un plazo legal de 48 horas (2 días hábiles) para subsanar. Si no subsana dentro del plazo, el expediente pasa a estado `ARCHIVADO` por abandono.
* **Excepción 2: Destino Inválido o Devolución por Incompetencia `[PROPUESTO]`**
  * *Condición:* El área receptora determina que la atención no corresponde a su competencia reglamentaria.
  * *Acción:* El funcionario registra la devolución justificando la causal. El expediente retorna a Mesa de Partes mediante un nuevo asiento de retorno, sin alterar los asientos previos, y se reasigna al área competente.
* **Excepción 3: Intento de Numeración Repetida / Concurrencia Simultánea `[PROPUESTO]`**
  * *Condición:* Dos operadores intentan asentar un registro en el mismo milisegundo.
  * *Acción:* Se descarta el cálculo por `MAX() + 1`. Se implementan secuencias nativas de base de datos (`SEQUENCE` transaccional en PostgreSQL) con nivel de aislamiento de transacciones para garantizar la correlatividad lineal sin saltos ni duplicados.
* **Excepción 4: Detección de Trámite Duplicado `[PROPUESTO]`**
  * *Condición:* Ingreso de una solicitud con idéntico remitente, tipo de documento y número de documento dentro del mismo año fiscal.
  * *Acción:* El sistema emite una advertencia de duplicidad bloqueante en pantalla. El operador debe validar si se trata de una reiteración o si debe rechazar el nuevo registro para anexarlo como documento al expediente preexistente.
* **Excepción 5: Expediente sin Documentos Adjuntos Requeridos `[PROPUESTO]`**
  * *Condición:* El formulario se envía sin cargar el PDF de sustento.
  * *Acción:* Validación a nivel de base de datos y backend que aborta la operación (`ROLLBACK`). No se autoriza la apertura de expedientes vacíos sin al menos un documento probatorio vinculado.
* **Excepción 6: Registro Anulado `[PROPUESTO]`**
  * *Condición:* Error material crítico comprobado, registro fraudulento o mandato judicial.
  * *Acción:* Se aplica borrado lógico (`soft-delete`: `is_active = false`). El asiento original permanece inmutable en el Libro de Registro para fines de auditoría, el expediente pasa al estado `ANULADO` y se asienta el evento de anulación con la resolución autoritativa y el usuario responsable.
* **Excepción 7: Desistimiento Voluntario `[PROPUESTO]`**
  * *Condición:* El solicitante presenta su desistimiento expreso antes de la resolución final.
  * *Acción:* Se adjunta el desistimiento como documento del expediente y se actualiza el estado a `CERRADO` por desistimiento.
* **Excepción 8: Reapertura Excepcional `[PROPUESTO]`**
  * *Condición:* Presentación de recurso de reconsideración o apelación fundada contra un trámite cerrado.
  * *Acción:* Previa autorización de la autoridad institucional, el expediente cambia a estado `REABIERTO`, conservando todo su historial documental intacto.

---

## 7. Matriz Funcional Propuesta

| Operación / Función `[PROPUESTO]` | Entradas (Inputs) | Procesamiento y Reglas de Negocio | Salidas (Outputs) | Estado Resultante | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar Trámite** | Remitente, destinatario, asunto, folios, PDF. | Valida requisitos, asigna ID técnico, genera código visible y crea asiento global. | Expediente creado, Asiento emitido, Cargo de recepción. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | Código visible o Documento de Identidad. | Filtra por permisos de usuario y expone metadatos y cronología de asientos. | Ficha del expediente, lista de documentos e historial. | *(Sin cambio)* | Público / Funcionarios |
| **Corregir / Subsanar** | Escrito de subsanación o corrección material. | Válido únicamente en estado `OBSERVADO` o error material justificado. No destruye el historial. | Asiento de subsanación, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | Cód. expediente, área destino, proveído. | Verifica que el área sea la tenedora activa; genera nuevo asiento de movimiento. | Notificación de envío a la bandeja receptora, Asiento de derivación. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento resolutivo final, constancia de notificación. | Valida la resolución de los requerimientos y bloquea nuevos trámites ordinarios. | Expediente concluido, Asiento de cierre. | `CERRADO` | Jefe de Área Resolutora |
| **Reabrir Expediente** | Solicitud de reapertura justificada, recurso legal. | Requiere validación de estado `CERRADO` y permiso de jefatura o administrador. | Expediente reactivado, Asiento de reapertura. | `REABIERTO` | Jefe de Área / Administrador |
| **Anular Registro** | Código de expediente, motivo formal de anulación. | Borrado lógico (`is_active = false`), mantiene auditoría en el libro. | Expediente invalidado, Asiento de anulación registrado. | `ANULADO` | Administrador del Sistema |
| **Entregar a Trazabilidad** | Eventos originados por cualquier operación. | Dispara la carga de datos estructurados hacia el bus de seguimiento del Grupo 1. | Confirmación de recepción en el módulo de seguimiento. | *(Según evento)* | Sistema SIGD (Core) |

---

## 8. Registro de Decisiones Tomadas y Propuestas

| Código | Decisión Adoptada | Categoría | Justificación Técnica o Normativa |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Separación conceptual de Trámite, Expediente, Documento y Asiento. | `[PROPUESTO]` | Previene la sobrecarga de datos en una sola entidad y asegura escalabilidad bajo el Modelo de Gestión Documental (MGD). |
| **DEC-02** | Asientos con numeración correlativa global única. | `[PROPUESTO]` | El Libro de Registro certifica el flujo general de toda la entidad y no debe reiniciarse por cada expediente individual. |
| **DEC-03** | Generación de correlativos mediante secuencias nativas de PostgreSQL (`SEQUENCE`). | `[PROPUESTO]` | Elimina problemas de colisión por concurrencia provocados por consultas manuales del tipo `MAX + 1`. |
| **DEC-04** | Preservación de registros mediante borrado lógico (`soft-delete`). | `[PROPUESTO]` | Garantiza auditoría e inmutabilidad legal exigida por la normativa administrativa pública. |
| **DEC-05** | No duplicación de entidades de personas ni unidades orgánicas. | `[CONFIRMADO]` | Arquitectura modular: consumo de identificadores de los Grupos 4 (usuarios) y 3 (áreas). |
| **DEC-06** | Estructura visible preliminar `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`. | `[EJEMPLO]` | Formato de trabajo representativo sujeto a la directiva oficial que determine la institución. |
| **DEC-07** | Periodicidad del reinicio de correlativo del Libro de Registros. | `[PENDIENTE]` | Debe validarse con el profesor si el correlativo se reinicia el 1 de enero o si es histórico continuo. |
| **DEC-08** | Implementación obligatoria de firma digital criptográfica (X.509). | `[PENDIENTE]` | Pendiente definir si el sistema exigirá certificado digital o validará mediante firma escaneada y hash de verificación. |

---

## 9. Investigación de Buenas Prácticas de Gestión Documental

* **Ley Nº 27444 – Texto Único Ordenado de la Ley del Procedimiento Administrativo General (LPAG):**  
  * *Explicación con palabras propias:* Esta norma rige el funcionamiento administrativo del Estado. Establece los principios de **celeridad, legalidad y debido procedimiento**, exigiendo que toda recepción documental sea registrada en estricto orden de llegada y que se entregue un cargo con fecha y hora cierta al administrado. Además, dispone que si una solicitud carece de requisitos formales, la institución no puede rechazarla de plano; debe admitirla provisionalmente y conceder un plazo improrrogable (generalmente de 48 horas / 2 días hábiles) para que el administrado subsane la omisión antes de declarar el abandono.
* **Modelo de Gestión Documental (MGD) – Presidencia del Consejo de Ministros (PCM / SGTD):**  
  * *Explicación con palabras propias:* Es el marco normativo peruano que define la digitalización documental pública. Exige dividir el ciclo documental en **recepción, emisión, despacho, seguimiento y archivo**, manteniendo expedientes electrónicos íntegros, foliados digitalmente e inalterables. Señala que los asientos registrales no pueden modificarse una vez generados, debiendo implementarse pistas de auditoría que garanticen autenticidad e integridad.
* **Directivas Institucionales de Trámite Documentario:**  
  * *Explicación con palabras propias:* Son las normas internas de cada institución que regulan la apertura anual de los Libros de Registros. Fijan las atribuciones para autorizar cierres o reasignaciones de expedientes y dictaminan que toda corrección por error material deba asentarse mediante notas marginales o nuevos asientos rectificatorios, quedando prohibido eliminar físicamente registros del sistema.

---

## 10. Preguntas Oficiales para Definición Institucional (§10 del Plan)

1. ¿Qué diferencia oficial existe entre trámite, expediente, documento presentado y asiento del libro de registro? `[PENDIENTE]`
2. ¿Un trámite crea siempre un expediente y un único número de registro, o pueden existir otras cardinalidades? `[PENDIENTE]`
3. ¿El código de trámite y el código de expediente son el mismo dato? ¿Qué formato y longitud deben tener? `[PENDIENTE]`
4. ¿El número de registro se reinicia por año, libro, sede o área, y quién está autorizado para generarlo? `[PENDIENTE]`
5. ¿El destinatario inicial será un usuario, un área, una oficina o una combinación de ellos? `[PENDIENTE]`
6. ¿Qué estados oficiales existen y qué operaciones se permiten después del cierre, anulación o archivamiento? `[PENDIENTE]`
7. ¿Cómo se corrige un asiento equivocado sin perder el historial ni reutilizar su número? `[PENDIENTE]`
8. ¿Qué información pasa a trazabilidad y qué debe ocurrir si faltan documentos o requisitos del trámite? `[PENDIENTE]`