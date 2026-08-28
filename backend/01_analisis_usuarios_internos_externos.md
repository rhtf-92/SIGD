# Análisis Funcional: Usuarios del SIGD

**Rol:** Analista Funcional | **Responsable:** Tapullima Navarro  
**Archivo:** `01_analisis_usuarios_internos_externos.md`

---

## 1. Objetivo y Alcance
Definir los tipos de usuarios, sus datos clave, reglas de acceso y casos especiales para estructurar la base de datos del SIGD.

---

## 2. Clasificación de Usuarios

| Tipo de Usuario | Autenticación | Funciones Principales |
| :--- | :--- | :--- |
| **Interno** (Personal del instituto) | Credenciales / SSO | Tramita, firma, deriva y archiva documentos. |
| **Externo Registrado** (Ciudadano/Empresa) | Correo + Clave / OTP | Envía documentos oficiales y ve su historial. |
| **Externo No Registrado** (Público) | Sin login (Usa código) | Consulta el estado de sus trámites. |

---

## 3. Matriz de Datos Principales
* **Tipo / N° Documento:** DNI, CE, RUC, Pasaporte (Único por usuario).
* **Nombres / Razón Social:** Identidad de la persona o empresa.
* **Correo Electrónico:** Canal de notificaciones y clave de acceso.
* **Estado:** `Activo`, `Inactivo` o `Bloqueado`.

---

## 4. Flujos Principales
1. **Registro:** El usuario ingresa sus datos → El sistema valida que no existan → Se activa la cuenta por correo.
2. **Actualización:** El usuario edita sus datos → Confirma con un código → El sistema guarda la fecha del cambio.
3. **Baja de Personal:** RRHH solicita el cese → Admin bloquea el acceso → El sistema reasigna sus trámites al jefe directo.

---

## 5. Casos Excepcionales
* **Documento Duplicado:** Bloquea el registro y sugiere recuperar clave.
* **Datos Incompletos:** No permite enviar trámites hasta completarlos.
* **Cuenta Inactiva:** Deniega el ingreso y muestra un mensaje de soporte.

---

## 6. Buenas Prácticas y Fuentes
* Uso de **Mínimo Privilegio (PoLP)**, **SSO** y **Auditoría de cambios**.
* **Fuentes:** OWASP Access Control Cheat Sheet y Gobierno Digital (PCM Perú).

---

## 7. Preguntas Pendientes (Profesor)
1. ¿Validaremos DNI y RUC directamente con RENIEC y SUNAT?
2. ¿Qué documento usarán los extranjeros sin DNI ni CE?
3. ¿Se usará Active Directory/LDAP para crear las cuentas del personal?