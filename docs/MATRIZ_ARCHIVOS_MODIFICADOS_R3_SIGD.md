# SIGD RENATO — MATRIZ DE ARCHIVOS MODIFICADOS Y CREADOS EN R3
## TSK-R3 — Inventario Técnico de Cambios Controlados

**Proyecto:** Sistema Integral de Gestión Documentaria — SIGD RENATO.  
**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali.  
**Rama:** `B_JACOBO`.  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.  
**Base de datos:** `sigd_jacobo_demo` (PostgreSQL 18.6).

---

## 1. INVENTARIO DE ARCHIVOS DE CÓDIGO FUENTE (MODIFICADOS)

### 1. `backend/src/domains/rutadoc/evaluadores.service.ts`
- **Líneas afectadas:** 73-75.
- **Cambio realizado:** Eliminación de la cláusula de excepción:
  ```typescript
  // Eliminado:
  if (actor.roles?.includes('ADMINISTRADOR')) return;
  ```
- **Propósito y justificación:** Erradicar el bypass incondicional de asignación/reasignación para el rol `ADMINISTRADOR`. Exigir la validación de los permisos canónicos `EXPEDIENTE_ASIGNAR` o `EXPEDIENTE_REASIGNAR` con ámbito territorial/organizacional adecuado.
- **Impacto arquitectónico:** Cero impacto en las facultades legítimas de administración técnica (`ADMIN_USUARIOS`, `CONFIG_SISTEMA`). Seguridad fail-closed garantizada ante asignaciones académicas no autorizadas.

### 2. `backend/src/domains/docucore/docucore.router.ts`
- **Línea afectada:** 96.
- **Cambio realizado:** Retiro de `'ESPECIALISTA'` de la lista de roles operativos autorizados para foliar documentos:
  ```typescript
  // Antes:
  const rolesOperativos = autorizacion.roles.some((r) =>
    ['SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES'].includes(r),
  );
  // Después:
  const rolesOperativos = autorizacion.roles.some((r) =>
    ['SECRETARIO', 'MESA_PARTES'].includes(r),
  );
  ```
- **Propósito y justificación:** Depuración controlada de facultades operativas activas de `ESPECIALISTA` (rol descontinuado) en endpoints del backend.
- **Impacto arquitectónico:** Impide que tokens con el rol extinto puedan efectuar foliación procesal en DocuCore.

### 3. `frontend/src/routes/AppRouter.tsx`
- **Líneas afectadas:** 104, 159, 178.
- **Cambio realizado:**
  1. En `/flujos/proyector-resoluciones`: Reemplazado `"ESPECIALISTA"` por `"JEFE_UNIDAD_ACADEMICA"`.
  2. En `/expedientes`: Retirado `"ESPECIALISTA"`.
  3. En `/expedientes/:id`: Retirado `"ESPECIALISTA"`.
- **Propósito y justificación:** Habilitar formalmente a `JEFE_UNIDAD_ACADEMICA` en el flujo de proyección de resoluciones y descontinuar las rutas de acceso para `ESPECIALISTA`.
- **Impacto arquitectónico:** Consistencia entre las capacidades normativas de la Jefatura Académica y los guards de ruta de React Router.

### 4. `frontend/src/components/HeaderInstitucional.tsx`
- **Líneas afectadas:** 60-80, 285-295, 475-485.
- **Cambio realizado:**
  1. Retirado `roles.includes("ESPECIALISTA")` de `puedeProyectar`.
  2. Retirado `"TESORERO"` de `esPersonal`.
  3. Declarada la constante `const esTesorero = roles.includes("TESORERO");`.
  4. Agregado el botón institucional directo `Tesorería` (`irA("/tesoreria")`) tanto en la barra de navegación de escritorio como en el menú desplegable móvil.
- **Propósito y justificación:** Evitar que el Tesorero acceda erróneamente a `/expedientes` (donde era rechazado con 403), garantizando que cuente con su acceso directo y legítimo a la interfaz financiera `/tesoreria`.

### 5. `frontend/src/pages/LoginPage.tsx`
- **Líneas afectadas:** 11-20.
- **Cambio realizado:** En el diccionario `DESTINOS_POR_ROL`:
  ```typescript
  // Eliminado:
  ESPECIALISTA: "/expedientes",
  // Agregado:
  TESORERO: "/tesoreria",
  ```
- **Propósito y justificación:** Guiar automáticamente al Tesorero hacia su módulo financiero tras un login exitoso y eliminar la ruta por defecto para `ESPECIALISTA`.

### 6. `frontend/src/pages/HomePage.tsx`
- **Líneas afectadas:** 133-162.
- **Cambio realizado:**
  1. Retirado `roles.includes("ESPECIALISTA")` de `puedeProyectar`.
  2. Retirado `"TESORERO"` de `esPersonal`.
  3. Retirado `'ESPECIALISTA'` de `esSoloTesoreria`.
- **Propósito y justificación:** Alinear la portada institucional para no renderizar tarjetas operativas a `ESPECIALISTA` y preservar la tarjeta de Tesorería para `TESORERO`.

### 7. `frontend/src/pages/expedientes/ExpedienteDetallePage.tsx`
- **Líneas afectadas:** 833-834.
- **Cambio realizado:** Retirado `"ESPECIALISTA"` de las listas de roles evaluadas en la función `puedeDigitalizar`.
- **Propósito y justificación:** Limpieza de autorización activa en la digitalización y foliación de anexos dentro del detalle de expedientes.

---

## 2. INVENTARIO DE ARCHIVOS DE PRUEBA (CREADOS Y ACTUALIZADOS)

### 1. `backend/tests/unit/domains/rutadoc/r3-armonizacion-autorizacion.spec.ts` *(Nuevo)*
- **Líneas:** 275 líneas.
- **Propósito:** Batería integral con cobertura individual para los 14 escenarios obligatorios de seguridad, RBAC y armonización institucional establecidos en la Sección 13 del mandato R3.
- **Resultado:** 14/14 passed.

### 2. `backend/tests/unit/domains/rutadoc/evaluadores-asignacion.spec.ts` *(Modificado)*
- **Líneas afectadas:** Inclusión de actores (`actorAdministrador`, `actorGestorApoyoArea`, `actorJefeUnidadAcademica`, `actorCoordinadorOtraArea`) y 6 pruebas unitarias específicas de rechazo 403 y asignación académica.
- **Resultado:** 15/15 passed.

### 3. `frontend/tests/unit/routes/rbacRoleGuardRoutes.test.tsx` *(Modificado)*
- **Líneas afectadas:** 163-185.
- **Cambio realizado:** Sustituido el bloque permisivo legado de `ESPECIALISTA` por una suite de denegación estricta a rutas operativas, e incorporado el bloque de validación para `Rol JEFE_UNIDAD_ACADEMICA` accediendo exitosamente a `/flujos/proyector-resoluciones` y `/expedientes`.
- **Resultado:** 36/36 passed.

### 4. `frontend/tests/unit/components/HeaderInstitucional.test.tsx` *(Modificado)*
- **Líneas afectadas:** 160-195.
- **Cambio realizado:** Actualizada la prueba para certificar a `JEFE_UNIDAD_ACADEMICA`, incorporada la prueba de navegación para `TESORERO` (exclusivo `/tesoreria`, sin botón «Bandeja») y validada la ausencia de módulos operativos para `ESPECIALISTA`.
- **Resultado:** 14/14 passed.

### 5. `frontend/tests/unit/pages/HomePage.test.tsx` *(Modificado)*
- **Línea afectada:** 222.
- **Cambio realizado:** Actualizado el Escenario 6 para evaluar la visibilidad y aislamiento de `JEFE_UNIDAD_ACADEMICA` en sustitución del fixture obsoleto de `ESPECIALISTA`.
- **Resultado:** 10/10 passed.

---

## 3. DOCUMENTOS ENTREGABLES GENERADOS EN `docs/`

1. `docs/INFORME_IMPLEMENTACION_R3_SIGD.md`: Informe maestro exhaustivo con declaración de entorno, análisis forense, justificación de arquitectura y certificación final.
2. `docs/MATRIZ_PRUEBAS_R3_SIGD.md`: Matriz completa de los 14 escenarios obligatorios y consolidación de 523 pruebas unitarias ejecutadas.
3. `docs/MATRIZ_ARCHIVOS_MODIFICADOS_R3_SIGD.md`: Este inventario técnico detallado de intervenciones.
