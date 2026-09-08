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
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (tablas `persona`, `persona_natural`, `persona_juridica`, `representacion_legal`)

### 1.2 Seguridad de Credenciales con Argon2id
- **Decisión:** Estandarizar almacenamiento de credenciales con Argon2id (memory: 64MB, iterations: 3, parallelism: 4).
- **Justificación:** Argon2id es ganador de la Password Hashing Competition (PHC) y recomendado por NIST para protección contra ataques de fuerza bruta y side-channel.
- **Nivel:** CONFIRMADO
- **Evidencia:** Documentado en `04_validacion_identicore_v2.md` y comentarios en `03_esquema_sigd_auth_v2.sql`

### 1.3 Gestión de Sesiones con Refresh Tokens
- **Decisión:** Implementar tabla `sesion_usuario` para gestionar refresh tokens rotativos con detección de reuso, control de expiración y auditoría de IP/User-Agent.
- **Justificación:** Mejora seguridad frente a sesiones simples con JWT; permite revocación específica y detección de compromiso de credenciales.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (tabla `sesion_usuario`) y `04_validacion_identicore_v2.md` (Caso 2.4)

### 1.4 Cumplimiento de Ley N° 29733 (Protección de Datos)
- **Decisión:** Implementar tabla `consentimiento_datos` para registrar fecha, IP, versión de TOS y aceptación explícita de notificaciones digitales y ofuscación pública.
- **Justificación:** Ley N° 29733 requiere consentimiento libre, informado, expreso e inequívoco para tratamiento de datos personales.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (tabla `consentimiento_datos`) y `04_validacion_identicore_v2.md` (Caso 2.5)

### 1.5 Restricciones de Formato de Documentos
- **Decisión:** Aplicar CHECK constraints para validar formato de DNI (8 dígitos) y RUC (11 dígitos iniciando en 10, 15, 17, 20).
- **Justificación:** Previene entrada de datos inválidos en la capa de base de datos, reduciendo carga de validación en aplicación.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (restricciones `chk_persona_natural_dni_format` y `chk_persona_juridica_ruc_format`)

### 1.6 Mecanismo de Bloqueo de Cuenta
- **Decisión:** Implementar bloqueo temporal de cuenta tras 5 intentos fallidos consecutivos de autenticación.
- **Justificación:** Balance entre usabilidad y seguridad; estándar de la industria para protección contra ataques de fuerza bruta.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (columnas `intentos_fallidos`, `bloqueado_hasta`) y `04_validacion_identicore_v2.md` (Caso 2.6)

### 1.7 Política de Ofuscación de Datos Personales
- **Decisión:** Aplicar ofuscación automática en endpoints públicos de consulta de trámites cuando el usuario consiente (`consentimiento_obfuscacion = TRUE`).
- **Formato:** 
  - DNI: `71****23` (primeros 2 y últimos 2 dígitos)
  - RUC: `20123****` (primeros 4 y últimos 4 dígitos)
  - Email: `j****@gmail.com` (primer carácter + dominio)
- **Justificación:** Protege privacidad en consultas públicas manteniendo trazabilidad interna completa.
- **Nivel:** CONFIRMADO
- **Evidencia:** `01_analisis_identidad_personas_seguridad.md` (Matriz de Privacidad)

### 1.8 Conservación Histórica y Baja Lógica
- **Decisión:** Utilizar `ON DELETE RESTRICT` en claves foráneas y baja lógica por campo `estado` en lugar de eliminación física.
- **Justificación:** Preserva trazabilidad histórica requerida para auditoría y cumplimiento normativo.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (FK con `ON DELETE RESTRICT`, campos `estado` en todas las tablas)

### 1.9 Identificador Técnico Interno vs Documento Visible
- **Decisión:** Nunca usar documento de identidad como clave primaria técnica; usar `BIGSERIAL` interno (`id`) para referencias.
- **Justificación:** Evita problemas cuando documentos cambian (matrimonio, corrección) y protege privacidad al no exponer datos sensibles en URLs/logs.
- **Nivel:** CONFIRMADO
- **Evidencia:** `03_esquema_sigd_auth_v2.sql` (PK = `id`, nunca `numero_documento` como PK)

---

## 2. Supuestos Validados

| ID | Supuesto | Validación | Estado |
|---|---|---|---|
| SU-01 | Existe catálogo de tipos de documento (`tipos_documento`) | Confirmado con tipos DNI, CE, PAS | CONFIRMADO |
| SU-02 | Usuario externo puede intervenir sin cuenta (ventanilla) | Validado con `condicion_registro = SIN_CUENTA` | CONFIRMADO |
| SU-03 | Áreas, cargos, roles permanecen en OrganiCore | Referencias conceptuales establecidas | CONFIRMADO |
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
| Seguridad Argon2id en credenciales | ✅ COMPLETADO | `password_hash` con especificación Argon2id |
| Tabla `sesion_usuario` con refresh tokens | ✅ COMPLETADO | Incluye IP/User-Agent, control expiración |
| CHECK DNI (8 dígitos) | ✅ COMPLETADO | Restricción `chk_persona_natural_dni_format` |
| CHECK RUC (11 dígitos, inicia 10/15/17/20) | ✅ COMPLETADO | Restricción `chk_persona_juridica_ruc_format` |
| Entidad `consentimiento_datos` (Ley 29733) | ✅ COMPLETADO | Fecha, IP, versión TOS, aceptaciones |
| Bloqueo cuenta tras 5 intentos fallidos | ✅ COMPLETADO | Campos `intentos_fallidos`, `bloqueado_hasta` |
| Ofuscación de datos sensibles | ✅ DOCUMENTADO | En `01_analisis...md` (pendiente implementación en API) |
| Conservación histórica (ON DELETE RESTRICT) | ✅ COMPLETADO | En todas las FK del esquema |
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