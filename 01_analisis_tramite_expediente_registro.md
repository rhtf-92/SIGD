# Análisis Funcional: Trámite, Expediente y Libro de Registro (SIGD)
**Grupo 2:** TramiCore  
**Autor:** Leysglin Riquelmer Fachin Rojas (Rama: `B_RIQUELMER`)  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Versión:** 2.0 (Fase 1 - Revisión y cumplimiento de criterios de aceptación)

---

## 1. Objetivo del Módulo
Definir y estandarizar funcionalmente el núcleo documental del SIGD, estableciendo con precisión las diferencias conceptuales entre trámite, expediente, documento y asiento de registro, identificando los actores participantes, describiendo sus flujos operativos paso a paso y proponiendo identificadores y reglas de negocio preparados para integrarse con los módulos de seguimiento, áreas y catálogo documental.

---

## 2. Diferenciación Conceptual con Ejemplos Propios

* **Trámite `[PROPUESTO]`:** Es la intención, gestión o solicitud administrativa formal que un administrado o trabajador inicia con una finalidad determinada.  
  * *`[EJEMPLO]`*: Un estudiante solicita la emisión de un "Certificado Oficial de Estudios" o un docente solicita "Licencia con goce de haber".
* **Expediente `[PROPUESTO]`:** Es el contenedor lógico, acumulativo y cronológico que reúne todas las actuaciones, escritos, informes y resoluciones vinculadas a un mismo trámite. Permanece vivo mientras dure la gestión.  
  * *`[EJEMPLO]`*: La carpeta virtual identificada con código `EXP-2026-000104` que contiene la solicitud original, el comprobante de pago, el informe de notas emitido por secretaría y la resolución final de entrega.
* **Documento Presentado `[PROPUESTO]`:** Es la unidad física o digital de sustento (escrito, oficio, solicitud en PDF, boleta, foto) que se adjunta y folia dentro del expediente.  
  * *`[EJEMPLO]`*: El archivo digital `FUT_Solicitud_Firmada.pdf` de 2 folios o el recibo de caja escaneado `Pago_Banco_0451.pdf`.
* **Asiento del Libro de Registro `[PROPUESTO]`:** Es la constancia oficial, fechada, numerada de manera lineal e inmutable en el Libro General de Registros que acredita formalmente un evento ocurrido (ingreso inicial, derivación, respuesta o cierre).  
  * *`[EJEMPLO]`*: Asiento Nº `00004521`, registrado el `28/08/2026 09:15:02`, que certifica que el expediente `EXP-2026-000104` ingresó por Mesa de Partes Virtual y fue derivado a Secretaría Académica.

---

## 3. Actores del Sistema y Roles Definidos

* **Administrado / Solicitante (Externo o Interno) `[PROPUESTO]`:**
  * *Rol:* Inicia el trámite a través de Mesa de Partes (presencial o virtual), provee datos de contacto, adjunta requisitos obligatorios y realiza el seguimiento de su solicitud.
* **Operador de Mesa de Partes `[PROPUESTO]`:**
  * *Rol:* Valida formalmente los requisitos documentales presentados, genera el registro de ingreso, abre el expediente, asienta el primer número del Libro de Registro y entrega el cargo de recepción.
* **Especialista / Funcionario de Área Resolutora `[PROPUESTO]`:**
  * *Rol:* Recepciona el expediente derivado a su unidad, evalúa el fondo del requerimiento, redacta documentos internos (memorándums, informes técnicos), adjunta respuestas y solicita derivaciones o subsanaciones.
* **Jefe de Área / Autoridad Resolutiva `[PROPUESTO]`:**
  * *Rol:* Emite el acto administrativo o documento resolutivo final que atiende la solicitud, autoriza reasignaciones y dispone el cierre o la reapertura formal de un expediente.
* **Administrador del Sistema SIGD `[PROPUESTO]`:**
  * *Rol:* Administra las tablas maestras, supervisa la integridad de las secuencias del Libro de Registro, audita los accesos y autoriza anulaciones lógicas excepcionales con justificación administrativa.

---

## 4. Datos de Entrada, Remitente y Destinatario

### 4.1 Datos del Remitente `[CONFIRMADO]`
* **Tipo de Persona:** Natural o Jurídica `[PROPUESTO]`.
* **Tipo y Número de Identificación:** DNI, CE o RUC `[PROPUESTO]`.
* **Nombres y Apellidos / Razón Social:** Denominación legal verificable `[PROPUESTO]`.
* **Datos de Notificación:** Correo electrónico, teléfono celular y domicilio real/fiscal `[PROPUESTO]`.
* *Regla de integración:* No se duplican datos personales; se referencia al identificador único provisto por el módulo de usuarios (Grupo 4) `[CONFIRMADO]`.

### 4.2 Datos del Destinatario `[CONFIRMADO]`
* **Unidad Orgánica / Dependencia:** Área inicial a la que compete atender el trámite (ej. Dirección General, Secretaría Académica, Administración) `[PROPUESTO]`.
* **Funcionario Responsable (Opcional en Mesa de Partes):** Cargo o usuario específico asignado dentro del área destinataria `[PENDIENTE]`.
* *Regla de integración:* Referencia al catálogo organizacional gestionado por el Grupo 3 `[CONFIRMADO]`.

### 4.3 Datos del Cuerpo del Registro / Documento `[CONFIRMADO]`
* **Tipo de Documento de Origen:** Solicitud (FUT), Oficio, Carta, Memorándum, Informe `[PROPUESTO]`.
* **Número/Identificador de Origen:** Ej. `OFICIO-045-2026-GRA` `[EJEMPLO]`.
* **Folios Declarados:** Cantidad física de hojas o páginas `[PROPUESTO]`.
* **Asunto / Sumilla:** Descripción puntual de lo solicitado (máximo 500 caracteres) `[PROPUESTO]`.
* **Canal de Ingreso:** `MESA_VIRTUAL` o `MESA_PRESENCIAL` `[PROPUESTO]`.
* **Archivos Adjuntos:** Documentos escaneados en formato PDF `[PROPUESTO]`.

---

## 5. Flujos Operativos Detallados Paso a Paso

### 5.1 Flujo Normal: Desde la Presentación hasta el Registro Inicial
1. **Paso 1: Presentación:** El Administrado completa el formulario virtual o presenta en ventanilla física su solicitud con sus requisitos adjuntos.
   * *Entrada:* Datos del remitente, asunto, tipo de documento y archivos adjuntos.
   * *Responsable:* Administrado / Operador de Mesa de Partes.
2. **Paso 2: Validación Formal de Requisitos:** Mesa de Partes valida que la documentación esté completa según la directiva o TUPA institucional.
   * *Validación:* Verificar que el remitente esté identificado, el asunto sea claro y existan documentos adjuntos en PDF legibles.
   * *Responsable:* Operador de Mesa de Partes.
3. **Paso 3: Apertura del Expediente:** El sistema genera el contenedor del trámite con su código identificador visible único en estado `REGISTRADO`.
   * *Procesamiento:* Creación de la tupla del expediente con marcas temporales de servidor.
   * *Resultado:* Código de expediente generado (ej. `EXP-2026-000001`).
   * *Responsable:* Sistema SIGD.
4. **Paso 4: Asentado en el Libro de Registro:** El sistema emite automáticamente el siguiente número consecutivo global del Libro de Registro.
   * *Procesamiento:* Registro atómico inmutable que asocia remitente, destinatario, fecha, hora, tipo de trámite y expediente originado.
   * *Resultado:* Asiento del Libro emitido (ej. Asiento General Nº `00001205`).
   * *Responsable:* Sistema SIGD.
5. **Paso 5: Emisión de Cargo de Recepción:** Se emite el comprobante de registro con código, fecha y sello de tiempo para el administrado.
   * *Resultado:* Comprobante imprimible/descargable con código de seguimiento.
   * *Responsable:* Mesa de Partes.
6. **Paso 6: Derivación Inicial:** El expediente pasa a estado `EN_TRAMITE` y se envía a la bandeja del Área Destinataria.
   * *Responsable:* Operador de Mesa de Partes.

### 5.2 Flujos Excepcionales Paso a Paso

* **Excepción 1: Requisitos Incompletos o Defectuosos `[PROPUESTO]`**
  * *Condición:* Faltan requisitos obligatorios o el archivo PDF es ilegible.
  * *Paso 1:* Mesa de partes declara el trámite en estado `OBSERVADO`.
  * *Paso 2:* Se asienta en el historial la observación detallada y se notifica al remitente.
  * *Paso 3:* Se otorga un plazo perentorio de subsanación (ej. 48 horas / 2 días hábiles según Ley 27444).
  * *Paso 4:* Si subsana dentro del plazo, el expediente pasa a `REGISTRADO`. Si no subsana, pasa a `ARCHIVADO` por abandono.

* **Excepción 2: Devolución por Incompetencia del Área Destino `[PROPUESTO]`**
  * *Condición:* El área receptora recibe un expediente que corresponde a otra oficina funcional.
  * *Paso 1:* El funcionario receptor registra la devolución indicando motivo y base reglamentaria.
  * *Paso 2:* El expediente retorna a Mesa de Partes y se asienta el evento en el historial sin alterar los asientos anteriores.
  * *Paso 3:* Mesa de Partes reasigna el expediente a la unidad orgánica correcta.

* **Excepción 3: Intento de Numeración Repetida / Concurrencia Simultánea `[PROPUESTO]`**
  * *Condición:* Dos operadores intentan asentar un registro en el mismo milisegundo.
  * *Acción del sistema:* Se prohíbe el uso de `MAX() + 1`. El sistema utiliza una secuencia transaccional atómica de PostgreSQL (`SERIAL` / `SEQUENCE` o bloqueo a nivel de fila) para asegurar que cada asiento reciba un correlativo único, lineal e ininterrumpido.

* **Excepción 4: Detección de Trámite Duplicado `[PROPUESTO]`**
  * *Condición:* Ingreso de una solicitud con el mismo número de documento de origen, mismo remitente y mismo asunto dentro del mismo ejercicio fiscal.
  * *Acción del sistema:* El sistema emite una advertencia de posible duplicidad al operador antes de confirmar el registro, exigiendo justificación para continuar o cancelando el registro.

* **Excepción 5: Expediente sin Documentos Adjuntos `[PROPUESTO]`**
  * *Condición:* Falla de carga de archivos en red o formulario enviado sin adjuntos (`count == 0`).
  * *Acción del sistema:* Restricción a nivel de base de datos (`CHECK` o trigger) que cancela la transacción (`ROLLBACK`). No se permite la apertura de expedientes vacíos sin al menos un documento probatorio inicial.

* **Excepción 6: Anulación de Registro `[PROPUESTO]`**
  * *Condición:* Error material grave comprobado, registro por duplicidad involuntaria o vicio formal.
  * *Acción del sistema:* El asiento original **nunca se elimina físicamente** de la base de datos (inmutabilidad). El expediente pasa al estado `ANULADO`, el asiento se marca como inactivo (`is_active = false`) y se asienta un nuevo evento de anulación con fecha, usuario y resolución autoritativa.

* **Excepción 7: Desistimiento Voluntario `[PROPUESTO]`**
  * *Condición:* El administrado presenta un escrito formal desistiendo de su solicitud antes del acto resolutivo final.
  * *Acción del sistema:* Se incorpora el escrito de desistimiento como nuevo documento del expediente y este pasa al estado `CERRADO` por desistimiento.

* **Excepción 8: Reapertura Excepcional `[PROPUESTO]`**
  * *Condición:* Presentación de recurso administrativo (reconsideración, apelación) o nulidad de oficio sobre un expediente en estado `CERRADO`.
  * *Acción del sistema:* Requiere autorización de la jefatura o administrador. El expediente cambia a estado `REABIERTO`, conservando intacto todo su historial previo.

---

## 6. Matriz Funcional Propuesta

| Operación / Función | Entradas | Procesamiento y Validaciones | Salidas | Estado Resultante | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar Trámite** | Remitente, asunto, destino, folios, PDF. | Valida requisitos, asigna código único y crea asiento global. | Expediente creado, Asiento generado, Cargo. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | Código de expediente o DNI/RUC. | Verifica permisos; retorna vistas de metadatos y cronología. | Ficha del expediente, lista de documentos e historial. | *(Sin cambio)* | Público / Funcionarios |
| **Corregir / Subsanar** | Doc. de subsanación o corrección. | Valida que esté en estado `OBSERVADO` o error material justificado. | Asiento de subsanación, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | Cód. expediente, área destino, proveído. | Verifica tenencia actual y disponibilidad del área receptora. | Notificación al área, Asiento de pase. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento final de atención/resolución. | Valida conclusión del requerimiento y bloqueo de nuevos pases. | Notificación de cierre al administrado, Asiento. | `CERRADO` | Jefe de Área Resolutora |
| **Reabrir Expediente** | Motivo legal, recurso de impugnación. | Valida estado `CERRADO` y autorización de jefatura. | Asiento de reapertura con registro de auditoría. | `REABIERTO` | Jefe de Área / Administrador |
| **Anular Registro** | Cód. expediente, justificación formal. | Borrado lógico (`is_active=false`), preserva histórico. | Asiento de anulación, expediente invalidado. | `ANULADO` | Administrador del Sistema |
| **Entregar a Trazabilidad** | Evento generado por cualquier operación. | Envía identificadores y sello de tiempo al bus del Grupo 1. | Confirmación de recepción en el módulo de seguimiento. | *(Según evento)* | Módulo Core / Sistema |

---

## 7. Registro de Decisiones Tomadas y Propuestas

| Código | Decisión | Categoría | Justificación Técnica o Normativa |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Separación de Trámite, Expediente, Documento y Asiento. | `[PROPUESTO]` | Evita la sobrecarga de datos en una sola tabla y permite escalabilidad según buenas prácticas del MGD. |
| **DEC-02** | Asientos con correlativo global ininterrumpido. | `[PROPUESTO]` | El Libro de Registros debe ser una auditoría general del sistema y no reiniciarse por expediente particular. |
| **DEC-03** | Generación de números mediante secuencias de base de datos (`SEQUENCE`). | `[PROPUESTO]` | Previene colisiones de concurrencia y bloqueos generados por consultas del tipo `MAX() + 1`. |
| **DEC-04** | Preservación de registros mediante borrado lógico (`soft-delete`). | `[PROPUESTO]` | Exigencia legal y de auditoría: los expedientes anulados deben ser auditables y no eliminarse del disco. |
| **DEC-05** | No duplicación de datos de personas ni dependencias. | `[CONFIRMADO]` | Integración modular: el Grupo 2 consume identificadores de los Grupos 4 (usuarios) y 3 (áreas). |
| **DEC-06** | Formato de código visible `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`. | `[EJEMPLO]` | Formato de trabajo provisional sujeto a la estructura que defina la institución. |
| **DEC-07** | Periodicidad del reinicio de correlativo del Libro de Registros. | `[PENDIENTE]` | Debe validarse con el profesor si el libro se cierra cada 31 de diciembre o es continuo histórico. |
| **DEC-08** | Adopción obligatoria de firma digital criptográfica (X.509). | `[PENDIENTE]` | Por definir si se requerirá certificado digital o bastará con firma escaneada / hash del PDF. |

---

## 8. Investigación de Buenas Prácticas de Gestión Documental

* **Ley Nº 27444 – Texto Único Ordenado de la Ley del Procedimiento Administrativo General (LPAG):**  
  * *Explicación con palabras propias:* Esta norma establece los principios de **celeridad, eficacia e inmutabilidad** de los actos públicos. Dispone que toda entidad debe registrar el ingreso de documentos en el orden riguroso de su recepción, otorgar un cargo con fecha y hora exacta al administrado, y prohíbe exigir documentos que la propia institución ya posea. En cuanto a las subsanaciones, establece que si una solicitud no cumple con los requisitos formales, no se debe rechazar de inmediato, sino otorgar un plazo (habitualmente 48 horas o 2 días hábiles) para que el solicitante corrija la omisión antes de declarar el abandono.
* **Modelo de Gestión Documental (MGD) – Presidencia del Consejo de Ministros (PCM / SGTD):**  
  * *Explicación con palabras propias:* El MGD es el estándar técnico peruano para la transformación digital de archivos. Exige que el ciclo de vida documental se divida con claridad entre la **recepción (Mesa de Partes)**, la **trazabilidad (expedientes con foliación digital)** y el **despacho/archivo**. Establece que cada expediente debe funcionar como una unidad indivisible con trazabilidad permanente, donde ningún documento pueda ser retirado o alterado una vez registrado, garantizando la autenticidad y el no repudio institucional.
* **Directivas Institucionales de Trámite Documentario:**  
  * *Explicación con palabras propias:* Las directivas internas regulan la apertura de libros de registro únicos por cada año calendario, fijan los roles y responsabilidades de quienes pueden despachar o archivar, y determinan que las correcciones ante errores materiales se realicen mediante nuevos asientos o notas de rectificación (asientos de alcance), prohibiendo estrictamente el borrado o alteración de registros existentes.

---

## 9. Preguntas Oficiales para Definición Institucional (§10 del Plan)

1. ¿Qué diferencia oficial existe entre trámite, expediente, documento presentado y asiento del libro de registro? `[PENDIENTE]`
2. ¿Un trámite crea siempre un expediente y un único número de registro, o pueden existir otras cardinalidades? `[PENDIENTE]`
3. ¿El código de trámite y el código de expediente son el mismo dato? ¿Qué formato y longitud deben tener? `[PENDIENTE]`
4. ¿El número de registro se reinicia por año, libro, sede o área, y quién está autorizado para generarlo? `[PENDIENTE]`
5. ¿El destinatario inicial será un usuario, un área, una oficina o una combinación de ellos? `[PENDIENTE]`
6. ¿Qué estados oficiales existen y qué operaciones se permiten después del cierre, anulación o archivamiento? `[PENDIENTE]`
7. ¿Cómo se corrige un asiento equivocado sin perder el historial ni reutilizar su número? `[PENDIENTE]`
8. ¿Qué información pasa a trazabilidad y qué debe ocurrir si faltan documentos o requisitos del trámite? `[PENDIENTE]`

---

## 10. Evidencia Individual de Autoría y Explicación Técnica (§9 del Plan)
* **Rama de trabajo:** `B_RIQUELMER`
* **Archivo elaborado:** `01_analisis_tramite_expediente_registro.md`
* **Explicación breve del trabajo realizado:** Se elaboró el análisis funcional completo de la Fase 1 estructurando los conceptos clave, definiendo los actores con sus responsabilidades, detallando los flujos normales y excepcionales paso a paso con sus validaciones, creando la matriz funcional de operaciones y fundamentando las decisiones mediante las categorías del plan y las fuentes normativas de gestión documental.
* **Verificación:** Se verificó la consistencia de las reglas mediante Git, asegurando que los identificadores técnicos no dependan de `MAX + 1` y que el flujo esté listo para el modelado de datos de Ramírez y la implementación SQL de Sandy.