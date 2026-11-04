# Administración SIGD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Administración hub and its six sections persist real data and enforce server-backed authorization on `F_BARTRA`.

**Architecture:** Retain the existing React pages and hooks, align every service with the mounted OrganiCore endpoints, and add focused PostgreSQL-backed API capabilities for assigned operations the server does not yet expose. API guards remain authoritative; frontend role checks improve navigation only. Audit records remain read-only and catalog removal stays logical.

**Tech Stack:** React 19, TypeScript 5.9, Express, PostgreSQL, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-administracion-design.md`

## Global Constraints

- Work only in the existing `F_BARTRA` checkout; preserve pre-existing dirty files.
- Verify current route/schema and authorization before changing each client call.
- Keep the five role codes canonical; fail closed on authorization.
- Audit log is read-only; catalog removal is inactivation; cutoff is 16:30 America/Lima.
- Never show hard-coded example data as live operational state.

## Review Focus

- Direct URL without permission: expect server/route denial and no protected data rendered.
- Empty or failed API response: expect empty/error state instead of seeded sample records.
- Create/update double submission: expect one mutation and refreshed server state.
- Inactivation/unlock failure: expect unchanged data and visible error.
- Invalid calendar date, hour or empty justification: expect validation and no request.

## File Map

- Modify `frontend/src/pages/administracion/*.tsx` and `frontend/src/components/administracion/*` for hub/section workflows.
- Replace sample data and close API gaps in `frontend/src/hooks/useAuditLogs.ts`, `useRbacConfig.ts`, `useTablasMaestras.ts`, `useCalendarioLaboral.ts`, and `useSeguridadPolicies.ts`.
- Align `frontend/src/services/adminUsuariosService.ts`, `frontend/src/types/{usuarioAdmin,rbacRoles,auditoriaForense,tablasMaestras}.ts`, and router guards.
- Add server-side handlers/services/schemas/migrations under `backend/src/domains/organicore/` and `backend/src/core/auth/` only for assigned capabilities absent from `backend/src/app.ts` and current routers.
- Extend `frontend/tests/unit/pages/{AdministracionPage,UsuariosPage}.test.tsx`, `frontend/tests/unit/hooks/rbacRolesCanonicos.test.ts`, add tests beside new hooks/components, and extend matching backend route/service unit suites.

### Task 1: Hub navigation and route authorization

**Files:**
- Modify: `frontend/src/pages/administracion/AdministracionPage.tsx`
- Modify: `frontend/src/routes/AdminRoutes.tsx`
- Modify: `frontend/src/routes/ProtectedRoute.tsx` only as required by active role/permission state.
- Test: `frontend/tests/unit/pages/AdministracionPage.test.tsx`
- Test: `frontend/tests/unit/components/RbacGuard.test.tsx`

- [ ] Assert all six cards route to the correct section and keyboard activation works.
- [ ] Assert anonymous and insufficient-role direct visits are denied; allowed roles retain access.
- [ ] Implement navigation/guard fixes without weakening API authorization.
- [ ] Run focused route/hub tests; expect every card destination and role boundary to match the five canonical roles.

### Task 2: User directory and account mutations

**Files:**
- Modify: `frontend/src/services/adminUsuariosService.ts`
- Modify: `frontend/src/hooks/useUsuariosAdmin.ts`
- Modify: `frontend/src/pages/administracion/UsuariosPage.tsx`
- Modify: `frontend/src/components/administracion/UserCreateModal.tsx`, `UserEditModal.tsx`
- Test: `frontend/tests/unit/pages/UsuariosPage.test.tsx`
- Test: matching `frontend/tests/unit/services/adminUsuariosService.test.ts`

- [ ] Assert pagination/search/area/role/status filters serialize to the live `/api/v1/admin/usuarios` query contract.
- [ ] Assert create/edit/status behavior persists only fields accepted by active backend schemas and refreshes all cached list variants.
- [ ] Assert API validation and conflict errors remain visible and failed optimistic changes roll back.
- [ ] Implement any missing explicit state endpoint only if active service/schema supports the assigned transition; otherwise add a validated server-side operation with permission and audit trail.
- [ ] Run focused users/service tests; expect state to match server after success or failure.

### Task 3: Roles and permissions persistence

**Files:**
- Modify: `frontend/src/hooks/useRbacConfig.ts`
- Modify: `frontend/src/components/administracion/RolePermissionMatrix.tsx`
- Modify: `frontend/src/pages/administracion/RolesPermisosPage.tsx`
- Modify: `backend/src/app.ts` roles-permissions handlers only for validation/authorization defects.
- Test: `frontend/tests/unit/hooks/rbacRolesCanonicos.test.ts`
- Test: matching backend role-permission route suite.

- [ ] Assert the UI maps each of `SUPER_ADMIN`, `DIRECTOR`, `DOCENTE`, `MESA_PARTES`, `ESTUDIANTE` to active backend codes without duplicating role identity.
- [ ] Assert GET populates permissions and PUT persists a change; failed save restores the prior matrix and reports error.
- [ ] Assert unauthorized saves never reach the mutation endpoint.
- [ ] Implement corrections to permission-code mapping and invalidate/refetch role data after persistence.
- [ ] Run focused RBAC tests; expect server state, UI matrix and role routes to agree.

### Task 4: Audit log, filters, detail and CSV

**Files:**
- Modify: `frontend/src/hooks/useAuditLogs.ts`
- Modify: `frontend/src/pages/administracion/AuditoriaPage.tsx`
- Modify: `frontend/src/components/administracion/AuditDetailDrawer.tsx`
- Modify: `backend/src/app.ts` audit handler only to support assigned filters/pagination/detail absent today.
- Test: matching `frontend/tests/unit/hooks/useAuditLogs.test.ts`
- Test: matching `frontend/tests/unit/pages/AuditoriaPage.test.tsx`
- Test: matching backend audit route suite.

- [ ] Assert request uses `/api/v1/admin/auditoria/bitacora`, live paging parameters, and supported filters; seeded example logs are never shown as server results.
- [ ] Assert audit rows remain read-only and CSV escapes commas/quotes/newlines and preserves UTF-8 accents.
- [ ] Assert detail view displays available correlation id and before/after payload only when returned by backend.
- [ ] Implement filter/pagination endpoints only as needed, with read permission and no mutation route.
- [ ] Run focused audit tests; expect filtered results and valid CSV from real DTOs.

### Task 5: Master data and organizational tree

**Files:**
- Modify: `frontend/src/hooks/useTablasMaestras.ts`
- Modify: `frontend/src/pages/administracion/TablasMaestrasPage.tsx`
- Modify: `frontend/src/components/administracion/OrganigramaTreeView.tsx`
- Modify: active `backend/src/domains/organicore/adminMaestras.*` and organigram handlers only for supported assigned create/update gaps.
- Test: matching `frontend/tests/unit/hooks/useTablasMaestras.test.ts`
- Test: matching backend master-data route/service suites.

- [ ] Assert catalog tabs load active/inactive records, search filters the selected table, and organization paths render parent-child hierarchy.
- [ ] Assert create/edit/inactivate call matching endpoints, retain history through `vigente=false`, and refresh data after mutation.
- [ ] Assert unknown catalog and malformed materialized paths return a visible validation/error state.
- [ ] Implement unsupported create/update endpoints only where the active model/table can safely persist them.
- [ ] Run focused table/organigram tests; expect UI records to match PostgreSQL and no physical delete.

### Task 6: Calendar configuration and 16:30 cutoff

**Files:**
- Modify: `frontend/src/hooks/useCalendarioLaboral.ts`
- Modify: `frontend/src/pages/administracion/CalendarioLaboralPage.tsx`
- Modify: `backend/src/domains/organicore/{adminMaestras.routes.ts,adminMaestras.controller.ts,calendario.service.ts}` and add a migration only if durable jornada settings are absent.
- Test: matching frontend calendar hook/page tests.
- Test: matching backend calendar service/route and migration-contract suites.

- [ ] Assert current feriados load, create and logical inactivation use the active endpoint shapes.
- [ ] Assert 16:30 is shown as normative cutoff and invalid start/end/cutoff settings cannot persist.
- [ ] Assert saved working days/hours are reloaded from backend after a successful save.
- [ ] Add a durable, RBAC-protected settings contract and migration if the current calendar stores only holidays; seed compatible values without overwriting user data.
- [ ] Run focused calendar tests; expect persisted settings and feriados after reload.

### Task 7: Security policy, access attempts and supervised unlock

**Files:**
- Modify: `frontend/src/hooks/useSeguridadPolicies.ts`
- Modify: `frontend/src/pages/administracion/SeguridadPage.tsx`
- Modify: `backend/src/domains/organicore/` authentication/admin handlers and add a migration only for assigned policy persistence missing in current schema.
- Test: matching frontend security hook/page tests.
- Test: matching backend auth/security route/service and migration-contract suites.

- [ ] Assert no hard-coded blocked accounts or access attempts are displayed as live data.
- [ ] Assert policy read/save, blocked-account listing and unlock request use authenticated, permission-protected endpoints.
- [ ] Assert unlock requires a non-empty forensic justification and a failed request leaves the account blocked.
- [ ] Implement server validation, audit event, safe unlock semantics and persisted policy only where current auth capabilities lack them; default to five failed attempts, 30-minute lock and 30-minute session.
- [ ] Run focused security tests; expect unauthorized requests denied, successful changes reflected after reload, and audit preserved.

### Task 8: Administration end-to-end integration

**Files:**
- Modify relevant files from Tasks 1–7 only.
- Test: `frontend/tests/unit/pages/AdministracionPage.test.tsx`, `UsuariosPage.test.tsx`, and module-specific tests; matching backend suites.

- [ ] Assert loading, empty, error/retry and success states for each of the six sections.
- [ ] Assert all mutations refresh server-backed state and each route/API operation is protected.
- [ ] Implement final navigation/copy/accessibility integration defects.
- [ ] Run all focused module tests, frontend typecheck and relevant backend suites; expect each assigned section to work against the local Docker/PostgreSQL stack and preserve WORM/logical-delete behavior.
