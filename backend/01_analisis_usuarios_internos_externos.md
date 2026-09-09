# 01. Análisis Funcional v2.0: Administración de Usuarios - SIGD

**Analista Funcional:** Tapullima  
**Rama:** `B_TAPULLIMA`  
**Estado:** Alineado con IdentiCore v2.0 (insumo funcional)

---

## 1. Objetivo y Actores
* **Objetivo:** Definir cómo el SIGD identifica, controla y gestiona los accesos y datos de los usuarios.
* **Actores Principales:**
  * **Administrador:** Gestiona cuentas internas, roles y permisos.
  * **Mesa de Partes:** Valida la identidad de usuarios externos y recepciona trámites.
  * **Servidor Público (Interno):** Emite, deriva, firma y revisa documentos.
  * **Ciudadano / Entidad (Externo):** Crea trámites y realiza seguimiento.

---

## 2. Matriz Comparativa de Usuarios

| Condición | Usuario Interno | Externo Registrado con Casilla Electrónica | Externo No Registrado Atendido en Ventanilla |
| :--- | :--- | :--- | :--- |
| **Vínculo** | Trabajador de la entidad con vínculo y rol vigente en OrganiCore. | Usuario externo con identidad, cuenta, casilla y consentimiento vigentes. | Persona natural o jurídica identificada en el padrón, sin cuenta ni casilla. |
| **Acceso SIGD** | Sistema interno (LDAP / Credenciales). | Portal web (Correo + Clave). | Sin cuenta; atención presencial por Mesa de Partes. |
| **Permisos** | Crear, derivar, firmar y archivar. | Crear trámites y ver su avance. | Ninguno en el sistema. |
| **Persistencia** | Persona, cuenta y vínculo institucional; historial de área en OrganiCore. | Persona, cuenta, casilla y consentimiento versionado. | Registro de persona y atención del trámite; no se crea cuenta automáticamente. |

---

## 3. Matriz Preliminar de Datos (Propuesta)

| Campo Propuesto | Propósito | Origen / Fuente | Pendiente de Confirmar |
| :--- | :--- | :--- | :--- |
| **Tipo/N° Documento** | DNI/CE/Pasaporte para persona natural; RUC para persona jurídica. | Formulario; formato y checksum aplicable. | Validación externa en tiempo real queda fuera de esta fase. |
| **Nombres / Razón Social** | Nombres y apellidos para persona natural; razón social para persona jurídica. | Declarado y acreditado según el canal de atención. | Reglas institucionales de acreditación. |
| **Correo Electrónico** | Notificaciones y credenciales. | Declarado por usuario | Obligatorio en registrados. |
| **Teléfono** | Contacto ante inconsistencias. | Declarado por usuario | Opcional. |
| **Estado de Cuenta** | Control de acceso (Activa/Bloqueada temporal/Inactiva). | Administrador | Transiciones y auditoría. |

---

## 4. Flujos Principales y Excepciones

### Flujos Normales
1. **Registro Externo:** Ingreso de datos -> identificación de persona natural o jurídica -> validación de formato y checksum aplicable -> consentimiento explícito para notificaciones -> activación de cuenta y casilla.
2. **Acceso Interno:** Ingreso de credenciales -> Verificación de área activa -> Acceso a bandeja.
3. **Atención en Ventanilla:** Identificación asistida de la persona -> registro o recuperación en el padrón -> asociación al trámite, sin crear cuenta ni casilla automáticamente.
4. **Trámite de Persona Jurídica:** Identificación de la entidad -> autenticación de la persona natural representante -> verificación de representación legal vigente -> registro del trámite.
5. **Inactivación:** Solicitud de baja -> Reasignación de pendientes -> Cambio a estado inactivo.

### Casos Excepcionales
* **Documento Duplicado:** **Impedir.** Mostrar mensaje de error y sugerir recuperación de acceso o revisión del padrón.
* **Falla de Validación de Formato o Checksum:** **Rechazar.** No activar cuenta ni registrar el documento hasta corregirlo.
* **Representación Vencida o Revocada:** **Rechazar.** No permitir nuevos trámites en nombre de la persona jurídica.
* **Baja Laboral:** **Desactivar.** Bloquear acceso al sistema y obligar a transferir documentos asignados.

---

## 5. Preguntas para el Profesor
1. ¿Se habilitarán consultas externas a RENIEC, SUNAT o SUNARP en una fase posterior? En H1 solo se valida formato/checksum mediante adaptadores simulados.
2. ¿Los usuarios internos ingresarán con correo institucional o con un usuario propio del sistema?
3. ¿Quién aprueba las cuentas de empresas (RUC): el sistema automáticamente o Mesa de Partes?ñ