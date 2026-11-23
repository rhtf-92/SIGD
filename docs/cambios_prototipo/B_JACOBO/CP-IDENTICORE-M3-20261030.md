# Continuidad IdentiCore (M1) y Mesa de Partes (M3)

Fecha: 2026-10-30  
Rama: `B_JACOBO`  
HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`

## Alcance y preservación

Se continuó sobre un árbol de trabajo que ya contenía numerosos cambios previos de Codex/Antigravity (más de 250 entradas modificadas o sin seguimiento al inicio). Se preservaron; no hubo cambio de rama, commit, push, DDL ni DML. El alcance nuevo se limitó al perfil de identidad autenticado, la protección de expedientes propios, la validación de persistencia del registro y sus pruebas. Los estados de otros archivos modificados pertenecen al trabajo acumulado y no se atribuyen a esta intervención.

## Implementado

- `GET /api/v1/auth/me` expone al titular de la sesión los datos estructurados ya persistidos: tipo/número documental, nombres, apellidos o razón social, fecha de nacimiento, correo, teléfono y dirección jurídica cuando está registrada. No existe búsqueda pública por DNI. El esquema institucional inspeccionado no tiene una columna de domicilio natural, así que ese dato no se consulta ni se inventa.
- Mesa de Partes autenticada obtiene el perfil desde el backend, verifica que el ID y el rol correspondan a la sesión, bloquea edición de identidad y solo permite avanzar cuando el perfil es válido. El ciudadano público conserva el formulario manual. La verificación de titularidad del servicio de radicación sigue siendo autoritativa en backend.
- El servicio contempla persistir el domicilio natural en una columna estructurada solo si el esquema la ofrece; su prevalidación falla cerrada en el esquema actual, donde no existe. No se añadieron columnas ni se ejecutaron migraciones.
- El intento de registrar una identidad ya existente conserva su fila y nunca la sobrescribe. Si ya hay una cuenta/correo/documento asociado, se rechaza la duplicidad; si no hay cuenta, se responde `CITIZEN_IDENTITY_VERIFICATION_REQUIRED`. El DNI/nombre/fecha declarados en este mismo formulario no prueban control independiente, tanto si existen expedientes previos como si no. No hay un canal institucional disponible para completar esa verificación.
- Se añadió `GET /api/v1/tramites/mis-expedientes`, protegido por JWT y rol CIUDADANO. El servidor obtiene la persona de la cuenta autenticada, no acepta IDs de persona del cliente y devuelve solo resúmenes de expedientes propios.
- La consulta por CUT ahora requiere el token de seguimiento público emitido para ese trámite o una sesión autenticada cuyo titular coincida con el expediente. Para identidades privadas ajenas responde sin revelar existencia ni datos.
- La página de consulta muestra los expedientes propios y vacía/oculta resultados al cambiar de cuenta, evitando conservar en pantalla resultados de la sesión anterior.
- La pantalla de registro ya no ofrece el enlace «¿Ya tienes una cuenta? Iniciar sesión» en su pie; conserva el retorno al inicio/login desde las rutas existentes.

## Bloqueos de modelo e institucionales

La prevalidación de entorno informó `current_database=sigd_jacobo_demo`, `current_user=sigd_jacobo_user`, servidor PostgreSQL `172.20.0.2:5432` (acceso local configurado por el runtime en `127.0.0.1:5433`), sin privilegios administrativos, con migraciones desactivadas. La consulta `information_schema.columns` se ejecutó en `BEGIN READ ONLY` y terminó con `ROLLBACK`/`client.end()`.

La inspección efectiva confirma que `persona_natural` no tiene columna de domicilio y ninguna extensión tiene `ubigeo_distrito`; solo `persona_juridica.direccion` existe. El formulario de registro pide domicilio y distrito. La prevalidación falla cerrada antes de abrir transacción si no puede guardar ambos datos estructuradamente. No se añadieron columnas ni se ejecutaron migraciones. Por eso el registro no se declara operativo en el esquema actual; requiere autorización institucional y una evolución controlada del modelo.

No se encontró un flujo de OTP/correo verificado, token de reclamación de expediente ni proveedor institucional de identidad para acreditar a una persona que radicó anónimamente o para vincular cualquier fila `persona` preexistente sin cuenta. Coincidir DNI, nombres y fecha de nacimiento aportados por el propio solicitante no autentica al reclamante. El alta queda bloqueada hasta que la institución apruebe e implemente una prueba independiente (p. ej., canal de contacto previamente verificado o atención presencial con trazabilidad). No se alteraron las filas históricas.

El perfil solo puede autocompletar campos con fuente persistida. El modelo actual no ofrece fecha de nacimiento para persona jurídica ni ubicación normalizada (departamento/provincia/distrito) ni referencia domiciliaria; no se inventan valores. Correo/teléfono de contacto se pueden revisar en el formulario; la identidad documental y nominal permanece bloqueada para el titular autenticado.

## Pruebas

- Backend: `auth.router.spec.ts`, `registroCiudadano.service.spec.ts`, `registroCiudadano.http.spec.ts`, `mis-expedientes.spec.ts`: **4 archivos, 149 pruebas aprobadas**. Se cubren payload de perfil, rechazo seguro cuando no hay modelo persistente, duplicidad de persona y cuenta, bloqueo de reclamación sin prueba independiente, aislamiento de expedientes por propietario y restricciones de JWT/rol.
- Backend `npm run typecheck`: aprobado.
- Frontend `ConsultaPublicaPage.test.tsx`: **6/6 aprobadas**, incluida la vista propia autenticada.
- Frontend `npm run typecheck`: aprobado.
- `TramiteWizard.test.tsx` focalizado: **3 aprobadas, 59 omitidas** (autocompletado del perfil, cierre seguro cuando identidad falta y modalidad p?blica). La ejecuci?n completa/combinada del archivo se interrumpi? sin resultado y no se considera aprobada.
- `registroFormularios.test.tsx` focalizado en error de modelo incompatible: **1 aprobada, 18 omitidas**. La ejecuci?n completa/combinada se interrumpi? sin resultado y no se considera aprobada.
- `git diff --check` en los archivos de este alcance: sin errores. La comprobación global sigue mostrando dos espacios finales preexistentes en `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`, fuera de alcance y preservados.

## Validación integral pendiente

No se realizo un registro persistente real ni una radicacion nueva; no se crearon cuentas, CUT ni expedientes. La consulta PostgreSQL fue exclusivamente BEGIN READ ONLY y no modifico datos. La suite HTTP usa mocks, no E2E. Tampoco se verifico Casilla/NotiCore mediante una sesion real. Por tanto, el flujo M1->M3->M4->M8 no se declara integralmente validado.

## Clasificación

- **IMPLEMENTADO Y VALIDADO (pruebas focalizadas):** perfil propio autenticado, autocompletado de identidad disponible, guardas de titularidad, resumen de expedientes propios, no exposición en consulta por CUT, validación previa de compatibilidad del esquema.
- **IMPLEMENTADO, PERO NO VALIDADO E2E:** formularios reales con cuenta activa, consulta de historial contra PostgreSQL y funcionamiento completo de Casilla.
- **PENDIENTE DE DECISIÓN / EVOLUCIÓN AUTORIZADA:** persistencia estructurada de ubigeo en registro externo; mecanismo de verificación independiente para enlazar expedientes anónimos anteriores.
- **NO EJECUTADO:** DDL, DML, migraciones, registros, CUT, cambios de permisos, commits o push.
