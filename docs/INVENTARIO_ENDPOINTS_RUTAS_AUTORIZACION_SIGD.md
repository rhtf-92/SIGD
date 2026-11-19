# INVENTARIO EXHAUSTIVO Y MATRIZ DE AUTORIZACIÓN DE ENDPOINTS (SIGD RENATO)
## INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO «SUIZA» — PUCALLPA, UCAYALI
### RAMA OFICIAL EXCLUSIVA: `B_JACOBO` | AUDITORÍA: NOVIEMBRE 2026

---

## 1. RESUMEN Y CONCILIACIÓN DE ENDPOINTS

| Métrica de Endpoints | Cantidad Auditada | Detalle / Justificación |
| :--- | :---: | :--- |
| **Total Endpoints Registrados en Router Express** | **169** | Extraídos directamente desde `app.router.stack` |
| **Endpoints de Acceso Público** | **31** | Detallados nominalmente con sus reglas específicas |
| **Endpoints Protegidos** | **138** | Sujetos a autenticación, RBAC contextual o titularidad |

### Conciliación de la Discrepancia Previa (18 vs 19 vs 20 endpoints públicos):
Al desglosar exhaustivamente cada ruta registrada en el router Express se evidencia que:
1. `/api/v1/auth/activar-cuenta` cuenta con **dos métodos HTTP independientes**: `GET` (validación de token OTP de correo) y `POST` (establecimiento de contraseña y activación formal de la cuenta).
2. El catálogo geográfico Ubigeo cuenta con **5 endpoints públicos** (`departamentos`, `provincias`, `distritos`, `distritos-ucayali` y `detalle/:codigo`).
3. Radicación pública expone `/tramites/publico/catalogo-tupa-2026`, `/tramites/publico/consultar-cut` y `/tramite/radicacion`.
4. TramiCore expone además `/tramites/catalogo-tupa-2026` y `/tramites/consulta-publica/:cut`.
5. DocuCore expone el validador CVD público: `/api/v1/validador/cvd/:codigo`.
6. Sondas de infraestructura SRE: `/health` y `/ready`.
7. Autenticación y registro ciudadano: `/auth/login`, `/auth/registro-ciudadano`, `/auth/registro-persona-juridica`, `/auth/validar-documento`, `/auth/reenviar-verificacion`, `/auth/verificacion-contacto/iniciar`, `/auth/verificacion-contacto/confirmar`.

---

## 2. DIFERENCIACIÓN CONCEPTUAL DE MECANISMOS DE AUTORIZACIÓN

El sistema SIGD Suiza no utiliza un único middleware ni una verificación plana de permisos:

1. **Autenticación Pura:** Valida firma JWT y no-expiración (`/auth/refresh`, `/auth/logout`, `/realtime/stream`).
2. **Autorización RBAC Contextual (Política B + DEC-25):** Valida la vigencia activa del contexto (`claims.ctx`) contra PostgreSQL. Si fue retirado, emite `403 CONTEXT_REVOKED`. Evalúa ámbito de área jerárquica para expedientes y derivaciones.
3. **Autorización por Titularidad de Cuenta:** Acceso concedido únicamente si el `id_persona` coincide con el destinatario o titular (Casilla Electrónica, Radicación Virtual, Devoluciones).
4. **Autorización Legal Especial (Facultades de Despacho):** Comprueba titularidad legal de cargo de despacho (DIRECTOR, ADMINISTRADOR o suplencias en `sigd_org.facultad_despacho`).

---

## 3. TABLA DE ENDPOINTS PÚBLICOS (31)

| N.° | Método | Ruta Completa | Dominio | Middleware de Entrada | Regla de Autorización |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/v1/auth/activar-cuenta` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 2 | `POST` | `/api/v1/auth/activar-cuenta` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 3 | `POST` | `/api/v1/auth/login` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 4 | `POST` | `/api/v1/auth/reenviar-verificacion` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 5 | `POST` | `/api/v1/auth/registro-ciudadano` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 6 | `POST` | `/api/v1/auth/registro-persona-juridica` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 7 | `GET` | `/api/v1/auth/validar-documento` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 8 | `POST` | `/api/v1/auth/verificacion-contacto/confirmar` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 9 | `POST` | `/api/v1/auth/verificacion-contacto/iniciar` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 10 | `POST` | `/api/v1/tramite/radicacion` | Root / Monitoreo | Público | Validación Criptográfica Algorítmica CVD |
| 11 | `GET` | `/api/v1/tramites/catalogo-tupa-2026` | TramiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 12 | `GET` | `/api/v1/tramites/consulta-publica/:cut` | TramiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 13 | `POST` | `/api/v1/tramites/publico/carga` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 14 | `GET` | `/api/v1/tramites/publico/cargo` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 15 | `POST` | `/api/v1/tramites/publico/expedientes/:id/orden-pago` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 16 | `POST` | `/api/v1/tramites/publico/ordenes` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 17 | `GET` | `/api/v1/tramites/publico/ordenes/:id` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 18 | `GET` | `/api/v1/tramites/publico/ordenes/:id/recibo` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 19 | `GET` | `/api/v1/tramites/publico/ordenes/:id/recibos` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 20 | `GET` | `/api/v1/tramites/publico/procedimientos` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 21 | `POST` | `/api/v1/tramites/publico/radicar` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 22 | `POST` | `/api/v1/tramites/publico/reto` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 23 | `POST` | `/api/v1/tramites/publico/sesion` | TramiCore (Público) | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 24 | `GET` | `/api/v1/ubigeo/departamentos` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 25 | `GET` | `/api/v1/ubigeo/detalle/:codigo` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 26 | `GET` | `/api/v1/ubigeo/distritos` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 27 | `GET` | `/api/v1/ubigeo/distritos-ucayali` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 28 | `GET` | `/api/v1/ubigeo/provincias` | IdentiCore | Público (Sin autenticación) / Rate Limited | Acceso abierto / Validación de identidad / Consulta pública |
| 29 | `GET` | `/api/v1/validador/cvd/:codigo` | DocuCore | Público (verificadorCvd) | Validación Criptográfica Algorítmica CVD |
| 30 | `GET` | `/health` | Root / Monitoreo | Público (SRE) | Disponibilidad de infraestructura |
| 31 | `GET` | `/ready` | Root / Monitoreo | Público (SRE) | Disponibilidad de infraestructura |

---

## 4. TABLA DE ENDPOINTS PROTEGIDOS (138)

| N.° | Método | Ruta Completa | Dominio | Middleware de Auth | Permiso Requerido | Contexto | Ámbito | Regla de Autorización |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | `POST` | `/api/accion-admin` | Referencia / Smoke Tests | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 2 | `POST` | `/api/areas` | Referencia / Smoke Tests | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 3 | `POST` | `/api/expedientes` | Referencia / Smoke Tests | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 4 | `POST` | `/api/expedientes/derivar` | Referencia / Smoke Tests | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 5 | `GET` | `/api/falla-critica` | Referencia / Smoke Tests | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 6 | `GET` | `/api/protegido` | Referencia / Smoke Tests | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 7 | `GET` | `/api/v1/admin/auditoria/bitacora` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 8 | `GET` | `/api/v1/admin/calendario-laboral` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 9 | `POST` | `/api/v1/admin/calendario-laboral/feriado-excepcional` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 10 | `GET` | `/api/v1/admin/calendario/feriados` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 11 | `GET` | `/api/v1/admin/maestras/sede` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 12 | `GET` | `/api/v1/admin/maestras/tipo-documento` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 13 | `GET` | `/api/v1/admin/organigrama` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 14 | `GET` | `/api/v1/admin/organigrama/arbol` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 15 | `POST` | `/api/v1/admin/organigrama/areas` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 16 | `PUT` | `/api/v1/admin/organigrama/areas/:id` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 17 | `GET` | `/api/v1/admin/roles-permisos` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 18 | `PUT` | `/api/v1/admin/roles/:id/permisos` | OrganiCore | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí | Global | RBAC Administrativo |
| 19 | `GET` | `/api/v1/admin/tablas-maestras` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 20 | `GET` | `/api/v1/admin/tupa/auditoria` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 21 | `GET` | `/api/v1/admin/tupa/versiones` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 22 | `POST` | `/api/v1/admin/tupa/versiones` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 23 | `PUT` | `/api/v1/admin/tupa/versiones/:codigoVersion` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 24 | `POST` | `/api/v1/admin/tupa/versiones/:codigoVersion/publicar` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 25 | `GET` | `/api/v1/admin/tupa/versiones/:codigoVersion/tramites` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 26 | `PUT` | `/api/v1/admin/tupa/versiones/:codigoVersion/tramites/:codigo/requisitos` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 27 | `PUT` | `/api/v1/admin/tupa/versiones/:codigoVersion/tramites/:codigo/unidades` | OrganiCore (Maestras) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 28 | `GET` | `/api/v1/admin/usuarios/` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 29 | `POST` | `/api/v1/admin/usuarios/` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 30 | `DELETE` | `/api/v1/admin/usuarios/:id` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 31 | `GET` | `/api/v1/admin/usuarios/:id` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 32 | `PUT` | `/api/v1/admin/usuarios/:id` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 33 | `POST` | `/api/v1/admin/usuarios/:id/capacidades` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 34 | `DELETE` | `/api/v1/admin/usuarios/:id/capacidades/:usuarioCapacidadId` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 35 | `POST` | `/api/v1/admin/usuarios/:id/restablecer-credenciales` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 36 | `POST` | `/api/v1/admin/usuarios/:id/roles` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 37 | `DELETE` | `/api/v1/admin/usuarios/:id/roles/:usuarioRolId` | OrganiCore (Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 38 | `GET` | `/api/v1/auth/contextos` | IdentiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 39 | `POST` | `/api/v1/auth/logout` | IdentiCore | Bearer Token | Identidad autenticada | No | Sesión | Revocación en sigd_auth.sesion_usuario |
| 40 | `GET` | `/api/v1/auth/me` | IdentiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 41 | `GET` | `/api/v1/auth/perfil` | IdentiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 42 | `POST` | `/api/v1/auth/refresh` | IdentiCore | Bearer Refresh Token | Sesión activa en sigd_auth.sesion_usuario | Hereda contexto previo | Sesión de Dispositivo | Rotación atómica de Refresh Token |
| 43 | `GET` | `/api/v1/auth/registro-capacidades` | IdentiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 44 | `POST` | `/api/v1/auth/seleccionar-contexto` | IdentiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 45 | `GET` | `/api/v1/casilla/bandeja` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 46 | `GET` | `/api/v1/casilla/estadisticas` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 47 | `GET` | `/api/v1/casilla/notificaciones` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 48 | `GET` | `/api/v1/casilla/notificaciones/:id` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 49 | `POST` | `/api/v1/casilla/notificaciones/:id/acuse` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 50 | `GET` | `/api/v1/casilla/notificaciones/:id/acuse/descargar` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 51 | `GET` | `/api/v1/casilla/notificaciones/:id/documento/descargar` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 52 | `PATCH` | `/api/v1/casilla/notificaciones/:id/lectura` | Casilla Electrónica | Router Casilla (auth.guard.ts) | CASILLA_LEER o Rol CIUDADANO | Identidad de cuenta | Titular / Propietario | Autorización por Titularidad (destinatario del acto) |
| 53 | `GET` | `/api/v1/expedientes` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 54 | `GET` | `/api/v1/expedientes/:id` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 55 | `POST` | `/api/v1/expedientes/:id/documentos` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 56 | `GET` | `/api/v1/expedientes/:id/foliacion` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 57 | `POST` | `/api/v1/expedientes/:id/foliar-documento` | DocuCore (AGN) | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 58 | `POST` | `/api/v1/expedientes/:id/revertir-actuacion` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 59 | `GET` | `/api/v1/expedientes/:id/sla-status` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 60 | `GET` | `/api/v1/expedientes/:id/trazabilidad` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 61 | `GET` | `/api/v1/expedientes/clasificador-ccd` | RutaDoc | JWT Actor Provider (jwtActorProvider) | EXPEDIENTE_LEER / RECEPCIONAR / DERIVAR / FOLIAR | Sí (Obligatorio) | Área del Contexto | RBAC Contextual por Ámbito de Unidad Orgánica |
| 62 | `POST` | `/api/v1/firma/callback-refirma` | DocuCore (AGN) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 63 | `POST` | `/api/v1/firma/callback-refirma/:sesionId` | DocuCore (Firma Digital) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 64 | `GET` | `/api/v1/firma/documento/:documentoId` | DocuCore (Firma Digital) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 65 | `GET` | `/api/v1/firma/documento/:documentoId/estado` | DocuCore (Firma Digital) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 66 | `POST` | `/api/v1/firma/invocar-refirma` | DocuCore (Firma Digital) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 67 | `GET` | `/api/v1/firma/pendientes` | DocuCore (Cola Firmas) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 68 | `GET` | `/api/v1/firmas/cola-firmantes` | Root / Monitoreo | exigirAdministracionUsuarios(pool) | Ninguno | No | N/A | Validación Criptográfica Algorítmica CVD |
| 69 | `GET` | `/api/v1/firmas/pendientes` | DocuCore (Alias Cola Firmas) | crearFirmaRouter / verificarFacultadFirma | DIRECTOR / ADMINISTRADOR / Facultad Despacho | Sí | Institucional | Autorización Legal de Firma (Art. 5 Reglamento de Firmas) |
| 70 | `GET` | `/api/v1/realtime/stream` | CoreLink (SSE Realtime) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 71 | `GET` | `/api/v1/reportes/dashboard-ejecutivo` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 72 | `GET` | `/api/v1/reportes/dashboard/cuellos-botella` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 73 | `GET` | `/api/v1/reportes/dashboard/kpis` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 74 | `GET` | `/api/v1/reportes/dashboard/resumen` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 75 | `GET` | `/api/v1/reportes/dashboard/tendencias` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 76 | `GET` | `/api/v1/reportes/tiempos-atencion` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 77 | `GET` | `/api/v1/reportes/vistas-materializadas/refresh` | CoreLink (Reportes) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 78 | `GET` | `/api/v1/resoluciones/` | DocuCore (Resoluciones) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 79 | `POST` | `/api/v1/resoluciones/` | DocuCore (Resoluciones) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 80 | `GET` | `/api/v1/resoluciones/:id` | DocuCore (Resoluciones) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 81 | `POST` | `/api/v1/resoluciones/proyectar` | DocuCore (Resoluciones) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 82 | `GET` | `/api/v1/resoluciones/proyectos/:id` | DocuCore (Resoluciones) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 83 | `PUT` | `/api/v1/roles/:id/permisos` | Root / Monitoreo | exigirAdministracionUsuarios(pool) | Ninguno | No | N/A | Validación Criptográfica Algorítmica CVD |
| 84 | `POST` | `/api/v1/storage/confirmar-carga` | DocuCore (Storage) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 85 | `GET` | `/api/v1/storage/documentos/:id/download` | DocuCore (Storage) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 86 | `GET` | `/api/v1/storage/download/:bucket/:key` | DocuCore (Storage) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 87 | `POST` | `/api/v1/storage/presigned-url` | DocuCore (Storage) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 88 | `GET` | `/api/v1/tesoreria/caja` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 89 | `POST` | `/api/v1/tesoreria/caja` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 90 | `POST` | `/api/v1/tesoreria/caja/:id/cierre` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 91 | `GET` | `/api/v1/tesoreria/capacidades` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 92 | `GET` | `/api/v1/tesoreria/catalogo` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 93 | `POST` | `/api/v1/tesoreria/devoluciones` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 94 | `GET` | `/api/v1/tesoreria/devoluciones/:id/constancia` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 95 | `POST` | `/api/v1/tesoreria/devoluciones/:id/revision` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 96 | `POST` | `/api/v1/tesoreria/documentos` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 97 | `GET` | `/api/v1/tesoreria/documentos/:id` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 98 | `GET` | `/api/v1/tesoreria/movimientos` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 99 | `GET` | `/api/v1/tesoreria/ordenes` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 100 | `POST` | `/api/v1/tesoreria/ordenes` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 101 | `GET` | `/api/v1/tesoreria/ordenes/:id` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 102 | `POST` | `/api/v1/tesoreria/ordenes/:id/pagos-adicionales/advertencia` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 103 | `POST` | `/api/v1/tesoreria/ordenes/:id/pagos-adicionales/confirmar` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 104 | `POST` | `/api/v1/tesoreria/ordenes/:id/subsanaciones` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 105 | `POST` | `/api/v1/tesoreria/pagos` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 106 | `POST` | `/api/v1/tesoreria/pagos/:id/revision` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 107 | `POST` | `/api/v1/tesoreria/pagos/efectivo` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 108 | `GET` | `/api/v1/tesoreria/reportes` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 109 | `GET` | `/api/v1/tesoreria/tarifas` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 110 | `POST` | `/api/v1/tesoreria/tarifas` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 111 | `POST` | `/api/v1/tesoreria/tarifas/:id/validar` | Tesorería | Router Tesorería (líneas 21-33) | TESORERIA_* (Rol TESORERO) / Titular Orden | Sí (403 CONTEXT_REVOKED) | Caja / Global | RBAC Operativo + Bloqueo transaccional FOR SHARE en usuario_rol |
| 112 | `POST` | `/api/v1/tramites/:expedienteId/orden-pago` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 113 | `POST` | `/api/v1/tramites/analizar-pdf` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 114 | `GET` | `/api/v1/tramites/devoluciones` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 115 | `GET` | `/api/v1/tramites/devoluciones/:id/documentos/:documentoId` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 116 | `POST` | `/api/v1/tramites/devoluciones/:id/revision` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 117 | `GET` | `/api/v1/tramites/mis-expedientes` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 118 | `POST` | `/api/v1/tramites/mis-expedientes/solicitar-vinculacion` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 119 | `GET` | `/api/v1/tramites/mis-expedientes/solicitudes-vinculacion` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 120 | `POST` | `/api/v1/tramites/radicacion-virtual` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 121 | `GET` | `/api/v1/tramites/tipos` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 122 | `GET` | `/api/v1/tramites/tipos/:id/documentacion,/tramites/procedimientos/:id/documentacion` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 123 | `GET` | `/api/v1/tramites/tupa` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 124 | `POST` | `/api/v1/tramites/ventanilla-presencial` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 125 | `GET` | `/api/v1/tramites/ventanilla/cargo/:cut` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 126 | `POST` | `/api/v1/tramites/vinculaciones/:id/resolver` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 127 | `GET` | `/api/v1/tramites/vinculaciones/pendientes` | TramiCore | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
| 128 | `GET` | `/api/v1/usuarios/` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 129 | `POST` | `/api/v1/usuarios/` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 130 | `DELETE` | `/api/v1/usuarios/:id` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 131 | `GET` | `/api/v1/usuarios/:id` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 132 | `PUT` | `/api/v1/usuarios/:id` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 133 | `POST` | `/api/v1/usuarios/:id/capacidades` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 134 | `DELETE` | `/api/v1/usuarios/:id/capacidades/:usuarioCapacidadId` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 135 | `POST` | `/api/v1/usuarios/:id/restablecer-credenciales` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 136 | `POST` | `/api/v1/usuarios/:id/roles` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 137 | `DELETE` | `/api/v1/usuarios/:id/roles/:usuarioRolId` | OrganiCore (Alias Usuarios) | exigirAdministracionUsuarios(pool) | ADMIN_USUARIOS | Sí (403 CONTEXT_REVOKED) | Global | RBAC Contextual Administrativo |
| 138 | `GET` | `/api/v1/validador-cvd/verificar/:cvd` | DocuCore (AGN) | Bearer Access Token (jwtActorProvider) | Autenticación / Rol Vigente | Sí (ctx claim) | Área / Global | RBAC Contextual (403 CONTEXT_REVOKED ante contexto inactivo) |
