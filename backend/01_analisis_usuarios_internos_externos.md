# 01. Análisis Funcional: Administración de Usuarios - SIGD

**Analista Funcional:** Tapullima  
**Rama:** `B_TAPULLIMA`  
**Estado:** Propuesta Preliminar (Insumo para Modelo de Datos)

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

| Condición | Usuario Interno | Externo Registrado | Externo No Registrado |
| :--- | :--- | :--- | :--- |
| **Vínculo** | Trabajador de la entidad. | Usuario con cuenta digital. | Interacción ocasional en ventanilla. |
| **Acceso SIGD** | Sistema interno (LDAP / Credenciales). | Portal web (Correo + Clave). | Sin usuario (solo código de consulta). |
| **Permisos** | Crear, derivar, firmar y archivar. | Crear trámites y ver su avance. | Ninguno en el sistema. |
| **Persistencia** | Permanente + Historial de área. | Registro en base de datos. | Solo datos adjuntos al documento. |

---

## 3. Matriz Preliminar de Datos (Propuesta)

| Campo Propuesto | Propósito | Origen / Fuente | Pendiente de Confirmar |
| :--- | :--- | :--- | :--- |
| **Tipo/N° Documento** | Identificador único (DNI/CE/RUC). | Formulario / RENIEC | ¿Validación en tiempo real? |
| **Nombres / Razón Social** | Identificación oficial del titular. | Formulario / RENIEC | ¿Formatos de empresas (RUC)? |
| **Correo Electrónico** | Notificaciones y credenciales. | Declarado por usuario | Obligatorio en registrados. |
| **Teléfono** | Contacto ante inconsistencias. | Declarado por usuario | Opcional. |
| **Estado de Cuenta** | Control de acceso (Activo/Inactivo). | Administrador | Transiciones de estado. |

---

## 4. Flujos Principales y Excepciones

### Flujos Normales
1. **Registro Externo:** Ingreso de datos -> Validación de correo/DNI -> Activación de cuenta.
2. **Acceso Interno:** Ingreso de credenciales -> Verificación de área activa -> Acceso a bandeja.
3. **Inactivación:** Solicitud de baja -> Reasignación de pendientes -> Cambio a estado inactivo.

### Casos Excepcionales
* **DNI Duplicado:** **Impedir.** Mostrar mensaje de error y sugerir recuperación de clave.
* **Falla de Verificación:** **Advertir.** Registrar como "Pendiente" exigiendo copia de documento.
* **Baja Laboral:** **Desactivar.** Bloquear acceso al sistema y obligar a transferir documentos asignados.

---

## 5. Preguntas para el Profesor
1. ¿La validación con RENIEC/PIDE será obligatoria en tiempo real desde la primera fase?
2. ¿Los usuarios internos ingresarán con correo institucional o con un usuario propio del sistema?
3. ¿Quién aprueba las cuentas de empresas (RUC): el sistema automáticamente o Mesa de Partes?