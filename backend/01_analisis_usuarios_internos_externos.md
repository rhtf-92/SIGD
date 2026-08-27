# Módulo de Usuarios Internos y Externos · IdentiCore
**Documento:** 01_analisis_usuarios_internos_externos.md  
**Autor:** Tapullima (B_TAPULLIMA)  
**Rol:** Analista Funcional  
**Grupo:** Grupo 4 - IdentiCore  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Fecha:** 27 de agosto de 2026  
**Estado:** Borrador de análisis funcional preliminar  

---

## 1. Objetivo del Módulo y Actores

### 1.1 Objetivo
El objetivo general del módulo **IdentiCore** es definir, modelar e identificar a todas las personas y entidades que interactúan con el Sistema Integral de Gestión Documentaria (SIGD). El módulo diferencia claramente entre **usuarios internos** (quienes poseen un vínculo laboral/institucional) y **usuarios externos** (ciudadanos, organizaciones o proveedores), permitiendo que estos últimos intervengan mediante trámites registrados de manera permanente o eventual.

### 1.2 Actores del Módulo
* **Administrador / Operador del Sistema [PROPUESTO]:** Encargado de registrar, activar, desactivar o actualizar datos de usuarios internos y validar las solicitudes de registro externo.
* **Usuario Interno [CONFIRMADO]:** Servidor o empleado de la institución con un cargo y pertenencia a un área específica. Accede a las funciones internas del SIGD para gestionar expdientes y tramitar solicitudes.
* **Usuario Externo Registrado [PROPUESTO]:** Ciudadano o representante legal que ha creado una cuenta permanente en la mesa de partes virtual para dar seguimiento a sus trámites y recibir notificaciones.
* **Usuario Externo No Registrado [PROPUESTO]:** Persona natural o jurídica que presenta una solicitud o trámite presencial o virtual por única vez sin requerir una cuenta de usuario permanente.

---

## 2. Diferencias Funcionales (Matriz Comparativa)

| Criterio / Condición | Usuario Interno | Usuario Externo Registrado | Usuario Externo No Registrado |
| :--- | :--- | :--- | :--- |
| **Relación Institucional** | Posee vínculo laboral o contrato activo [CONFIRMADO]. | Ninguna relación laboral institucional. | Ninguna relación laboral institucional. |
| **Autenticación / Cuenta** | Requiere cuenta institucional obligatoria [PROPUESTO]. | Posee credenciales de acceso (usuario/clave) [PROPUESTO]. | No posee cuenta ni clave de acceso [PROPUESTO]. |
| **Área y Cargo** | Asociado a un Área y Rol institucional (Grupo 3) [CONFIRMADO]. | No aplica. | No aplica. |
| **Modo de Intervención** | Procesa, deriva, firma y resuelve expedientes [CONFIRMADO]. | Emite trámites, consulta estado y recibe notificaciones [PROPUESTO]. | Registrado como remitente puntual en el expediente [PROPUESTO]. |
| **Persistencia de Datos** | Registro permanente en el sistema. | Registro permanente en la base de usuarios externos. | Registro puntual asociado al documento/expediente [PROPUESTO]. |

---

## 3. Matriz Preliminar de Datos

| Campo / Atributo | Categoría | Justificación / Observación |
| :--- | :--- | :--- |
| `tipo_documento` | [PROPUESTO] | DNI, CE, RUC, Pasaporte. Debe permitir flexibilidad. |
| `numero_documento` | [PROPUESTO] | Número único de identificación. **No se usará como clave primaria técnica.** |
| `nombres` / `apellidos` | [PROPUESTO] | Datos obligatorios para personas naturales. |
| `razon_social` | [PROPUESTO] | Requerido en caso de que el usuario externo sea una persona jurídica (RUC). |
| `correo_electronico` | [PROPUESTO] | Obligatorio para usuarios internos y externos registrados (canal principal de notificación). |
| `telefono_contacto` | [PROPUESTO] | Campo opcional/complementario de contacto. |
| `direccion_fisica` | [PENDIENTE] | Por confirmar si se exige domicilio legal para recepción de notificaciones físicas. |
| `estado_usuario` | [PROPUESTO] | Valores: Activo, Inactivo, Pendiente_Validación, Bloqueado. |
| `id_area` / `id_rol` | [CONFIRMADO] | Referencias conceptuales vinculadas al Grupo 3 (solo para usuarios internos). |

---

## 4. Descripción de Flujos Normales

### Flujo 1: Registro e Identificación de Usuario Interno
* **Entrada:** Datos personales (DNI, Nombres, Correo) + Asignación de Área y Rol (Grupo 3).
* **Validación:** Comprobar que el número de documento y el correo institucional no existan previamente en la base de datos.
* **Resultado:** Usuario creado con estado `ACTIVO` y credenciales iniciales generadas.
* **Responsable:** Administrador del Sistema / RRHH [PROPUESTO].

### Flujo 2: Registro de Usuario Externo con Cuenta
* **Entrada:** Tipo/Número de documento, Nombres/Apellidos, Correo electrónico y Contraseña propuesta.
* **Validación:** Verificación de unicidad del documento y validación de correo por enlace o código.
* **Resultado:** Usuario registrado con estado `PENDIENTE` hasta validar correo, pasando luego a `ACTIVO`.
* **Responsable:** Usuario Externo (Autorregistro) [PROPUESTO].

### Flujo 3: Identificación de Usuario Externo sin Cuenta (Trámite Eventual)
* **Entrada:** Datos de la persona remitente capturados en Mesa de Partes (DNI/RUC, Nombres, Dirección, Correo).
* **Validación:** Consulta rápida para asociar con registros anteriores de personas sin duplicar innecesariamente.
* **Resultado:** Datos personales asociados únicamente al Expediente / Libro de Registro del trámite actual.
* **Responsable:** Operador de Mesa de Partes / Usuario Externo en formulario web [PROPUESTO].

---

## 5. Casos Excepcionales y Reglas de Control

1. **Documento de Identidad Duplicado:**
   * *Regla:* El sistema debe impedir el registro de dos cuentas distintas con el mismo tipo y número de documento.
   * *Acción:* Advertir al usuario u operador y sugerir la recuperación de cuenta o actualización de datos existentes.
2. **Usuario Inactivo o Vínculo Institucional Interrumpido:**
   * *Regla:* Cuando un usuario interno pierde su vínculo laboral, su cuenta pasa a estado `INACTIVO`.
   * *Acción:* Impedir el inicio de sesión y el procesamiento de nuevos expedientes, pero **preservar la trazabilidad e historial** de los trámites que firmó o gestionó en el pasado.
3. **Identidad Incompleta / Datos Inconsistentes:**
   * *Regla:* Trámites presenciales o virtuales con datos insuficientes.
   * *Acción:* El sistema registrará el expediente en estado `OBSERVADO` o marcará la identidad como `NO VERIFICADA` hasta que se completen los requisitos.

---

## 6. Buenas Prácticas y Fuentes Consultadas

* **Separación de Identidad y Cuenta (Pattern Persona-Usuario):** Permite reutilizar la información personal de un ciudadano sin obligarlo a crear una cuenta con contraseña si solo realiza un trámite presencial.
* **Identificadores Técnicos Independientes (Surrogate Keys):** Uso de claves primarias autogeneradas (`id` o `UUID`), manteniendo el DNI/RUC únicamente como un atributo de búsqueda indexado y con restricción `UNIQUE`.
* **Normativa de Identidad Digital:** Principios de verificación y protección de datos personales en plataformas de gobierno digital.

---

## 7. Preguntas Pendientes para Validación con el Profesor

1. ¿Todo usuario interno tendrá obligatoriamente una cuenta registrada en el SIGD?
2. ¿En qué casos un usuario externo deberá registrarse obligatoriamente y en cuáles podrá presentar un trámite sin cuenta?
3. ¿El DNI será obligatorio para todos los trámites o se admitirán otros documentos (Pasaporte, Carné de Extranjería, RUC)?
4. ¿Quién será el rol responsable autorizado para validar, activar o desactivar usuarios en el sistema?
5. ¿Se debe guardar un historial de auditoría de los cambios de datos personales y roles institucionales?