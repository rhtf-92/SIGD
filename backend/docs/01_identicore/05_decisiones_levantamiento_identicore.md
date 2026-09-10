# Decisiones Técnicas del Levantamiento de Observaciones — Módulo IdentiCore v2.0

**Responsable:** Segundo (`B_SEGUNDO`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 — Modelo Polimórfico, Argon2id, Ley 29733  
**Estado:** BORRADOR — PENDIENTE DE VALIDACIÓN  

---

## 1. Decisiones Arquitectónicas Implementadas

### 1.1 Modelo Polimórfico de Identidad
- **Decisión:** Implementar modelo con entidad base `persona` y extensiones `persona_natural`/`persona_juridica`.
- **Justificación:** Permite separar claramente datos comunes (email, teléfono, dirección) de específicos (DNI/RUC, nombres/apellidos, razón social).
- **Nivel:** PROPUESTO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (tablas `persona`, `persona_natural`, `persona_juridica`, `representacion_legal`). El SQL actual NO garantiza especialización exclusiva 1:1 (una persona puede quedar sin extensión o con dos); la garantía total/exclusiva requiere lógica transaccional PENDIENTE de decisión del grupo.

### 1.2 Almacenamiento de Credenciales Compatible con Argon2id
- **Decisión:** Definir campo `password_hash` en tabla `cuenta_usuario` para almacenar hashes de contraseñas con parámetros Argon2id (memory: 64MB, iterations: 3, parallelism: 4).
- **Justificación:** Argon2id es ganador de la Password Hashing Competition (PHC) y recomendado por NIST para protección contra ataques de fuerza bruta y side-channel. La estructura de la base de datos permite el almacenamiento de hashes Argon2id.
- **Nivel:** PROPUESTO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (campo `password_hash` en `cuenta_usuario`) y `04_validacion_identicore_v2.md` (Caso 2.4). Los parámetros Argon2id están documentados pero no existen procedimientos o triggers que los apliquen.

### 1.3 Gestión de Sesiones con Refresh Tokens (Almacenamiento)
- **Decisión:** Implementar tabla `sesion_usuario` para almacenar refresh tokens con control de expiración y auditoría de IP/User-Agent.
- **Justificación:** Permite el registro de sesiones activas y facilita la trazabilidad de accesos. La rotación, revocación y detección de reuso de tokens no están implementadas en la capa de base de datos.
- **Nivel:** PROPUESTO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (tabla `sesion_usuario`) y `04_validacion_identicore_v2.md` (Caso 2.4). Solo se verifica longitud del token y existencia de campos de auditoría.

### 1.4 Cumplimiento de Ley N° 29733 (Protección de Datos)
- **Decisión:** Implementar tabla `consentimiento_datos` para registrar fecha, IP, versión de TOS y aceptación explícita de notificaciones digitales y ofuscación pública.
- **Justificación:** Ley N° 29733 requiere consentimiento libre, informado, expreso e inequívoco para tratamiento de datos personales. La tabla y sus restricciones existen y están implementadas. El cumplimiento jurídico completo requiere validación adicional por el área legal.
- **Nivel:** PROPUESTO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (tabla `consentimiento_datos`) y `04_validacion_identicore_v2.md` (Caso 2.5). La existencia de la tabla y sus restricciones está verificada; el cumplimiento integral de Ley N° 29733 requiere validación por el área legal.

### 1.5 Restricciones de Formato de Documentos
- **Decisión:** Aplicar CHECK constraints para validar formato de DNI (8 dígitos) y RUC (11 dígitos iniciando en 10, 15, 17, 20).
- **Justificación:** Previene entrada de datos inválidos en la capa de base de datos, reduciendo carga de validación en aplicación. La validación de RUC verifica longitud y prefijos permitidos, pero NO incluye validación del dígito verificador oficial.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (restricciones `chk_persona_natural_dni_format` y `chk_persona_ruc_format`)

### 1.6 Mecanismo de Bloqueo de Cuenta
- **Decisión:** Definir campos `intentos_fallidos` (SMALLINT) y `bloqueado_hasta` (TIMESTAMPTZ) en tabla `cuenta_usuario` para implementar bloqueo temporal de cuenta.
- **Justificación:** Proporciona la estructura necesaria para bloquear cuentas automáticamente tras 5 intentos fallidos. La lógica de negocio (5 intentos → 15 min bloqueo) se implementa en la capa de aplicación, no en la base de datos.
- **Nivel:** PROPUESTO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (columnas `intentos_fallidos`, `bloqueado_hasta`) y `04_validacion_identicore_v2.md` (Caso 2.6). La lógica de negocio (5 intentos → 15 min bloqueo) se implementa en la capa de aplicación, no en la base de datos.

### 1.7 Política de Ofuscación de Datos Personales
- **Decisión:** Definir campo `consentimiento_obfuscacion` (BOOLEAN) en tabla `consentimiento_datos` para indicar consentimiento de ofuscación en consultas públicas (implementación pendiente en capa de aplicación).
- **Formato:**
  - DNI: `71****23` (primeros 2 y últimos 2 dígitos)
  - RUC: `20123****` (primeros 4 y últimos 4 dígitos)
  - Email: `j****@gmail.com` (primer carácter + dominio)
- **Justificación:** Protege privacidad en consultas públicas manteniendo trazabilidad interna completa.
- **Nivel:** PROPUESTO
- **Evidencia:** `01_analisis_identidad_personas_seguridad.md` (Matriz de Privacidad). La ofuscación en endpoints públicos está documentada pero no implementada en capa de aplicación.

### 1.8 Conservación Histórica y Baja Lógica
- **Decisión:** Utilizar `ON DELETE RESTRICT` en claves foráneas y baja lógica por campo `estado` en lugar de eliminación física.
- **Justificación:** Preserva trazabilidad histórica requerida para auditoría y cumplimiento normativo. Se aplica `ON DELETE RESTRICT` en la mayoría de las FK; la tabla `perfil_usuario` usa `ON DELETE SET NULL` como excepción para `cuenta_usuario_id`.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (FK con `ON DELETE RESTRICT` y excepción `ON DELETE SET NULL` en `perfil_usuario`). Campos `estado` presentes en todas las tablas principales.

### 1.9 Identificador Técnico Interno vs Documento Visible
- **Decisión:** Nunca usar documento de identidad como clave primaria técnica; usar `BIGSERIAL` interno (`id`) para referencias.
- **Justificación:** Evita problemas cuando documentos cambian (matrimonio, corrección) y protege privacidad al no exponer datos sensibles en URLs/logs.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (PK = `id`, nunca `numero_documento` como PK)

---

## Dependencias y Contratos con Otros Grupos

### Grupo 3 — OrganiCore
IdentiCore depende de OrganiCore para las siguientes entidades referenciadas conceptualmente en `perfil_usuario`:

- **`areas.id`** (áreas institucionales)
- **`cargos.id`** (cargos específicos)
- **`roles.id`** (roles/permisos institucionales)

**Contrato pendiente:**
- OrganiCore debe proporcionar diseño definitivo de tablas `areas`, `cargos` y `roles`
- IdentiCore requiere acordar identificadores/códigos oficiales que serán referenciados desde `perfil_usuario.area_id`, `perfil_usuario.cargo_id` y `perfil_usuario.rol_id`
- Los vínculos conceptuales (`area_id`, `cargo_id`, `rol_id`) en `perfil_usuario` dependen de estas tablas de OrganiCore

**Evidencia:** En `perfil_usuario` solo existen columnas conceptuales `area_id`, `cargo_id`, `rol_id` (BIGINT, sin constraints FK físicos). Las tablas `areas`, `cargos`, `roles` no existen en IdentiCore. Estado: PENDIENTE de contrato con OrganiCore.

### Grupo 6 — CoreLink
IdentiCore depende de CoreLink para:

- **Validación de existencia de usuarios** sin duplicar datos personales
- **Decisión de identificador técnico:** elegir entre `personas.id` vs `perfil_usuario.id` como identificador interno a consumir

**Contrato pendiente:**
- CoreLink debe definir cómo validará la existencia de usuarios sin violar el principio de separación de IdentiCore
- Debe acordarse qué identificador interno (`personas.id` o `perfil_usuario.id`) será utilizado por otros módulos para trazabilidad
- Debe establecerse mecanismo para evitar duplicación de datos personales en referencias de otros grupos

**Evidencia:** El documento de análisis funcional (`01_analisis_identidad_personas_seguridad.md`) y el modelo de datos (`02_modelo_datos_identicore_v2.md`) mencionan los contratos con TramiCore, RutaDoc, DocuCore y CoreLink, pero los detalles específicos no están definidos.

### Grupo 2 — TramiCore
NO existe evidencia directa de dependencia técnica con TramiCore en los archivos de IdentiCore. La referencia en el modelo de datos (`02_modelo_datos_identicore_v2.md`) menciona "IdentiCore provee `id_persona` para asignar al solicitante del trámite" pero es un contrato de integración genérico, no una dependencia técnica definida en archivos de IdentiCore.

### Otros Grupos
Las referencias conceptuales a otros módulos (RutaDoc, DocuCore) existen pero dependen de acuerdos futuros más detallados que no están documentados actualmente.

### Pendiente de decisión — UUID (modelo/diccionario Jair) vs BIGSERIAL (SQL Segundo)
El modelo `02_modelo_datos_identicore_v2.md` y el diccionario `02_diccionario_datos_identicore_v2.md` usan `UUID`, mientras `03_esquema_sigd_auth_v2.sql` implementa `BIGSERIAL`. No se convierte unilateralmente. Estado: PENDIENTE DE DECISIÓN CON JAIR/GRUPO. El SQL vigente es la referencia de implementación; el modelo queda como referencia conceptual pendiente de alineación.

**Próximos pasos para dependencias:**
1. Reunir con Grupo 3 para definir esquemas de `areas`, `cargos` y `roles`
2. Establecer acuerdo formal con Grupo 6 sobre uso de identificadores
3. Documentar los contratos técnicos finales en el archivo de decisiones
4. Validar que los identificadores acordados sean compatibles con los diseños de módulos conectados

---

## 2. Supuestos Validados

| ID | Supuesto | Validación | Estado |
|---|---|---|---|
| SU-01 | Existe catálogo de tipos de documento (`tipos_documento`) | Confirmado con tipos DNI, CE, PAS | CONFIRMADO |
| SU-02 | Usuario externo puede intervenir sin cuenta (ventanilla) | Validado con `condicion_registro = SIN_CUENTA` | DOCUMENTADO |
| SU-03 | Áreas, cargos, roles permanecen en OrganiCore | Referencias conceptuales establecidas | PENDIENTE DE DEFINICIÓN CON GRUPO 3 |
| SU-04 | Datos de prueba son ficticios | Confirmado en todos los INSERT de ejemplo | CONFIRMADO |
| SU-05 | PostgreSQL 18.6 es referencia | Utilizado en desarrollo y validación | CONFIRMADO |

---

## 3. Preguntas Pendientes (Tras Validación)

1. **Para Grupo 3 (OrganiCore):**
   - ¿Cuál es el diseño definitivo de tablas `areas`, `cargos` y `roles`?
   - ¿Existen códigos oficiales que debemos usar para referencias?

2. **Para Grupo 6 (CoreLink):**
   - ¿Cómo validarán otros módulos la existencia de usuarios sin duplicar datos personales?
   - ¿Qué identificador interno prefieren consumir (`personas.id` vs `perfil_usuario.id`)?

3. **Para Área Legal/Institucional:**
   - ¿Cuál es el formato exacto de RUC que debe validarse (¿solo 10/15/17/20 o hay otros prefijos válidos)?
   - ¿Se requiere validación en tiempo real contra SUNARP para representación legal?
   - ¿Cuál es la política exacta de retención de datos bajo Ley 29733?

4. **Para Equipo de Seguridad:**
   - ¿Se requiere implementar rate limiting en endpoints de autenticación?
   - ¿Se debe agregar logging seguro de intentos de acceso (sin credenciales)?

---

## 4. Estado de Implementación

| Componente | Estado | Evidencia |
|---|---|---|
| Modelo polimórfico (persona, persona_natural, persona_juridica, representacion_legal) | ✅ COMPLETADO | `03_esquema_sigd_auth_v2.sql` |
| Almacenamiento compatible con Argon2id | 🟡 DOCUMENTADO | Campo `password_hash` con especificación Argon2id; generación y validación en capa de aplicación |
| Tabla `sesion_usuario` con almacenamiento de tokens | 🟡 DOCUMENTADO | Incluye IP/User-Agent, control expiración; rotación y detección de reuso pendientes |
| CHECK DNI (8 dígitos) | ✅ COMPLETADO | Restricción `chk_persona_natural_dni_format` |
| CHECK RUC (11 dígitos, inicia 10/15/17/20) | ✅ COMPLETADO | Restricción `chk_persona_ruc_format`; NO valida dígito verificador oficial |
| Entidad `consentimiento_datos` (Ley 29733) | ✅ COMPLETADO | Estructura con restricciones implementada; cumplimiento jurídico requiere validación legal |
| Campos para bloqueo de cuenta | 🟡 DOCUMENTADO | Campos `intentos_fallidos`, `bloqueado_hasta`; lógica de negocio en capa de aplicación |
| Ofuscación de datos sensibles | 🟡 DOCUMENTADO | En `01_analisis...md` (pendiente implementación en API) |
| Conservación histórica (ON DELETE RESTRICT) | ✅ COMPLETADO | Implementado con excepción `ON DELETE SET NULL` en `perfil_usuario` |
| Representación legal (única combinación) | ✅ COMPLETADO | UNIQUE en `(persona_natural_id, persona_juridica_id)`; no es relación estrictamente 1:1 |
| Diagrama ER actualizado | ⏳ PENDIENTE | Requiere actualización de archivo `.drawio` |
| Validación técnica ejecutada | ⏳ PENDIENTE | Requieren ejecución en entorno PostgreSQL |

---

## 5. Próximos Pasos para Integración

1. **Validación Técnica Inmediata:**
   - Ejecutar `03_esquema_sigd_auth_v2.sql` en entorno de desarrollo PostgreSQL 18.6
   - Correr suite de pruebas `04_validacion_identicore_v2.md`
   - Corregir cualquier error de sintaxis o lógica

2. **Documentación Complementaria:**
   - Actualizar diagrama Draw.io con modelo polimórfico v2.0
   - Generar imagen PNG del diagrama actualizado
   - Completar documento de decisiones (`05_decisiones_levantamiento_identicore.md` - ESTE DOCUMENTO)

3. **Integración de Código:**
   - Fusionar cambios en rama `B_SEGUNDO`
   - Crear Pull Request hacia rama `B_GERIC` (Líder General Backend)
   - Resolver conflictos de merge si existen
   - Esperar revisión y aprobación del Líder General

4. **Validación Final:**
   - Presentar resultados al Grupo 4 para validación grupal
   - Obtener conformidad del Líder General Backend (`B_GERIC`)
   - Documentar lecciones aprendidas y mejoras para versión 3.0

---

## 6. Aprobación y Conformidad

Este documento registra las decisiones técnicas tomadas durante el levantamiento de observaciones versión 2.0 por el Grupo 4 IdentiCore.

**Sublíder Responsable:**  
_________________  
Segundo (`B_SEGUNDO`)  
Fecha: _________________

**Validado por Equipo:**  
_________________  
Tapullima (`B_TAPULLIMA`) - Análisis Funcional  
Fecha: _________________

_________________  
Jair (`B_JAIR`) - Modelado de Datos  
Fecha: _________________

**Pendiente de Revisión:**  
_________________  
Geric (`B_GERIC`) - Líder General Backend  
Fecha: _________________

---

*Fin del documento*
