# An├ílisis Funcional: Tr├ímite, Expediente y Libro de Registro (SIGD)
**Proyecto:** Sistema Integral de Gesti├│n Documentaria (SIGD)
**Grupo de Trabajo:** Documentos de Trabajo Grupo 2 ΓÇô ΓÇ£TramiCoreΓÇ¥
**Responsable del An├ílisis:** Leysglin Riquelmer Fachin Rojas (Rama: `B_RIQUELMER`)
**Subl├¡der / Integrador:** Elmer Ram├¡rez (`B_RAMIREZ`)
**Versi├│n:** 2.1 (Fase 1 ΓÇô Cumplimiento estricto de rotulado y criterios de aceptaci├│n)

---

## 1. Objetivo y Alcance del M├│dulo

### 1.1 Objetivo
Definir el n├║cleo documental del SIGD, diferenciando conceptualmente tr├ímite, expediente, documento y asiento del libro de registro. Se establece la separaci├│n entre identificadores t├⌐cnicos internos y c├│digos visibles, se definen los actores, se detallan los flujos operativos paso a paso y se formulan las preguntas institucionales pendientes.

### 1.2 Alcance
Comprende desde la presentaci├│n de la solicitud en Mesa de Partes hasta el asentado en el Libro de Registro, la conformaci├│n del expediente, la actualizaci├│n controlada, la atenci├│n por las ├íreas y la entrega de eventos al m├│dulo de trazabilidad (Grupo 1). No fija formatos definitivos ni reemplaza las reglas oficiales que determine la instituci├│n.

---

## 2. Diferenciaci├│n Conceptual con Ejemplos Propios

* **Tr├ímite `[PROPUESTO]`:** Gesti├│n, petici├│n o requerimiento administrativo formal que promueve un administrado o trabajador con un prop├│sito espec├¡fico.
  * *`[EJEMPLO]`*: Un estudiante solicita la emisi├│n de su "Certificado Oficial de Estudios" o un docente solicita "Licencia con goce de haber".
* **Expediente `[PROPUESTO]`:** Unidad documental l├│gica, acumulativa y cronol├│gica que agrupa todos los escritos, prove├¡dos, informes t├⌐cnicos y resoluciones vinculadas a un mismo tr├ímite.
  * *`[EJEMPLO]`*: La carpeta digital identificada provisionalmente con el c├│digo `EXP-2026-000104`, que re├║ne el FUT, el comprobante de pago, el informe de notas y la resoluci├│n de entrega.
* **Documento Presentado `[PROPUESTO]`:** Unidad f├¡sica o digital de sustento (solicitud, oficio, informe en PDF, comprobante) que acredita o fundamenta una actuaci├│n dentro del expediente.
  * *`[EJEMPLO]`*: El archivo digitalizado `FUT_solicitud_firmada.pdf` de 2 folios o el comprobante de caja `recibo_pago_0891.pdf`.
* **Asiento del Libro de Registro `[PROPUESTO]`:** Constancia oficial, fechada y numerada de forma secuencial en el Libro General de Registros que acredita formalmente un evento ocurrido. Una vez generado, el asiento **no se elimina y su n├║mero no se reutiliza**; solo pueden actualizarse sus campos de control de anulaci├│n.
  * *`[EJEMPLO]`*: Asiento N┬║ `00004521`, asentado el `28/08/2026 09:15:02`, que certifica que el expediente `EXP-2026-000104` ingres├│ por Mesa de Partes Virtual y se deriv├│ a Secretar├¡a Acad├⌐mica.

---

## 3. Identificadores T├⌐cnicos Internos vs. C├│digos Visibles

* **Identificadores T├⌐cnicos Internos `[PROPUESTO]`:**
  * Claves primarias (`id` autoincremental / `BIGSERIAL` o `UUID`) gestionadas internamente por el motor PostgreSQL.
  * Nunca se exponen al usuario final ni se emplean como c├│digo de tr├ímite en ventanilla.
  * Aseguran la integridad referencial y las relaciones entre tablas de la base de datos.
* **C├│digos Visibles y de Negocio `[PROPUESTO]`:**
  * Estructuras de texto legibles para el administrado y los operadores.
  * Sujetos a modificaci├│n seg├║n directiva institucional sin alterar las claves primarias t├⌐cnicas de la base de datos.
  * Se proh├¡be el uso de `MAX() + 1` para su generaci├│n; se gestionan mediante secuencias transaccionales seguras de PostgreSQL (`SEQUENCE`).

---

## 4. Actores del Sistema y Roles Definidos

* **Administrado / Solicitante (Externo o Interno) `[PROPUESTO]`:**
  * *Responsabilidad:* Registra la solicitud por Mesa de Partes (presencial o virtual), aporta datos de contacto, adjunta requisitos y realiza el seguimiento del tr├ímite.
* **Operador de Mesa de Partes `[PROPUESTO]`:**
  * *Responsabilidad:* Valida formalmente los requisitos y folios, apertura el expediente, asienta el ingreso en el Libro de Registro y emite el cargo oficial.
* **Especialista / Funcionario de ├ürea Resolutora `[PROPUESTO]`:**
  * *Responsabilidad:* Revisa el fondo del requerimiento, emite informes u oficios de respuesta, solicita subsanaciones o deriva el expediente a otra oficina.
* **Jefe de ├ürea / Autoridad Institucional `[PROPUESTO]`:**
  * *Responsabilidad:* Suscribe el acto resolutivo final, autoriza reasignaciones y dispone el cierre o reapertura formal del expediente.
* **Administrador del Sistema SIGD `[PROPUESTO]`:**
  * *Responsabilidad:* Configura periodos de numeraci├│n, audita la inmutabilidad de los asientos y ejecuta anulaciones l├│gicas bajo justificaci├│n administrativa.

---

## 5. Datos de Entrada, Remitente y Destinatario

### 5.1 Datos del Remitente `[PROPUESTO]`
* **Tipo de Persona:** Natural o Jur├¡dica `[PROPUESTO]`.
* **Tipo y N├║mero de Identificaci├│n:** DNI, Carn├⌐ de Extranjer├¡a o RUC `[PROPUESTO]`.
* **Nombres y Apellidos / Raz├│n Social:** Nombre legal acreditable `[PROPUESTO]`.
* **Datos de Contacto:** Correo electr├│nico, tel├⌐fono celular y domicilio fiscal o real `[PROPUESTO]`.
* *Regla de integraci├│n:* Se vincula mediante clave for├ínea al m├│dulo de personas/administrados del Grupo 4 sin duplicar datos personales en las tablas de tr├ímite. El solicitante externo puede ser registrado de forma asistida por Mesa de Partes sin exigir credenciales (ver ┬º5.4).

### 5.2 Datos del Destinatario `[PROPUESTO]`
* **Unidad Org├ínica / Dependencia:** ├ürea de destino competente (ej. Direcci├│n General, Secretar├¡a Acad├⌐mica, Log├¡stica) `[PROPUESTO]`.
* **Funcionario Destino:** Usuario asignado dentro del ├írea destinataria `[PENDIENTE]`.
* *Regla de integraci├│n:* Se vincula mediante referencia al cat├ílogo organizacional del Grupo 3.

### 5.3 Datos del Cuerpo del Registro `[PROPUESTO]`
* **Tipo de Documento de Origen:** Solicitud (FUT), Oficio, Memor├índum, Carta `[PROPUESTO]`.
* **N├║mero de Documento de Origen:** C├│digo visible del documento presentado (ej. `OF-015-2026-MINEDU`) `[EJEMPLO]`.
* **Asunto / Sumilla:** Resumen del requerimiento solicitado (m├íximo 500 caracteres) `[PROPUESTO]`.
* **Folios Declarados:** Cantidad f├¡sica de hojas sustentatorias `[PROPUESTO]`.
* **Canal de Ingreso:** `MESA_PRESENCIAL` o `MESA_VIRTUAL` `[PROPUESTO]`.
* **Documentos Digitalizados:** Archivos adjuntos en formato PDF/A `[PROPUESTO]`.

### 5.4 Solicitante Externo sin Usuario Registrado `[PROPUESTO]`
* **Contexto:** Todo administrado puede presentar documentos ante Mesa de Partes sin haber creado una cuenta ni haber ingresado al SIGD (Grupo 4).
* **Representaci├│n propuesta:** Los datos de identidad (tipo y n├║mero de identificaci├│n, nombres y apellidos, contacto) se capturan en Mesa de Partes mediante un registro **asistido** en el m├│dulo de personas/administrados del Grupo 4, sin exigir credenciales de acceso.
* **Referencia t├⌐cnica:** `fk_remitente` referencia el registro interno de la persona (correlativo de administrado), no una cuenta de usuario; los tr├ímites internos de funcionarios s├¡ usan su cuenta de usuario existente.
* **Caso pendiente:** Validar con el profesor si el SIGD mantiene un registro maestro de administrados externos o si se conserva un duplicado m├¡nimo de datos en cada tr├ímite.

---

## 6. Reglas de C├│digos, Formatos y Numeraci├│n

> **Aclaraci├│n Metodol├│gica:** Los siguientes formatos, estructuras y reglas corresponden a propuestas t├⌐cnicas de trabajo y ejemplos demostrativos; no representan una especificaci├│n institucional oficial.

### 6.1 C├│digo de Expediente / Tr├ímite
* **Formato Propuesto `[PROPUESTO]`:** `EXP-[A├æO]-[CORRELATIVO 6 D├ìGITOS]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `EXP-2026-000001`
* **Criterio de Negocio `[PROPUESTO]`:** Unicidad por a├▒o fiscal; el correlativo se reinicia cada 1 de enero si la directiva institucional as├¡ lo estipula `[PENDIENTE]`.

### 6.2 C├│digo de Documento de Origen
* **Formato Propuesto `[PROPUESTO]`:** `[TIPO_DOC]-[CORRELATIVO 4 D├ìGITOS]-[A├æO]-[SIGLA_AREA]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `OFIC-0012-2026-DSI`
* **Criterio de Negocio `[PROPUESTO]`:** Identifica la procedencia y tipolog├¡a del escrito dentro del expediente `[PROPUESTO]`.

### 6.3 Numeraci├│n de Asientos en el Libro General de Registros
* **Propuesta de Correlativo Global `[PROPUESTO]`:** La numeraci├│n de asientos **NO** es individual por expediente, sino una secuencia ├║nica y global de todo el sistema documental para garantizar auditor├¡a institucional. La secuencia es monot├│nica y sin duplicados; si una transacci├│n consume un valor de `nextval()` y luego se revierte, quedar├í un hueco en la numeraci├│n, lo cual es aceptable y no afecta la integridad del Libro.
* **Ejemplos Demostrativos de Secuencia `[EJEMPLO]`:** `00000001`, `00000002`, `00000003`, etc.
* **Criterio T├⌐cnico de Generaci├│n `[PROPUESTO]`:** Se proh├¡be el uso de `SELECT MAX(...) + 1` por fallas ante peticiones simult├íneas; se generar├í mediante secuencias transaccionales nativas de PostgreSQL (`SEQUENCE`).

### 6.4 Tratamiento de Anulaciones y Preservaci├│n de Historial
* **Mecanismo de Anulaci├│n `[PROPUESTO]`:** Ante anulaciones autorizadas, los registros nunca se eliminan f├¡sicamente de la base de datos (`NO DELETE`). La anulaci├│n se aplica **sobre el propio asiento** mediante la bandera `anulado = true` m├ís el campo `motivo_anulacion`, sin reutilizar ni reasignar su `numero_registro`.
* **Registro de Auditor├¡a `[PROPUESTO]`:** El asiento original no se elimina y su n├║mero no se reutiliza; ├║nicamente se actualizan sus campos de control de anulaci├│n (`anulado`, `motivo_anulacion`). La anulaci├│n **no genera un asiento nuevo** y el evento se entrega al m├│dulo de trazabilidad (Grupo 1) para auditor├¡a p├║blica.

---

## 7. Flujos Operativos Detallados Paso a Paso

### 7.1 Flujo Normal: Presentaci├│n y Registro Inicial
1. **Presentaci├│n de Documentaci├│n:**
   * *Entrada:* Datos del remitente, asunto, dependencia destino, folios y archivo PDF.
   * *Responsable:* Administrado / Operador de Mesa de Partes.
2. **Validaci├│n Formal de Requisitos:**
   * *Validaci├│n:* Verificaci├│n de legibilidad, identificaci├│n del solicitante y cumplimiento de requisitos TUPA.
   * *Responsable:* Operador de Mesa de Partes.
3. **Creaci├│n del Expediente:**
   * *Procesamiento:* El sistema crea el contenedor con estado `REGISTRADO` y genera su c├│digo visible propuesto (ej. `EXP-2026-000001` `[EJEMPLO]`).
   * *Responsable:* Sistema SIGD.
4. **Asentado en el Libro General de Registros:**
   * *Procesamiento:* Generaci├│n autom├ítica del asiento de correlativo global propuesto (ej. Asiento `00001205` `[EJEMPLO]`).
   * *Responsable:* Sistema SIGD.
5. **Emisi├│n de Cargo:**
   * *Resultado:* Comprobante con sello de recepci├│n y c├│digo de verificaci├│n.
   * *Responsable:* Mesa de Partes.
6. **Derivaci├│n Inicial y Trazabilidad:**
   * *Procesamiento:* El expediente cambia a estado `EN_TRAMITE`, pasa a la bandeja del ├írea de destino y despacha el evento al m├│dulo de trazabilidad (Grupo 1).
   * *Responsable:* Mesa de Partes / Sistema.

### 7.2 Flujos Excepcionales Paso a Paso

* **Excepci├│n 1: Requisitos Incompletos o Defectuosos `[PROPUESTO]`**
  * *Condici├│n:* Documentaci├│n ilegible o ausencia de requisitos obligatorios.
  * *Acci├│n:* Mesa de Partes asigna estado `OBSERVADO`, registra la observaci├│n formal y notifica al administrado otorgando un plazo legal de 48 horas (2 d├¡as h├íbiles) para subsanar. Si vence el plazo sin subsanaci├│n, pasa a estado `ARCHIVADO` por abandono.
* **Excepci├│n 2: Destino Inv├ílido o Devoluci├│n por Incompetencia `[PROPUESTO]`**
  * *Condici├│n:* El ├írea receptora determina que la atenci├│n no compete a sus funciones.
  * *Acci├│n:* El especialista registra la devoluci├│n motivada. El expediente retorna a Mesa de Partes mediante un nuevo asiento de retorno, sin alterar asientos previos, para su reasignaci├│n.
* **Excepci├│n 3: Intento de Numeraci├│n Repetida / Concurrencia Simult├ínea `[PROPUESTO]`**
  * *Condici├│n:* Dos operadores intentan registrar un documento en el mismo milisegundo.
*   *Acci├│n:* Se descarta `MAX() + 1`. Se implementan secuencias at├│micas de PostgreSQL (`SEQUENCE`) para asegurar correlatividad monot├│nica y **sin duplicados**; se admite que existan **huecos** ante reversiones (`ROLLBACK`) posteriores a la consumici├│n de un valor.
* **Excepci├│n 4: Detecci├│n de Tr├ímite Duplicado `[PROPUESTO]`**
  * *Condici├│n:* Ingreso de una solicitud con id├⌐ntico remitente, tipo de documento y n├║mero dentro del mismo a├▒o fiscal.
  * *Acci├│n:* El sistema emite advertencia bloqueante en pantalla. El operador valida si es reiteraci├│n o si debe anexarse al expediente preexistente.
* **Excepci├│n 5: Expediente sin Documentos Adjuntos Requeridos `[PROPUESTO]`**
  * *Condici├│n:* Formulario enviado sin PDF de sustento adjunto.
  * *Acci├│n:* Validaci├│n que aborta la operaci├│n (`ROLLBACK`). No se autoriza la creaci├│n de expedientes vac├¡os.
* **Excepci├│n 6: Registro Anulado `[PROPUESTO]`**
  * *Condici├│n:* Error material comprobado o registro fraudulento.
  * *Acci├│n:* Se marca el asiento como `anulado = true` con su `motivo_anulacion`, sin `DELETE` ni reutilizaci├│n del n├║mero. El asiento original no se elimina y solo se actualizan sus campos de control de anulaci├│n; el expediente pasa al estado `ANULADO` y el evento de anulaci├│n queda registrado en trazabilidad (Grupo 1).
* **Excepci├│n 7: Desistimiento Voluntario `[PROPUESTO]`**
  * *Condici├│n:* El solicitante desiste formalmente antes de la resoluci├│n final.
  * *Acci├│n:* Se anexa el documento de desistimiento y el expediente cambia al estado `CERRADO`.
* **Excepci├│n 8: Reapertura Excepcional `[PROPUESTO]`**
  * *Condici├│n:* Presentaci├│n de recurso impugnatorio fundado contra un tr├ímite cerrado.
  * *Acci├│n:* Con autorizaci├│n de la autoridad institucional, el expediente cambia a estado `REABIERTO`, preservando su historial ├¡ntegro.

---

## 8. Matriz Funcional Propuesta

| Operaci├│n / Funci├│n `[PROPUESTO]` | Entradas (Inputs) | Procesamiento y Reglas de Negocio | Salidas (Outputs) | Estado Resultante | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar Tr├ímite** | Remitente, destinatario, asunto, folios, PDF. | Valida requisitos, asigna ID t├⌐cnico, genera c├│digo visible y crea asiento global. | Expediente creado, Asiento emitido, Cargo de recepci├│n. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | C├│digo visible o Documento de Identidad. | Filtra por permisos de usuario y expone metadatos y cronolog├¡a de asientos. | Ficha del expediente, lista de documentos y trazabilidad. | *(Sin cambio)* | P├║blico / Funcionarios |
| **Corregir / Subsanar** | Escrito de subsanaci├│n o correcci├│n material. | V├ílido ├║nicamente en estado `OBSERVADO` o error justificado. No destruye historial. | Asiento de subsanaci├│n, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | C├│d. expediente, ├írea destino, prove├¡do. | Verifica tenencia activa; genera nuevo asiento de movimiento. | Notificaci├│n al ├írea receptora, Asiento de derivaci├│n. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento resolutivo final, notificaci├│n. | Valida resoluci├│n del caso y bloquea nuevos tr├ímites ordinarios. | Expediente concluido, Asiento de cierre. | `CERRADO` | Jefe de ├ürea Resolutora |
| **Reabrir Expediente** | Solicitud justificada, recurso legal. | Requiere validaci├│n de estado `CERRADO` y permiso de jefatura. | Expediente reactivado, Asiento de reapertura. | `REABIERTO` | Jefe de ├ürea / Administrador |
| **Anular Registro** | C├│digo de expediente, justificaci├│n formal. | Anulaci├│n l├│gica (`anulado = true` + `motivo_anulacion`), mantiene auditor├¡a en el libro. | Expediente invalidado, evento de anulaci├│n para trazabilidad. | `ANULADO` | Administrador del Sistema |
| **Entregar a Trazabilidad** | Eventos originados por cualquier operaci├│n. | Despacha la carga estructurada al bus de seguimiento del Grupo 1. | Confirmaci├│n de recepci├│n en el m├│dulo de seguimiento. | *(Seg├║n evento)* | Sistema SIGD (Core) |

---

## 9. Registro de Decisiones Tomadas y Propuestas

| C├│digo | Decisi├│n Adoptada | Categor├¡a | Justificaci├│n T├⌐cnica o Normativa |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Separaci├│n conceptual de Tr├ímite, Expediente, Documento y Asiento. | `[PROPUESTO]` | Previene la sobrecarga de datos en una sola entidad y asegura escalabilidad bajo el Modelo de Gesti├│n Documental (MGD). |
| **DEC-02** | Propuesta de asientos con correlativo global secuencial. | `[PROPUESTO]` | El Libro de Registro certifica el flujo general de toda la entidad y no debe reiniciarse por cada expediente individual. |
| **DEC-03** | Generaci├│n de correlativos mediante secuencias nativas de PostgreSQL (`SEQUENCE`). | `[PROPUESTO]` | Elimina problemas de colisi├│n por concurrencia provocados por consultas manuales del tipo `MAX + 1`. |
| **DEC-04** | Preservaci├│n de registros anulados mediante anulaci├│n l├│gica (`anulado = true` + motivo). | `[PROPUESTO]` | Garantiza auditor├¡a e inmutabilidad legal exigida por la normativa administrativa p├║blica. |
| **DEC-05** | No duplicaci├│n de entidades de personas ni unidades org├ínicas. | `[CONFIRMADO]` | Arquitectura modular: consumo de identificadores de los Grupos 4 (usuarios) y 3 (├íreas). |
| **DEC-06** | Estructura visible de expediente `EXP-[A├æO]-[CORRELATIVO 6 D├ìGITOS]`. | `[PROPUESTO]` | Formato de trabajo representativo sujeto a la directiva que determine la instituci├│n. |
| **DEC-07** | Periodicidad del reinicio de correlativo del Libro de Registros. | `[PENDIENTE]` | Debe validarse con el profesor si el correlativo se reinicia el 1 de enero o si es hist├│rico continuo. |
| **DEC-08** | Implementaci├│n obligatoria de firma digital criptogr├ífica (X.509). | `[PENDIENTE]` | Pendiente definir si el sistema exigir├í certificado digital o validar├í mediante firma escaneada y hash de verificaci├│n. |
| **DEC-09** | Representaci├│n del solicitante externo sin credenciales mediante registro asistido en el Grupo 4. | `[PROPUESTO]` | Garantiza que todo administrado pueda tramitar sin crear cuenta, conservando la integridad referencial de `fk_remitente`. |

---

## 10. Investigaci├│n de Buenas Pr├ícticas de Gesti├│n Documental

### 10.1 Ley N┬║ 27444 ΓÇô LPAG
* **Fuente exacta:** Ley N┬║ 27444, Ley del Procedimiento Administrativo General (publicada el 11/04/2001). **Texto ├Ünico Ordenado vigente:** aprobado por **Decreto Supremo N┬║ 006-2026-JUS**, publicado en el Diario Oficial El Peruano el **30/04/2026**, que compila y sistematiza las modificaciones a la Ley (entre ellas el DL N┬║ 1452, el DL N┬║ 1497 y el DL N┬║ 1561) y **deroga** el TUO anterior (DS N┬║ 004-2019-JUS).
  * *Enlace oficial:* https://www.gob.pe/institucion/minjus/normas-legales/8169463-006-2026-jus
  * *Explicaci├│n con palabras propias:* Esta norma rige el funcionamiento administrativo del Estado. Sus principios (T├¡tulo Preliminar: **legalidad 1.1, debido procedimiento 1.2 y celeridad 1.9**) exigen que toda recepci├│n documental sea registrada en estricto orden de llegada y que se entregue un cargo con fecha y hora cierta al administrado. Dispone que si una solicitud carece de requisitos formales, la instituci├│n no puede rechazarla de plano; debe conceder un plazo (habitualmente 48 horas / 2 d├¡as h├íbiles) para que el administrado subsane la omisi├│n antes de declarar el abandono. Estas reglas sustentan los flujos de las secciones 4 a 8 y la numeraci├│n global del Libro de Registro.
### 10.2 Modelo de Gesti├│n Documental (MGD) ΓÇô Presidencia del Consejo de Ministros (PCM / SEGDI)
* *Fuente exacta:* **Modelo de Gesti├│n Documental**, aprobado por **Resoluci├│n de Secretar├¡a de Gobierno Digital N┬║ 001-2017-PCM/SEGDI**, publicada en El Peruano el **09/08/2017**, en el marco del Decreto Legislativo N┬║ 1310 (art├¡culo 8: interconexi├│n de los sistemas de tr├ímite documentario). Su art├¡culo 4 fue modificado por la **R.S. N┬║ 003-2018-PCM/SEGDI** (21/09/2018), que designa al Comit├⌐ de Gobierno Digital como Responsable Directivo de su implementaci├│n.
  * *Enlace oficial:* https://www.gob.pe/institucion/pcm/normas-legales/292301-001-2017-pcm-segdi
  * *Explicaci├│n con palabras propias:* Es el marco normativo peruano que define la digitalizaci├│n documental p├║blica. Exige dividir el ciclo documental en **recepci├│n, emisi├│n, despacho, seguimiento y archivo**, manteniendo expedientes electr├│nicos ├¡ntegros, foliados digitalmente e inalterables. Se├▒ala que los asientos registrales no pueden modificarse una vez generados, debiendo implementarse pistas de auditor├¡a que garanticen autenticidad e integridad.

### 10.3 Directivas Institucionales de Tr├ímite Documentario
  * *Situaci├│n de la fuente:* Este an├ílisis a├║n no identifica la entidad anfitriona del SIGD (ver ┬º11 y el plan de trabajo del Grupo 2), por lo que **no corresponde fijar todav├¡a el n├║mero exacto de la directiva interna**. Su identificaci├│n queda como actividad pendiente de coordinaci├│n con la instituci├│n; no se citar├í un documento institucional sin su denominaci├│n y fecha verificadas.
  * *Anclas normativas verificables que la sustentan mientras tanto:*
    * Art├¡culo 8 del **Decreto Legislativo N┬║ 1310**: interconexi├│n de los sistemas de tr├ímite documentario de las entidades de la Administraci├│n P├║blica (base normativa del MGD).
    * Art├¡culo 38 del **TUO de la Ley N┬║ 27444** (DS N┬║ 006-2026-JUS): aprobaci├│n y difusi├│n del TUPA, instrumento que fija requisitos, plazos y tasas de cada procedimiento atendido por Mesa de Partes.
    * **Reglamento de Organizaci├│n y Funciones (ROF)** de la entidad: regula qu├⌐ unidad org├ínica emite la directiva de tr├ímite documentario y aprueba la apertura anual de los Libros de Registros.
  * *Explicaci├│n con palabras propias:* Las directivas internas regulan la apertura anual de los Libros de Registros, fijan las atribuciones para autorizar cierres o reasignaciones de expedientes y dictaminan que toda correcci├│n por error material deba asentarse mediante notas marginales o nuevos asientos rectificatorios, quedando prohibido eliminar f├¡sicamente registros del sistema. Hasta que la entidad sea definida, estas reglas se respaldan en las anclas normativas indicadas arriba.

---

## 11. Preguntas Oficiales para Definici├│n Institucional (┬º10 del Plan)

1. ┬┐Qu├⌐ diferencia oficial existe entre tr├ímite, expediente, documento presentado y asiento del libro de registro? `[PENDIENTE]`
2. ┬┐Un tr├ímite crea siempre un expediente y un ├║nico n├║mero de registro, o pueden existir otras cardinalidades? `[PENDIENTE]`
3. ┬┐El c├│digo de tr├ímite y el c├│digo de expediente son el mismo dato? ┬┐Qu├⌐ formato y longitud deben tener? `[PENDIENTE]`
4. ┬┐El n├║mero de registro se reinicia por a├▒o, libro, sede o ├írea, y qui├⌐n est├í autorizado para generarlo? `[PENDIENTE]`
5. ┬┐El destinatario inicial ser├í un usuario, un ├írea, una oficina o una combinaci├│n de ellos? `[PENDIENTE]`
6. ┬┐Qu├⌐ estados oficiales existen y qu├⌐ operaciones se permiten despu├⌐s del cierre, anulaci├│n o archivamiento? `[PENDIENTE]`
7. ┬┐C├│mo se corrige un asiento equivocado sin perder el historial ni reutilizar su n├║mero? `[PENDIENTE]`
8. ┬┐Qu├⌐ informaci├│n pasa a trazabilidad y qu├⌐ debe ocurrir si faltan documentos o requisitos del tr├ímite? `[PENDIENTE]`
9. ┬┐El solicitante externo debe registrarse previamente como usuario, o basta con capturar sus datos al momento de la recepci├│n en Mesa de Partes? `[PENDIENTE]`
