# INFORME DE AUDITORÍA Y CORRECCIÓN DEL ACCESO INICIAL, AUTENTICACIÓN Y VISIBILIDAD DE MÓDULOS

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de pruebas/demo:** `sigd_jacobo_demo` (17 expedientes activos)  
**Base institucional protegida:** `sigd_prueba` (2 expedientes históricos intactos — REGLA CERO TOQUES)  
**Servicios activos:** Backend `http://127.0.0.1:3008` (PID 3548), Frontend `http://127.0.0.1:5178` (PID 6400)  
**Fecha:** 28 de octubre de 2026  
**Estado:** APROBADO Y CONCILIADO AL 100%

---

## 1. RESUMEN EJECUTIVO

Se ejecutó la auditoría forense y técnica para determinar la causa por la cual, al acceder a la raíz del frontend (`http://127.0.0.1:5178/`), se visualizaban simultáneamente módulos de gestión interna, una tarjeta de «Iniciar Sesión» y el botón institucional de «Cerrar sesión» en la cabecera.

Tras la investigación, se demostró que el fenómeno respondía a una **doble causa desacoplada**:
1. **Persistencia de sesión en localStorage**: Una sesión previa válida persistía en `localStorage['sigd_auth']`, activando en `HeaderInstitucional.tsx` el estado `isAuthenticated: true` y desplegando los accesos y el botón «Cerrar sesión».
2. **Definición estática de tarjetas en `HomePage.tsx`**: La página de inicio contenía una lista rígida y fija de 9 tarjetas («secciones») que no consultaba el almacén de autenticación (`useAuthStore`), presentando incondicionalmente a todos los visitantes tanto portales ciudadanos, la tarjeta de «Iniciar Sesión», como enlaces a «Panel de Administración», «Bandeja de Expedientes» y «Reportes y Tableros de Control».

Se implementó una corrección mínima, limpia y estrictamente desacoplada que respeta al 100% la arquitectura del prototipo `B_JACOBO`, sin alterar contratos de API, DTOs, esquemas de PostgreSQL ni variables de entorno. Las 4 suites de pruebas unitarias (37 pruebas), la suite de autenticación (12 pruebas), la matriz live HTTP RBAC (49 pruebas) y las pruebas visuales E2E con Playwright (6 roles canónicos) arrojaron un 100% de aprobación.

---

## 2. RESPUESTAS FORENSES A LAS PREGUNTAS A - H

### Pregunta A: ¿La ruta raíz `/` es pública o privada en `AppRouter.tsx`?
- **Dictamen:** La ruta `/` es **completamente PÚBLICA**.
- **Evidencia en código:** En `frontend/src/router/AppRouter.tsx` está declarada directamente como `<Route path="/" element={<HomePage />} />`, sin estar envuelta por `<ProtectedRoute>` ni requerir tokens. Su propósito institucional es servir de portal de bienvenida y punto de entrada para los ciudadanos y la comunidad del IESTP Suiza.

### Pregunta B: ¿Por qué aparecía la tarjeta «Iniciar Sesión» en el cuerpo de la página?
- **Dictamen:** Por existir una **definición estática e incondicional** en el componente.
- **Evidencia en código:** En `frontend/src/pages/HomePage.tsx` el array `secciones` estaba codificado de forma estática con 9 elementos. Uno de ellos era:
  ```typescript
  {
    titulo: "Iniciar Sesión",
    subtitulo: "Acceso Institucional",
    descripcion: "Ingreso al sistema SIGD con credenciales...",
    ruta: "/login",
  }
  ```
  El componente no leía el estado `isAuthenticated` del almacén ni evaluaba si ya existía una sesión activa.

### Pregunta C: ¿Por qué aparecía el botón «Cerrar sesión» en la cabecera?
- **Dictamen:** Por **rehidratación legítima de credenciales almacenadas**.
- **Evidencia en código:** `authStore.ts` utiliza el middleware `persist` de Zustand bajo la clave `localStorage['sigd_auth']`. Al abrir el navegador, `useAuthStore` rehidrata la sesión con `isAuthenticated: true`, nombre del usuario y rol (por ejemplo, `ADMINISTRADOR`). En `HeaderInstitucional.tsx`, la presencia de dicho estado renderiza de inmediato el bloque de usuario y el botón «Cerrar sesión».

### Pregunta D: ¿Cómo interactúan `HeaderInstitucional` y `HomePage` respecto a la autenticación?
- **Dictamen:** Existía un **desacoplamiento total y contradictorio**.
- **Evidencia:** `HeaderInstitucional.tsx` es un componente plenamente reactivo y sensible a roles (`useAuthStore`), adaptando sus enlaces y mostrando el botón de cierre según las facultades reales del usuario. Por el contrario, `HomePage.tsx` era un componente ciego a la sesión, renderizando siempre la misma plantilla sin sincronizarse con el estado de autenticación.

### Pregunta E: ¿Qué sucede al refrescar la página con token válido o expirado?
- **Dictamen:**
  - **Con token válido:** El estado persistía en `localStorage`, la cabecera se mostraba autenticada y la página de inicio continuaba mostrando la tarjeta estática de login.
  - **Con token expirado:** Como `HomePage` no realizaba llamadas al backend, el interceptor de Axios (401) nunca se disparaba en la raíz. El usuario permanecía con una "sesión fantasma" visual hasta que navegaba a una ruta privada protegida.
- **Solución implementada:** Se integró en `authStore` la acción `verificarSesion()`, la cual es invocada de forma controlada al montar `HomePage` (`GET /api/v1/auth/me`). Si el token expiró y no es renovable, el interceptor 401 ejecuta `logout()` y limpia el almacenamiento de forma transparente.

### Pregunta F: ¿Qué módulos institucionales se mostraban y por qué?
- **Dictamen:** En la cabecera se mostraban únicamente los módulos autorizados para el rol persistido (gracias a `tienePermiso()` y `roles.includes()`). Sin embargo, en la cuadrícula de `HomePage` se mostraban indiscriminadamente módulos internos («Panel de Administración», «Bandeja de Expedientes», «Reportes») debido a la lista fija original, sin comprobar autorización.

### Pregunta G: ¿Qué protección tienen las rutas internas y qué ocurre si un no autenticado hace clic en una tarjeta interna?
- **Dictamen:** Doble barrera de seguridad activa (Frontend + Backend).
  - **Frontend:** En `AppRouter.tsx`, las rutas internas (`/administracion`, `/expedientes`, `/reportes`, `/flujo-validez-legal/firma`) están protegidas por `<ProtectedRoute rolesPermitidos={[...]}>`. Si un visitante anónimo o usuario no autorizado hace clic en ellas, es redirigido de inmediato a `/login` preservando la ruta solicitada en `state.from`.
  - **Backend:** Todas las rutas de API correspondientes están custodiadas por `authGuard` y `requerirRol / requerirPermiso`. Cualquier solicitud HTTP no autorizada retorna `401 Unauthorized` o `403 Forbidden`.

### Pregunta H: ¿Qué ocurre al cerrar sesión si el servidor responde 200 o si falla la conexión?
- **Dictamen:** El transporte de cierre de sesión es seguro y resiliente.
  - **Servidor disponible (200 OK):** Se envía `POST /api/v1/auth/logout` con el `refreshToken`, el backend revoca la sesión en base de datos (`sigd_auth.sesion_usuario`) y Redis, y el frontend limpia `accessToken`, `refreshToken`, `usuario`, `localStorage` y redirige a `/login`.
  - **Servidor inaccesible / Error de red:** El método `cerrarSesion()` en `authStore` captura la contingencia en su bloque de cierre y ejecuta la limpieza local estricta (`logout()`), impidiendo que el operador quede atrapado en una sesión huérfana.

---

## 3. CAUSA RAÍZ Y DIAGNÓSTICO ESTRUCTURAL

El comportamiento no constituía una falla de seguridad en el backend ni una fuga de privilegios, sino una **inconsistencia en la presentación visual de la página de inicio pública**:

```
[ Navegador ] ── Abre "/" ──> AppRouter (Ruta Pública)
      │
      ├──> HeaderInstitucional.tsx ──> Lee useAuthStore (Sesión válida persistida) 
      │                                 └─> Muestra "Cerrar sesión" y usuario activo
      │
      └──> HomePage.tsx (Original) ──> Ignora useAuthStore
                                        └─> Renderiza lista estática con 9 tarjetas:
                                            - "Iniciar Sesión" (redundante/confuso)
                                            - Módulos privados visibles a anónimos
```

---

## 4. ARCHIVOS INSPECCIONADOS Y ARCHIVOS MODIFICADOS

### Archivos Inspeccionados:
- `frontend/src/router/AppRouter.tsx`
- `frontend/src/components/HeaderInstitucional.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/api/client.ts`
- `backend/src/core/auth/auth.guard.ts`
- `backend/src/domains/identicore/auth.router.ts`

### Archivos Modificados:
1. `frontend/src/pages/HomePage.tsx`:
   - Integración con `useAuthStore` para leer `isAuthenticated` y `usuario`.
   - Lógica de segregación en dos escenarios visuales:
     - **Modo Anónimo (no autenticado):** Muestra exclusivamente 6 portales ciudadanos/públicos (`Mesa de Partes Virtual`, `Casilla Electrónica`, `Consulta de Trámite`, `Validador CVD`, `Registro Ciudadano` y la tarjeta `Iniciar Sesión`). Se excluyen completamente módulos de gestión interna.
     - **Modo Autenticado:** Suprime la tarjeta «Iniciar Sesión». Muestra un banner de sesión activa con nombre y badge de rol. Renderiza dinámica y exclusivamente los módulos permitidos para el rol canónico detectado.
     - Validación en un solo paso (`useEffect` en montaje) de la vigencia del token vía `verificarSesion()`.
2. `frontend/src/stores/authStore.ts`:
   - Adición del método `verificarSesion: () => Promise<void>` en la interfaz `AuthState`.
   - Consulta `GET /api/v1/auth/me` para sincronizar roles y facultades vigentes, delegando al interceptor 401 la revocación en caso de expiración.
   - Refinamiento de `setToken` y sincronización con `localStorage` (`sigd_roles`, `sigd_facultades`).
3. `frontend/tests/unit/pages/HomePage.test.tsx` (Nuevo):
   - Suite completa con 7 escenarios de prueba que certifican la visibilidad exacta para anónimos y cada uno de los 6 roles canónicos institucionales.
4. `scratch/e2e_runner/roles_visual_e2e.spec.ts`:
   - Estabilización del flujo de cierre de sesión en Playwright añadiendo `await page.waitForURL('**/login')` antes de la navegación siguiente, eliminando condiciones de carrera y advertencias `net::ERR_ABORTED`.

---

## 5. MATRIZ DE VISIBILIDAD DE MÓDULOS EN `HomePage`

| Módulo / Portal | Ruta | Anónimo | CIUDADANO | MESA_PARTES | ESPECIALISTA | SECRETARIO | DIRECTOR | ADMINISTRADOR |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Mesa de Partes Virtual** | `/tramite` | **SÍ** | **SÍ** | **SÍ** | NO | NO | NO | NO |
| **Casilla Electrónica** | `/casilla` | **SÍ** | **SÍ** | NO | NO | NO | NO | NO |
| **Consulta de Trámite** | `/consulta-tramite` | **SÍ** | **SÍ** | NO | NO | NO | NO | NO |
| **Validador CVD** | `/validador-cvd` | **SÍ** | **SÍ** | **SÍ** | **SÍ** | **SÍ** | **SÍ** | **SÍ** |
| **Registro Ciudadano** | `/registro` | **SÍ** | **SÍ** | NO | NO | NO | NO | NO |
| **Iniciar Sesión** | `/login` | **SÍ** | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** |
| **Ventanilla Presencial** | `/ventanilla` | **NO** | **NO** | **SÍ** | NO | NO | NO | NO |
| **Bandeja de Expedientes** | `/expedientes` | **NO** | **NO** | **SÍ** | **SÍ** | **SÍ** | **SÍ** | **SÍ** |
| **Firma Digital Protocolar** | `/flujo-validez-legal/firma` | **NO** | **NO** | NO | NO | NO | **SÍ** | **NO** |
| **Proyector de Resoluciones** | `/flujo-validez-legal/resoluciones` | **NO** | **NO** | NO | **SÍ** | **SÍ** | NO | **SÍ** |
| **Panel de Administración** | `/administracion` | **NO** | **NO** | NO | NO | NO | NO | **SÍ** |
| **Reportes y Tableros** | `/reportes/dashboard` | **NO** | **NO** | NO | NO | NO | **SÍ** | **SÍ** |

---

## 6. RESULTADOS DE LA EJECUCIÓN DE PRUEBAS

### 6.1. Pruebas Unitarias del Frontend (Vitest)
```
 ✓ tests/unit/hooks/rbacRolesCanonicos.test.ts (4 tests) 376ms
 ✓ tests/unit/components/HeaderInstitucional.test.tsx (12 tests) 792ms
 ✓ tests/unit/pages/HomePage.test.tsx (7 tests) 981ms
 ✓ tests/unit/pages/LoginPage.test.tsx (14 tests) 9915ms
 ✓ tests/unit/api/authentication401.test.ts (12 tests) 148ms

 TOTAL PRUEBAS FRONTEND: 49 aprobadas | 0 fallidas (100% PASS)
```

### 6.2. Pruebas E2E Visuales con Playwright (`roles_visual_e2e.spec.ts`)
```
  ok 1 › 1. Rol ADMINISTRADOR: login, identidad, navegación institucional, bloqueo y logout limpio (9.1s)
  ok 2 › 2. Rol DIRECTOR: despacho, firma digital, reportes, bloqueo y logout limpio (7.6s)
  ok 3 › 3. Rol SECRETARIO: resoluciones, bandeja, bloqueo de firma/admin y logout limpio (7.6s)
  ok 4 › 4. Rol ESPECIALISTA: proyector técnico, bandeja, aislamiento estricto y logout limpio (8.6s)
  ok 5 › 5. Rol MESA_PARTES: ventanilla presencial, bandeja, bloqueo de despacho y logout limpio (8.2s)
  ok 6 › 6. Rol CIUDADANO: casilla electrónica, nuevo trámite, bloqueo de módulos internos y logout limpio (9.5s)

  6 passed (53.5s)
```

### 6.3. Auditoría Live HTTP RBAC (`scratch/audit_matriz_completa_roles.mjs`)
```
========================================================================================
TOTAL CASOS PROBADOS: 49 | APROBADOS: 49 | FALLIDOS: 0 (100% PASS)
========================================================================================
```

### 6.4. Verificación de Compilación y Tipos (`tsc --noEmit`)
- **Frontend (`sigd-frontend`):** `tsc --noEmit` completado con código de salida 0 (0 errores).
- **Backend (`sigd-backend`):** `tsc --noEmit` completado con código de salida 0 (0 errores).

---

## 7. GARANTÍA DE CERO TOQUES EN BASE DE DATOS INSTITUCIONAL

- Se verificó mediante consulta directa en PostgreSQL sobre `sigd_prueba`:
  ```sql
  SELECT count(*) FROM sigd_doc.expediente;
  -- Resultado: 2 registros intactos (EXP-2026-000001, EXP-2026-000002)
  -- Sin operaciones DDL ni DML aplicadas.
  ```
- Toda la ejecución dinámica y las pruebas E2E interactuaron exclusivamente con la base de datos de desarrollo `sigd_jacobo_demo` (17 expedientes).

---

## 8. CONCLUSIÓN Y DECLARACIÓN DE ACEPTACIÓN TÉCNICA

La inconsistencia visual reportada ha quedado **completamente subsanada y blindada**. La pantalla inicial `HomePage` ahora respeta rigurosamente el estado de sesión y los privilegios de los 6 roles canónicos del IESTP Suiza 2026, eliminando ambigüedades entre los portales públicos y los módulos institucionales protegidos.

El prototipo `B_JACOBO` se declara en estado **ESTABLE, COHERENTE Y LISTO PARA ENTREGA**.
