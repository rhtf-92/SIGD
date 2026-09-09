# AnÃlisis Funcional: TrÃmite, Expediente y Libro de Registro (SIGD)
**Proyecto:** Sistema Integral de GestiA|n Documentaria (SIGD)
**Grupo de Trabajo:** Documentos de Trabajo Grupo 2 — —TramiCore÷
**Responsable del AnÃlisis:** Leysglin Riquelmer Fachin Rojas (Rama: `B_RIQUELMER`)
**SublA¡der / Integrador:** Elmer RamA¡rez (`B_RAMIREZ`)
**VersiA|n:** 2.1 (Fase 1 — Cumplimiento estricto de rotulado y criterios de aceptaciA|n)

---

## 1. Objetivo y Alcance del MA|dulo

### 1.1 Objetivo
Definir el nA║cleo documental del SIGD, diferenciando conceptualmente trÃmite, expediente, documento y asiento del libro de registro. Se establece la separaciA|n entre identificadores tA⌐cnicos internos y cA|digos visibles, se definen los actores, se detallan los flujos operativos paso a paso y se formulan las preguntas institucionales pendientes.

### 1.2 Alcance
Comprende desde la presentaciA|n de la solicitud en Mesa de Partes hasta el asentado en el Libro de Registro, la conformaciA|n del expediente, la actualizaciA|n controlada, la atenciA|n por las Ãreas y la entrega de eventos al mA|dulo de trazabilidad (Grupo 1). No fija formatos definitivos ni reemplaza las reglas oficiales que determine la instituciA|n.

---

## 2. DiferenciaciA|n Conceptual con Ejemplos Propios

* **TrÃmite `[PROPUESTO]`:** GestiA|n, peticiA|n o requerimiento administrativo formal que promueve un administrado o trabajador con un propA|sito especA¡fico.
  * *`[EJEMPLO]`*: Un estudiante solicita la emisiA|n de su "Certificado Oficial de Estudios" o un docente solicita "Licencia con goce de haber".
* **Expediente `[PROPUESTO]`:** Unidad documental lA|gica, acumulativa y cronolA|gica que agrupa todos los escritos, proveA¡dos, informes tA⌐cnicos y resoluciones vinculadas a un mismo trÃmite.
  * *`[EJEMPLO]`*: La carpeta digital identificada provisionalmente con el cA|digo `EXP-2026-000104`, que reA║ne el FUT, el comprobante de pago, el informe de notas y la resoluciA|n de entrega.
* **Documento Presentado `[PROPUESTO]`:** Unidad fA¡sica o digital de sustento (solicitud, oficio, informe en PDF, comprobante) que acredita o fundamenta una actuaciA|n dentro del expediente.
  * *`[EJEMPLO]`*: El archivo digitalizado `FUT_solicitud_firmada.pdf` de 2 folios o el comprobante de caja `recibo_pago_0891.pdf`.
* **Asiento del Libro de Registro `[PROPUESTO]`:** Constancia oficial, fechada y numerada de forma secuencial en el Libro General de Registros que acredita formalmente un evento ocurrido. Una vez generado, el asiento **no se elimina y su nA║mero no se reutiliza**; solo pueden actualizarse sus campos de control de anulaciA|n.
  * *`[EJEMPLO]`*: Asiento N┬║ `00004521`, asentado el `28/08/2026 09:15:02`, que certifica que el expediente `EXP-2026-000104` ingresA| por Mesa de Partes Virtual y se derivA| a SecretarA¡a AcadA⌐mica.

---

## 3. Identificadores TA⌐cnicos Internos vs. CA|digos Visibles

* **Identificadores TA⌐cnicos Internos `[PROPUESTO]`:**
  * Claves primarias (`id` autoincremental / `BIGSERIAL` o `UUID`) gestionadas internamente por el motor PostgreSQL.
  * Nunca se exponen al usuario final ni se emplean como cA|digo de trÃmite en ventanilla.
  * Aseguran la integridad referencial y las relaciones entre tablas de la base de datos.
* **CA|digos Visibles y de Negocio `[PROPUESTO]`:**
  * Estructuras de texto legibles para el administrado y los operadores.
  * Sujetos a modificaciA|n segA║n directiva institucional sin alterar las claves primarias tA⌐cnicas de la base de datos.
  * Se prohA¡be el uso de `MAX() + 1` para su generaciA|n; se gestionan mediante secuencias transaccionales seguras de PostgreSQL (`SEQUENCE`).

---

## 4. Actores del Sistema y Roles Definidos

* **Administrado / Solicitante (Externo o Interno) `[PROPUESTO]`:**
  * *Responsabilidad:* Registra la solicitud por Mesa de Partes (presencial o virtual), aporta datos de contacto, adjunta requisitos y realiza el seguimiento del trÃmite.
* **Operador de Mesa de Partes `[PROPUESTO]`:**
  * *Responsabilidad:* Valida formalmente los requisitos y folios, apertura el expediente, asienta el ingreso en el Libro de Registro y emite el cargo oficial.
* **Especialista / Funcionario de Aürea Resolutora `[PROPUESTO]`:**
  * *Responsabilidad:* Revisa el fondo del requerimiento, emite informes u oficios de respuesta, solicita subsanaciones o deriva el expediente a otra oficina.
* **Jefe de Aürea / Autoridad Institucional `[PROPUESTO]`:**
  * *Responsabilidad:* Suscribe el acto resolutivo final, autoriza reasignaciones y dispone el cierre o reapertura formal del expediente.
* **Administrador del Sistema SIGD `[PROPUESTO]`:**
  * *Responsabilidad:* Configura periodos de numeraciA|n, audita la inmutabilidad de los asientos y ejecuta anulaciones lA|gicas bajo justificaciA|n administrativa.

---

## 5. Datos de Entrada, Remitente y Destinatario

### 5.1 Datos del Remitente `[PROPUESTO]`
* **Tipo de Persona:** Natural o JurA¡dica `[PROPUESTO]`.
* **Tipo y NA║mero de IdentificaciA|n:** DNI, CarnA⌐ de ExtranjerA¡a o RUC `[PROPUESTO]`.
* **Nombres y Apellidos / RazA|n Social:** Nombre legal acreditable `[PROPUESTO]`.
* **Datos de Contacto:** Correo electrA|nico, telA⌐fono celular y domicilio fiscal o real `[PROPUESTO]`.
* *Regla de integraciA|n:* Se vincula mediante clave forÃnea al mA|dulo de personas/administrados del Grupo 4 sin duplicar datos personales en las tablas de trÃmite. El solicitante externo puede ser registrado de forma asistida por Mesa de Partes sin exigir credenciales (ver ┬º5.4).

### 5.2 Datos del Destinatario `[PROPUESTO]`
* **Unidad OrgÃnica / Dependencia:** Aürea de destino competente (ej. DirecciA|n General, SecretarA¡a AcadA⌐mica, LogA¡stica) `[PROPUESTO]`.
* **Funcionario Destino:** Usuario asignado dentro del Ãrea destinataria `[PENDIENTE]`.
* *Regla de integraciA|n:* Se vincula mediante referencia al catÃlogo organizacional del Grupo 3.

### 5.3 Datos del Cuerpo del Registro `[PROPUESTO]`
* **Tipo de Documento de Origen:** Solicitud (FUT), Oficio, MemorÃndum, Carta `[PROPUESTO]`.
* **NA║mero de Documento de Origen:** CA|digo visible del documento presentado (ej. `OF-015-2026-MINEDU`) `[EJEMPLO]`.
* **Asunto / Sumilla:** Resumen del requerimiento solicitado (mÃximo 500 caracteres) `[PROPUESTO]`.
* **Folios Declarados:** Cantidad fA¡sica de hojas sustentatorias `[PROPUESTO]`.
* **Canal de Ingreso:** `MESA_PRESENCIAL` o `MESA_VIRTUAL` `[PROPUESTO]`.
* **Documentos Digitalizados:** Archivos adjuntos en formato PDF/A `[PROPUESTO]`.

### 5.4 Solicitante Externo sin Usuario Registrado `[PROPUESTO]`
* **Contexto:** Todo administrado puede presentar documentos ante Mesa de Partes sin haber creado una cuenta ni haber ingresado al SIGD (Grupo 4).
* **RepresentaciA|n propuesta:** Los datos de identidad (tipo y nA║mero de identificaciA|n, nombres y apellidos, contacto) se capturan en Mesa de Partes mediante un registro **asistido** en el mA|dulo de personas/administrados del Grupo 4, sin exigir credenciales de acceso.
* **Referencia tA⌐cnica:** `fk_remitente` referencia el registro interno de la persona (correlativo de administrado), no una cuenta de usuario; los trÃmites internos de funcionarios sA¡ usan su cuenta de usuario existente.
* **Caso pendiente:** Validar con el profesor si el SIGD mantiene un registro maestro de administrados externos o si se conserva un duplicado mA¡nimo de datos en cada trÃmite.

---

## 6. Reglas de CA|digos, Formatos y NumeraciA|n

> **AclaraciA|n MetodolA|gica:** Los siguientes formatos, estructuras y reglas corresponden a propuestas tA⌐cnicas de trabajo y ejemplos demostrativos; no representan una especificaciA|n institucional oficial.

### 6.1 CA|digo de Expediente / TrÃmite
* **Formato Propuesto `[PROPUESTO]`:** `EXP-[AAæO]-[CORRELATIVO 6 DAìGITOS]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `EXP-2026-000001`
* **Criterio de Negocio `[PROPUESTO]`:** Unicidad por aA▒o fiscal; el correlativo se reinicia cada 1 de enero si la directiva institucional asA¡ lo estipula `[PENDIENTE]`.

### 6.2 CA|digo de Documento de Origen
* **Formato Propuesto `[PROPUESTO]`:** `[TIPO_DOC]-[CORRELATIVO 4 DAìGITOS]-[AAæO]-[SIGLA_AREA]`
* **Ejemplo Demostrativo `[EJEMPLO]`:** `OFIC-0012-2026-DSI`
* **Criterio de Negocio `[PROPUESTO]`:** Identifica la procedencia y tipologA¡a del escrito dentro del expediente `[PROPUESTO]`.

### 6.3 NumeraciA|n de Asientos en el Libro General de Registros
* **Propuesta de Correlativo Global `[PROPUESTO]`:** La numeraciA|n de asientos **NO** es individual por expediente, sino una secuencia A║nica y global de todo el sistema documental para garantizar auditorA¡a institucional. La secuencia es monotA|nica y sin duplicados; si una transacciA|n consume un valor de `nextval()` y luego se revierte, quedarÃ un hueco en la numeraciA|n, lo cual es aceptable y no afecta la integridad del Libro.
* **Ejemplos Demostrativos de Secuencia `[EJEMPLO]`:** `00000001`, `00000002`, `00000003`, etc.
* **Criterio TA⌐cnico de GeneraciA|n `[PROPUESTO]`:** Se prohA¡be el uso de `SELECT MAX(...) + 1` por fallas ante peticiones simultÃneas; se generarÃ mediante secuencias transaccionales nativas de PostgreSQL (`SEQUENCE`).

### 6.4 Tratamiento de Anulaciones y PreservaciA|n de Historial
* **Mecanismo de AnulaciA|n `[PROPUESTO]`:** Ante anulaciones autorizadas, los registros nunca se eliminan fA¡sicamente de la base de datos (`NO DELETE`). La anulaciA|n se aplica **sobre el propio asiento** mediante la bandera `anulado = true` mÃs el campo `motivo_anulacion`, sin reutilizar ni reasignar su `numero_registro`.
* **Registro de AuditorA¡a `[PROPUESTO]`:** El asiento original no se elimina y su nA║mero no se reutiliza; A║nicamente se actualizan sus campos de control de anulaciA|n (`anulado`, `motivo_anulacion`). La anulaciA|n **no genera un asiento nuevo** y el evento se entrega al mA|dulo de trazabilidad (Grupo 1) para auditorA¡a pA║blica.

---

## 7. Flujos Operativos Detallados Paso a Paso

### 7.1 Flujo Normal: PresentaciA|n y Registro Inicial
1. **PresentaciA|n de DocumentaciA|n:**
   * *Entrada:* Datos del remitente, asunto, dependencia destino, folios y archivo PDF.
   * *Responsable:* Administrado / Operador de Mesa de Partes.
2. **ValidaciA|n Formal de Requisitos:**
   * *ValidaciA|n:* VerificaciA|n de legibilidad, identificaciA|n del solicitante y cumplimiento de requisitos TUPA.
   * *Responsable:* Operador de Mesa de Partes.
3. **CreaciA|n del Expediente:**
   * *Procesamiento:* El sistema crea el contenedor con estado `REGISTRADO` y genera su cA|digo visible propuesto (ej. `EXP-2026-000001` `[EJEMPLO]`).
   * *Responsable:* Sistema SIGD.
4. **Asentado en el Libro General de Registros:**
   * *Procesamiento:* GeneraciA|n automÃtica del asiento de correlativo global propuesto (ej. Asiento `00001205` `[EJEMPLO]`).
   * *Responsable:* Sistema SIGD.
5. **EmisiA|n de Cargo:**
   * *Resultado:* Comprobante con sello de recepciA|n y cA|digo de verificaciA|n.
   * *Responsable:* Mesa de Partes.
6. **DerivaciA|n Inicial y Trazabilidad:**
   * *Procesamiento:* El expediente cambia a estado `EN_TRAMITE`, pasa a la bandeja del Ãrea de destino y despacha el evento al mA|dulo de trazabilidad (Grupo 1).
   * *Responsable:* Mesa de Partes / Sistema.

### 7.2 Flujos Excepcionales Paso a Paso

* **ExcepciA|n 1: Requisitos Incompletos o Defectuosos `[PROPUESTO]`**
  * *CondiciA|n:* DocumentaciA|n ilegible o ausencia de requisitos obligatorios.
  * *AcciA|n:* Mesa de Partes asigna estado `OBSERVADO`, registra la observaciA|n formal y notifica al administrado otorgando un plazo legal de 48 horas (2 dA¡as hÃbiles) para subsanar. Si vence el plazo sin subsanaciA|n, pasa a estado `ARCHIVADO` por abandono.
* **ExcepciA|n 2: Destino InvÃlido o DevoluciA|n por Incompetencia `[PROPUESTO]`**
  * *CondiciA|n:* El Ãrea receptora determina que la atenciA|n no compete a sus funciones.
  * *AcciA|n:* El especialista registra la devoluciA|n motivada. El expediente retorna a Mesa de Partes mediante un nuevo asiento de retorno, sin alterar asientos previos, para su reasignaciA|n.
* **ExcepciA|n 3: Intento de NumeraciA|n Repetida / Concurrencia SimultÃnea `[PROPUESTO]`**
  * *CondiciA|n:* Dos operadores intentan registrar un documento en el mismo milisegundo.
*   *AcciA|n:* Se descarta `MAX() + 1`. Se implementan secuencias atA|micas de PostgreSQL (`SEQUENCE`) para asegurar correlatividad monotA|nica y **sin duplicados**; se admite que existan **huecos** ante reversiones (`ROLLBACK`) posteriores a la consumiciA|n de un valor.
* **ExcepciA|n 4: DetecciA|n de TrÃmite Duplicado `[PROPUESTO]`**
  * *CondiciA|n:* Ingreso de una solicitud con idA⌐ntico remitente, tipo de documento y nA║mero dentro del mismo aA▒o fiscal.
  * *AcciA|n:* El sistema emite advertencia bloqueante en pantalla. El operador valida si es reiteraciA|n o si debe anexarse al expediente preexistente.
* **ExcepciA|n 5: Expediente sin Documentos Adjuntos Requeridos `[PROPUESTO]`**
  * *CondiciA|n:* Formulario enviado sin PDF de sustento adjunto.
  * *AcciA|n:* ValidaciA|n que aborta la operaciA|n (`ROLLBACK`). No se autoriza la creaciA|n de expedientes vacA¡os.
* **ExcepciA|n 6: Registro Anulado `[PROPUESTO]`**
  * *CondiciA|n:* Error material comprobado o registro fraudulento.
  * *AcciA|n:* Se marca el asiento como `anulado = true` con su `motivo_anulacion`, sin `DELETE` ni reutilizaciA|n del nA║mero. El asiento original no se elimina y solo se actualizan sus campos de control de anulaciA|n; el expediente pasa al estado `ANULADO` y el evento de anulaciA|n queda registrado en trazabilidad (Grupo 1).
* **ExcepciA|n 7: Desistimiento Voluntario `[PROPUESTO]`**
  * *CondiciA|n:* El solicitante desiste formalmente antes de la resoluciA|n final.
  * *AcciA|n:* Se anexa el documento de desistimiento y el expediente cambia al estado `CERRADO`.
* **ExcepciA|n 8: Reapertura Excepcional `[PROPUESTO]`**
  * *CondiciA|n:* PresentaciA|n de recurso impugnatorio fundado contra un trÃmite cerrado.
  * *AcciA|n:* Con autorizaciA|n de la autoridad institucional, el expediente cambia a estado `REABIERTO`, preservando su historial A¡ntegro.

---

## 8. Matriz Funcional Propuesta

| OperaciA|n / FunciA|n `[PROPUESTO]` | Entradas (Inputs) | Procesamiento y Reglas de Negocio | Salidas (Outputs) | Estado Resultante | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar TrÃmite** | Remitente, destinatario, asunto, folios, PDF. | Valida requisitos, asigna ID tA⌐cnico, genera cA|digo visible y crea asiento global. | Expediente creado, Asiento emitido, Cargo de recepciA|n. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | CA|digo visible o Documento de Identidad. | Filtra por permisos de usuario y expone metadatos y cronologA¡a de asientos. | Ficha del expediente, lista de documentos y trazabilidad. | *(Sin cambio)* | PA║blico / Funcionarios |
| **Corregir / Subsanar** | Escrito de subsanaciA|n o correcciA|n material. | VÃlido A║nicamente en estado `OBSERVADO` o error justificado. No destruye historial. | Asiento de subsanaciA|n, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | CA|d. expediente, Ãrea destino, proveA¡do. | Verifica tenencia activa; genera nuevo asiento de movimiento. | NotificaciA|n al Ãrea receptora, Asiento de derivaciA|n. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento resolutivo final, notificaciA|n. | Valida resoluciA|n del caso y bloquea nuevos trÃmites ordinarios. | Expediente concluido, Asiento de cierre. | `CERRADO` | Jefe de Aürea Resolutora |
| **Reabrir Expediente** | Solicitud justificada, recurso legal. | Requiere validaciA|n de estado `CERRADO` y permiso de jefatura. | Expediente reactivado, Asiento de reapertura. | `REABIERTO` | Jefe de Aürea / Administrador |
| **Anular Registro** | CA|digo de expediente, justificaciA|n formal. | AnulaciA|n lA|gica (`anulado = true` + `motivo_anulacion`), mantiene auditorA¡a en el libro. | Expediente invalidado, evento de anulaciA|n para trazabilidad. | `ANULADO` | Administrador del Sistema |
| **Entregar a Trazabilidad** | Eventos originados por cualquier operaciA|n. | Despacha la carga estructurada al bus de seguimiento del Grupo 1. | ConfirmaciA|n de recepciA|n en el mA|dulo de seguimiento. | *(SegA║n evento)* | Sistema SIGD (Core) |

---

## 9. Registro de Decisiones Tomadas y Propuestas

| CA|digo | DecisiA|n Adoptada | CategorA¡a | JustificaciA|n TA⌐cnica o Normativa |
| :--- | :--- | :--- | :--- |
| **DEC-01** | SeparaciA|n conceptual de TrÃmite, Expediente, Documento y Asiento. | `[PROPUESTO]` | Previene la sobrecarga de datos en una sola entidad y asegura escalabilidad bajo el Modelo de GestiA|n Documental (MGD). |
| **DEC-02** | Propuesta de asientos con correlativo global secuencial. | `[PROPUESTO]` | El Libro de Registro certifica el flujo general de toda la entidad y no debe reiniciarse por cada expediente individual. |
| **DEC-03** | GeneraciA|n de correlativos mediante secuencias nativas de PostgreSQL (`SEQUENCE`). | `[PROPUESTO]` | Elimina problemas de colisiA|n por concurrencia provocados por consultas manuales del tipo `MAX + 1`. |
| **DEC-04** | PreservaciA|n de registros anulados mediante anulaciA|n lA|gica (`anulado = true` + motivo). | `[PROPUESTO]` | Garantiza auditorA¡a e inmutabilidad legal exigida por la normativa administrativa pA║blica. |
| **DEC-05** | No duplicaciA|n de entidades de personas ni unidades orgÃnicas. | `[CONFIRMADO]` | Arquitectura modular: consumo de identificadores de los Grupos 4 (usuarios) y 3 (Ãreas). |
| **DEC-06** | Estructura visible de expediente `EXP-[AAæO]-[CORRELATIVO 6 DAìGITOS]`. | `[PROPUESTO]` | Formato de trabajo representativo sujeto a la directiva que determine la instituciA|n. |
| **DEC-07** | Periodicidad del reinicio de correlativo del Libro de Registros. | `[PENDIENTE]` | Debe validarse con el profesor si el correlativo se reinicia el 1 de enero o si es histA|rico continuo. |
| **DEC-08** | ImplementaciA|n obligatoria de firma digital criptogrÃfica (X.509). | `[PENDIENTE]` | Pendiente definir si el sistema exigirÃ certificado digital o validarÃ mediante firma escaneada y hash de verificaciA|n. |
| **DEC-09** | RepresentaciA|n del solicitante externo sin credenciales mediante registro asistido en el Grupo 4. | `[PROPUESTO]` | Garantiza que todo administrado pueda tramitar sin crear cuenta, conservando la integridad referencial de `fk_remitente`. |

---

## 10. InvestigaciA|n de Buenas PrÃcticas de GestiA|n Documental

### 10.1 Ley N┬║ 27444 — LPAG
* **Fuente exacta:** Ley N┬║ 27444, Ley del Procedimiento Administrativo General (publicada el 11/04/2001). **Texto AÜnico Ordenado vigente:** aprobado por **Decreto Supremo N┬║ 006-2026-JUS**, publicado en el Diario Oficial El Peruano el **30/04/2026**, que compila y sistematiza las modificaciones a la Ley (entre ellas el DL N┬║ 1452, el DL N┬║ 1497 y el DL N┬║ 1561) y **deroga** el TUO anterior (DS N┬║ 004-2019-JUS).
  * *Enlace oficial:* https://www.gob.pe/institucion/minjus/normas-legales/8169463-006-2026-jus
  * *ExplicaciA|n con palabras propias:* Esta norma rige el funcionamiento administrativo del Estado. Sus principios (TA¡tulo Preliminar: **legalidad 1.1, debido procedimiento 1.2 y celeridad 1.9**) exigen que toda recepciA|n documental sea registrada en estricto orden de llegada y que se entregue un cargo con fecha y hora cierta al administrado. Dispone que si una solicitud carece de requisitos formales, la instituciA|n no puede rechazarla de plano; debe conceder un plazo (habitualmente 48 horas / 2 dA¡as hÃbiles) para que el administrado subsane la omisiA|n antes de declarar el abandono. Estas reglas sustentan los flujos de las secciones 4 a 8 y la numeraciA|n global del Libro de Registro.
### 10.2 Modelo de GestiA|n Documental (MGD) — Presidencia del Consejo de Ministros (PCM / SEGDI)
* *Fuente exacta:* **Modelo de GestiA|n Documental**, aprobado por **ResoluciA|n de SecretarA¡a de Gobierno Digital N┬║ 001-2017-PCM/SEGDI**, publicada en El Peruano el **09/08/2017**, en el marco del Decreto Legislativo N┬║ 1310 (artA¡culo 8: interconexiA|n de los sistemas de trÃmite documentario). Su artA¡culo 4 fue modificado por la **R.S. N┬║ 003-2018-PCM/SEGDI** (21/09/2018), que designa al ComitA⌐ de Gobierno Digital como Responsable Directivo de su implementaciA|n.
  * *Enlace oficial:* https://www.gob.pe/institucion/pcm/normas-legales/292301-001-2017-pcm-segdi
  * *ExplicaciA|n con palabras propias:* Es el marco normativo peruano que define la digitalizaciA|n documental pA║blica. Exige dividir el ciclo documental en **recepciA|n, emisiA|n, despacho, seguimiento y archivo**, manteniendo expedientes electrA|nicos A¡ntegros, foliados digitalmente e inalterables. SeA▒ala que los asientos registrales no pueden modificarse una vez generados, debiendo implementarse pistas de auditorA¡a que garanticen autenticidad e integridad.

### 10.3 Directivas Institucionales de TrÃmite Documentario
  * *SituaciA|n de la fuente:* Este anÃlisis aA║n no identifica la entidad anfitriona del SIGD (ver ┬º11 y el plan de trabajo del Grupo 2), por lo que **no corresponde fijar todavA¡a el nA║mero exacto de la directiva interna**. Su identificaciA|n queda como actividad pendiente de coordinaciA|n con la instituciA|n; no se citarÃ un documento institucional sin su denominaciA|n y fecha verificadas.
  * *Anclas normativas verificables que la sustentan mientras tanto:*
    * ArtA¡culo 8 del **Decreto Legislativo N┬║ 1310**: interconexiA|n de los sistemas de trÃmite documentario de las entidades de la AdministraciA|n PA║blica (base normativa del MGD).
    * ArtA¡culo 38 del **TUO de la Ley N┬║ 27444** (DS N┬║ 006-2026-JUS): aprobaciA|n y difusiA|n del TUPA, instrumento que fija requisitos, plazos y tasas de cada procedimiento atendido por Mesa de Partes.
    * **Reglamento de OrganizaciA|n y Funciones (ROF)** de la entidad: regula quA⌐ unidad orgÃnica emite la directiva de trÃmite documentario y aprueba la apertura anual de los Libros de Registros.
  * *ExplicaciA|n con palabras propias:* Las directivas internas regulan la apertura anual de los Libros de Registros, fijan las atribuciones para autorizar cierres o reasignaciones de expedientes y dictaminan que toda correcciA|n por error material deba asentarse mediante notas marginales o nuevos asientos rectificatorios, quedando prohibido eliminar fA¡sicamente registros del sistema. Hasta que la entidad sea definida, estas reglas se respaldan en las anclas normativas indicadas arriba.

---

## 11. Preguntas Oficiales para DefiniciA|n Institucional (┬º10 del Plan)

1. ┬'QuA⌐ diferencia oficial existe entre trÃmite, expediente, documento presentado y asiento del libro de registro? `[PENDIENTE]`
2. ┬'Un trÃmite crea siempre un expediente y un A║nico nA║mero de registro, o pueden existir otras cardinalidades? `[PENDIENTE]`
3. ┬'El cA|digo de trÃmite y el cA|digo de expediente son el mismo dato? ┬'QuA⌐ formato y longitud deben tener? `[PENDIENTE]`
4. ┬'El nA║mero de registro se reinicia por aA▒o, libro, sede o Ãrea, y quiA⌐n estÃ autorizado para generarlo? `[PENDIENTE]`
5. ┬'El destinatario inicial serÃ un usuario, un Ãrea, una oficina o una combinaciA|n de ellos? `[PENDIENTE]`
6. ┬'QuA⌐ estados oficiales existen y quA⌐ operaciones se permiten despuA⌐s del cierre, anulaciA|n o archivamiento? `[PENDIENTE]`
7. ┬'CA|mo se corrige un asiento equivocado sin perder el historial ni reutilizar su nA║mero? `[PENDIENTE]`
8. ┬'QuA⌐ informaciA|n pasa a trazabilidad y quA⌐ debe ocurrir si faltan documentos o requisitos del trÃmite? `[PENDIENTE]`
9. ┬'El solicitante externo debe registrarse previamente como usuario, o basta con capturar sus datos al momento de la recepciA|n en Mesa de Partes? `[PENDIENTE]`
