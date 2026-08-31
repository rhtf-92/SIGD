# PLAN DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES
## Grupo 4 “IdentiCore” · Usuarios Internos y Externos

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Líder General:** Geric · `B_GERIC` | **Sublíder:** Segundo · `B_SEGUNDO`  
**Integrantes:** Segundo (`B_SEGUNDO`), Tapullima (`B_TAPULLIMA`), Jair (`B_JAIR`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 (Fase 2 — Modelo Polimórfico, Seguridad Argon2id y Casilla Digital)  
**Ubicación:** `backend/docs/levantamiento_de_observaciones/04_plan_levantamiento_observaciones_grupo_4_identicore.md`

---

## 1. Objetivo del Levantamiento de Observaciones

Subsanar las observaciones arquitecturales identificadas en el diagnóstico senior, implementando un **Modelo Polimórfico de Personas** que diferencie Personas Naturales de Personas Jurídicas y gestione **Representantes Legales** (SUNARP), elevando el estándar de seguridad en credenciales a **Argon2id** con tokens JWT asimétricos (RS256) y sesiones controladas, e incorporando la gestión de la **Casilla Electrónica** bajo el marco estricto de la **Ley N° 29733 (Protección de Datos Personales)** con ofuscación en consultas públicas.

---

## 2. Alcance Específico de las Mejoras

1. **Modelo Polimórfico de Identidad (Personas y Representaciones):**
   - `sigd_auth.persona`: Entidad base abstracta con datos comunes (email, teléfono, dirección, tipo_persona).
   - `sigd_auth.persona_natural`: DNI/CE/Pasaporte, nombres, apellidos, fecha de nacimiento, sexo.
   - `sigd_auth.persona_juridica`: RUC (11 dígitos), razón social, nombre comercial, partida registral SUNARP.
   - `sigd_auth.representacion_legal`: Vincula una persona natural apoderada a una persona jurídica con vigencia de poder.
2. **Seguridad y Criptografía de Credenciales:**
   - Estandarizar el almacenamiento de claves con **Argon2id** (memory: 64MB, iterations: 3, parallelism: 4).
   - Tabla `sigd_auth.sesion_usuario` para gestionar Refresh Tokens rotativos con detección de reuso, control de expiración y auditoría de IP/User-Agent.
   - Mecanismo de bloqueo temporal de cuenta tras 5 intentos fallidos consecutivos de autenticación.
3. **Casilla Electrónica y Cumplimiento de la Ley N° 29733:**
   - Tabla `sigd_auth.consentimiento_datos` con registro de fecha, IP, versión de términos de servicio y aceptación explícita de notificaciones electrónicas.
   - Política de ofuscación de datos personales sensibles en endpoints públicos de consulta de trámites (`71****23`, `j****@gmail.com`).

---

## 3. Límites y Criterios de Validación

- No se realizarán consultas activas a servicios con costo (Reniec PIDE / SUNAT) en esta etapa; se implementarán adaptadores simulados (*Mock Services*) que validen la estructura y checksum de DNI/RUC.
- Ninguna contraseña o refresh token en texto plano podrá figurar en logs, respuestas de API o base de datos.
- Toda decisión técnica se etiquetará según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 4. Organización del Equipo y Ramas Git

| Integrante | Rama Personal | Rol / Responsabilidad en Levantamiento | Entregable Principal |
| :--- | :--- | :--- | :--- |
| **Segundo** | `B_SEGUNDO` | Sublíder e Implementador SQL | DDL `sigd_auth`, tablas de sesiones, consentimiento y validaciones. |
| **Tapullima** | `B_TAPULLIMA` | Analista Funcional | Especificación de personas naturales/jurídicas, casilla digital y Ley 29733. |
| **Jair** | `B_JAIR` | Modelador de Datos | Modelo lógico v2.0, diccionario de datos y diagramas Draw.io/PNG. |

---

## 5. Responsabilidades Individuales Detalladas

### Tapullima (`B_TAPULLIMA`)
- Redactar `01_analisis_identidad_personas_seguridad.md` documentando:
  - Clasificación tripartita de usuarios: Internos, Externos Registrados (con Casilla) y Externos Ventanilla.
  - Flujo de validación de representación legal para trámites de empresas e instituciones.
  - Requerimientos legales de la Ley N° 29733 para el consentimiento de notificaciones digitales y ofuscación pública.

### Jair (`B_JAIR`)
- Diseñar `02_modelo_datos_identicore_v2.md` y `02_diccionario_datos_identicore_v2.md` con las entidades `persona`, `persona_natural`, `persona_juridica`, `representacion_legal`, `cuenta_usuario`, `sesion_usuario` y `consentimiento_datos`.
- Actualizar el archivo Draw.io editable y generar la imagen PNG.

### Segundo (`B_SEGUNDO`)
- Implementar `03_esquema_sigd_auth_v2.sql` en PostgreSQL 18 con:
  - Restricciones `CHECK` para formato de DNI (8 dígitos), RUC (11 dígitos empezando en 10, 15, 17, 20) y emails válidos.
  - Índices únicos sobre números de documento y correos electrónicos.
  - Control de estados de cuenta (`ACTIVA`, `BLOQUEADA_TEMPORAL`, `INACTIVA`).
- Ejecutar la suite `04_validacion_identicore_v2.md` con pruebas de registro de persona natural, persona jurídica con representante, autenticación y expiración de sesiones.
- Redactar `05_decisiones_levantamiento_identicore.md` y consolidar en `B_SEGUNDO`.

---

## 6. Cronograma de Trabajo (Sprint de 2 Semanas)

| Hito | Actividad | Responsable | Plazo |
| :---: | :--- | :---: | :---: |
| **H1** | Análisis de Modelo Polimórfico, Seguridad y Ley 29733 | Tapullima | Días 1 - 4 |
| **H2** | Modelo Lógico v2.0, Diccionario y Diagrama Draw.io | Jair | Días 5 - 7 |
| **H3** | DDL SQL con Tablas de Identidad, Sesiones y Restricciones | Segundo | Días 8 - 10 |
| **H4** | Validación Técnica de Autenticación y Restricciones de DNI/RUC | Segundo | Días 11 - 12 |
| **H5** | Integración en `B_SEGUNDO` y PR hacia `B_GERIC` | Segundo | Días 13 - 14 |

---

## 7. Dependencias y Contratos con Otros Grupos

- **Grupo 2 (TramiCore):** IdentiCore provee `id_persona` para asignar al solicitante del trámite o titular del expediente.
- **Grupo 1 (RutaDoc):** IdentiCore provee `id_usuario` para registrar al funcionario que ejecuta el movimiento de derivación/atención.
- **Grupo 3 (OrganiCore):** IdentiCore vincula `id_usuario` a las asignaciones de cargo y roles institucionales.

---

## 8. LISTA DE VERIFICACIÓN PARA LA ENTREGA DEL LEVANTAMIENTO DE OBSERVACIONES

| Estado | Criterio de Verificación Técnico y Metodológico | Responsable | Evidencia Requerida |
| :---: | :--- | :---: | :--- |
| ☐ | El modelo separa limpiamente Personas Naturales de Personas Jurídicas e implementa `representacion_legal`. | Tapullima / Jair | `01_analisis...md` y `02_modelo...md` |
| ☐ | Se implementan validaciones de formato estricto para DNI (8 dígitos) y RUC (11 dígitos válidos). | Segundo | Restricciones `CHECK` en `03_esquema...sql` |
| ☐ | El esquema define el algoritmo de credenciales como **Argon2id** y modela `sesion_usuario` con Refresh Tokens. | Segundo | Diccionario y DDL SQL |
| ☐ | Se modela la entidad `consentimiento_datos` para registrar la aceptación de términos bajo la Ley N° 29733. | Tapullima / Jair | `02_modelo_datos...md` y DDL SQL |
| ☐ | Se documentan reglas de ofuscación de datos personales sensibles para consultas públicas en ventanilla/web. | Tapullima | Matriz de privacidad en `01_analisis...md` |
| ☐ | Diagrama ER actualizado en Draw.io y exportado a imagen PNG. | Jair | Archivos `.drawio` y `.png` |
| ☐ | Decisiones técnicas fundamentadas en el log de decisiones de IdentiCore. | Segundo | `05_decisiones_levantamiento_identicore.md` |
| ☐ | Commits individuales verificables en `B_TAPULLIMA`, `B_JAIR` y `B_SEGUNDO`. | Todos | Historial de Git |
| ☐ | Sublíder integró formalmente mediante Pull Request hacia `B_GERIC`. | Segundo | PR en GitHub |

---

## 9. Resultado Esperado

Al finalizar este plan, el Grupo 4 entregará una arquitectura de identidad robusta, capaz de atender tanto a ciudadanos individuales como a personas jurídicas con sus representantes acreditados, garantizando máxima seguridad en credenciales y pleno cumplimiento de la ley de protección de datos personales.

| Líder General Backend | Sublíder Responsable IdentiCore | Fecha de Conformidad |
| :---: | :---: | :---: |
| **Geric** · `B_GERIC` | **Segundo** · `B_SEGUNDO` | Pendiente de Revisión |
