# Análisis Funcional: Trámite, Expediente y Registro (SIGD)

## 1. Objetivo del Módulo
Estandarizar y definir el ciclo de vida del trámite documentario, la conformación integral de expedientes, los actores involucrados y la trazabilidad inmutable mediante el libro global de asientos dentro del Sistema Integral de Gestión Documentaria (SIGD).

---

## 2. Conceptos Clave
* **Trámite:** Solicitud, requerimiento o gestión administrativa que inicia una persona o área con un fin determinado.
* **Expediente:** Carpeta digital y lógica que agrupa cronológicamente todos los documentos, antecedentes y asientos generados en el curso de un mismo trámite.
* **Documento:** Unidad de soporte física o digital (oficio, memorándum, solicitud, anexo PDF) vinculada a un expediente.
* **Asiento:** Registro oficial, cronológico, secuencial e inmutable asentado en el Libro General de Registros que audita cada evento o movimiento dentro del sistema.

---

## 3. Datos de Entrada, Remitente y Destinatario

### Datos del Remitente
* **Tipo de Persona:** Natural o Jurídica.
* **Identificación:** DNI, Carné de Extranjería o RUC.
* **Nombres / Razón Social:** Nombres y apellidos completos o denominación social.
* **Datos de Contacto:** Correo electrónico principal, número de teléfono/celular y dirección fiscal/domicilio.

### Datos del Destinatario
* **Unidad Orgánica / Dependencia:** Oficina o gerencia a la que va dirigido el expediente.
* **Funcionario / Responsable Destino:** Cargo o persona asignada para la recepción y resolución.

### Datos de Entrada del Registro (Cuerpo del Documento)
* **Tipo de Documento:** Solicitud, Carta, Oficio, Memorándum, Informe, Proveído, etc.
* **Número/Código de Documento de Origen:** Ej. `CARTA-001-2026`.
* **Folios:** Cantidad física o de páginas reportadas.
* **Asunto / Sumilla:** Descripción concisa del trámite solicitado.
* **Archivos Adjuntos:** Archivos principales y anexos digitalizados (formato PDF).
* **Canal de Recepción:** Mesa de Partes Virtual o Presencial.
* **Fecha y Hora de Ingreso:** Sello de tiempo del servidor al momento del registro.

---

## 4. Matriz Funcional Propuesta

| Función / Módulo | Entradas (Inputs) | Procesamiento y Reglas de Negocio | Salidas (Outputs) | Actor Responsable |
| :--- | :--- | :--- | :--- | :--- |
| **Registrar Trámite** | Datos del remitente, destinatario, asunto, tipo de doc, folios, PDF. | Valida requisitos mínimos, genera código de expediente y crea el primer asiento en el libro global. | Expediente creado, Asiento global generado, comprobante de registro. | Mesa de Partes / Solicitante |
| **Consultar Expediente** | Código de expediente, DNI/RUC o rango de fechas. | Verifica permisos de acceso, consulta la vista consolidada de documentos y orden cronológico de asientos. | Detalle de expediente, estado actual e historial de asientos. | Todos los usuarios (según permisos) |
| **Corregir / Subsanar** | Observaciones previas, datos rectificados, nuevos documentos. | Permitido solo en estados "Observado" o por error material justificado. No elimina el historial previo. | Asiento de corrección registrado, estado actualizado a "Pendiente". | Solicitante / Mesa de Partes |
| **Derivar Expediente** | Código de expediente, área de destino, motivo/proveído. | Verifica que el área actual sea la poseedora activa. Cambia tenencia y añade asiento global. | Expediente transferido, Asiento de derivación generado. | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento final de resolución/atención, notificación. | Valida que todos los requerimientos estén resueltos. Bloquea la adición de nuevos documentos estándar. | Expediente en estado "Cerrado/Atendido", Asiento de cierre. | Responsable del Área Resolutora |
| **Reabrir Expediente** | Solicitud de reapertura motivada, recurso de apelación. | Solo permitido con autorización de jefatura o administrador bajo justificación administrativa. | Expediente en estado "Reabierto", Asiento de reapertura. | Jefatura / Administrador |
| **Anular Registro** | Motivo formal de anulación, usuario autorizador. | No elimina registros de la BD (borrado lógico). Invalida el expediente y marca asiento de anulación. | Expediente en estado "Anulado", Asiento de baja registrado. | Administrador del Sistema |

---

## 5. Estados y Operaciones Permitidas

### Estados del Expediente
* `REGISTRADO`: Trámite ingresado en el sistema, pendiente de asignación o revisión inicial.
* `EN_TRAMITE`: Derivado formalmente a un área resolutora para atención.
* `OBSERVADO`: Detectada falta de requisitos o defecto formal; en espera de subsanación.
* `CERRADO`: Trámite completado, con documento resolutivo final emitido y notificado.
* `REABIERTO`: Expediente cerrado que vuelve a abrirse por nuevo pronunciamiento o apelación.
* `ANULADO`: Registro invalidado formalmente por duplicidad o vicio administrativo.

### Operaciones del Sistema
1. **Registrar:** Apertura del trámite y emisión de la carátula del expediente.
2. **Consultar:** Búsqueda e inspección de metadatos, adjuntos y trazabilidad.
3. **Corregir:** Modificación de campos con error administrativo (manteniendo historial).
4. **Anular:** Invalidación con motivo obligatorio (borrado lógico con log de auditoría).
5. **Cerrar:** Finalización de la atención del expediente.
6. **Reabrir:** Reactivación excepcional de un trámite concluido.
7. **Entregar a Trazabilidad:** Disparo de eventos hacia el Libro Global de Asientos para registrar de forma inmutable quién, cuándo y qué acción se realizó.

---

## 6. Reglas de Códigos y Numeración de Asientos

* **Código de Expediente:** `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]`  
  * *Ejemplo:* `EXP-2026-000001`
* **Código de Documento:** `[TIPO_DOC]-[CORRELATIVO 4 DÍGITOS]-[AÑO]-[SIGLA_AREA]`  
  * *Ejemplo:* `OFIC-0012-2026-DSI`
* **Numeración de Asientos (Libro Global):**  
  * El asiento **NO** es correlativo por expediente.
  * Es un **correlativo global único y lineal del Libro de Asientos del Sistema**: `00000001, 00000002, 00000003...`
  * Cada asiento guarda el timestamp, usuario, acción realizada y una clave foránea (`fk_expediente`) hacia el expediente que originó el movimiento.

---

## 7. Casos Excepcionales y Manejo de Errores

* **Duplicidad de Trámite:** Se detecta coincidencia exacta de DNI/RUC emisor + Número de documento de origen dentro del mismo año. El sistema alerta al operador para evitar duplicación.
* **Numeración Repetida / Concurrencia:** Dos operadores registran simultáneamente. Se utiliza bloqueo pesimista o secuencia transaccional atómica en PostgreSQL para garantizar que el correlativo del libro de asientos nunca se duplique ni salte números.
* **Registro Anulado:** Los expedientes o asientos anulados permanecen visibles para auditoría con bandera inactiva (`is_active = false`), registrando usuario, motivo y fecha de la anulación.
* **Expediente sin Documentos:** El sistema aplica validación obligatoria a nivel de base de datos y backend; si la colección de documentos adjuntos está vacía (`count == 0`), la transacción se rechaza y no se genera asiento.

---

## 8. Fuentes Normativas y Referenciales
* **Ley Nº 27444:** Texto Único Ordenado de la Ley del Procedimiento Administrativo General (Principios de celeridad, eficacia y debido procedimiento).
* **Modelo de Gestión Documental (MGD):** Presidencia del Consejo de Ministros (PCM) y Secretaría de Gobierno y Transformación Digital.
* **Directivas de Trámite Documentario Institucional:** Estándares de recepción, foliación, despacho y archivo central.

---

## 9. Preguntas Pendientes de Definición (§10 del Plan)
1. ¿El correlativo global del Libro de Asientos se reinicia a cero anualmente o es consecutivo histórico continuo?
2. ¿Qué mecanismo criptográfico (ej. firma digital X.509 o hash SHA-256) garantizará la inmutabilidad de los asientos registrados?
3. ¿Cuál será el peso máximo y tipos MIME permitidos para los documentos adjuntos (PDF/A, límites de 15 MB o 25 MB)?
4. ¿El cálculo de folios lo hará automáticamente el backend sumando páginas de PDFs o será digitado por Mesa de Partes?
5. ¿Qué nivel de rol o jerarquía institucional tiene autorización para realizar la reapertura de un expediente cerrado?
6. ¿Se admitirá derivación múltiple simultánea (paralela) o estrictamente un área tenedora a la vez (secuencial)?
7. ¿Cómo se estructurará la política de borrado lógico y trazabilidad ante requerimientos de privacidad de datos?
8. ¿Qué regla de negocio determinará el tiempo límite para declarar el abandono de un trámite en estado "Observado"?