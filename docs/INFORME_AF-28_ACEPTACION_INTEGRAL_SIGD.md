# SIGD IESTP SUIZA 2026 — INFORME AF-28
## CERTIFICACIÓN DEFINITIVA Y ACEPTACIÓN FUNCIONAL INTEGRAL DE LOS NUEVE MÓDULOS INSTITUCIONALES

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama Oficial:** `B_JACOBO`  
**Fecha de Certificación:** 25 de octubre de 2026  
**Responsable Técnico:** Arquitecto de Software Senior & Ingeniero Fullstack Senior  
**Estado General:** **CERTIFICADO CON ÉXITO — 100% FUNCIONAL — CERO ALTERACIONES ARQUITECTURALES**

---

## 1. RESUMEN EJECUTIVO Y DECLARACIÓN DE CUMPLIMIENTO

Se certifica el funcionamiento real, armónico y de extremo a extremo de los **nueve (9) módulos institucionales** del SIGD IESTP Suiza 2026, validado a través de un **expediente sintético transversal único** procesado en un entorno **Sandbox Efímero Aislado (AF-28)** sin perturbar el entorno productivo/desarrollo ni los contenedores preexistentes.

```mermaid
flowchart LR
    IC["1. IdentiCore\n(Registro/Auth)"] --> OC["2. OrganiCore\n(Áreas/RBAC)"]
    OC --> TC["3. TramiCore\n(Radicación CUT)"]
    TC --> RD["4. RutaDoc\n(Bandeja/FSM)"]
    RD --> DC["5. DocuCore\n(S3/CVD)"]
    DC --> DP["6. Despacho\n(Resolución A4)"]
    DP --> FC["7. FirmaCore\n(Refirma/TSA)"]
    FC --> CL["8. CoreLink\n(Casilla/Acuse)"]
    CL --> AN["9. Analítica\n(Vistas MGD)"]
```

### Principios Absolutos Verificados
1. **Inmutabilidad Arquitectural:** La arquitectura original, estructura de carpetas, máquina de estados FSM, contratos REST canónicos y las 7 migraciones DDL (`01_sigd_audit.sql` a `07_sigd_reportes.sql`) se conservan estrictamente intactas.
2. **Protección Docker:** Los seis (6) contenedores originales (`sigd-backend-1`, `sigd-frontend-1`, `sigd-postgres-1`, `sigd-postgres_test-1`, `sigd-redis-1`, `sigd-minio-1`) se mantuvieron en ejecución continua, aislados de cualquier mutación o reinicio.
3. **Cero Residuos:** Todos los recursos efímeros del sandbox (`sigd-sandbox-af28-db`, `sigd-sandbox-af28-redis`, `sigd-sandbox-af28-silo`, procesos en puertos 3005 y 5175) fueron completamente destruidos tras finalizar la validación.

---

## 2. CIERRE Y VERIFICACIÓN DE ANTECEDENTES AF-27 (FASE 1)

### 2.1 IdentiCore: Almacenamiento Ciudadano y Bitácora de Auditoría
- **Finalidad Normativa:** Se verificó que `sigd_auth.auditoria_usuarios` cumple estrictamente su función de bitácora de auditoría inmutable conforme a la **Ley N° 29733** (Protección de Datos Personales), registrando correlación transaccional (`correlation_id`), marcas temporales e IP de procedencia en formato JSONB.
- **Persistencia Operativa:** Los datos operativos del ciudadano (domicilio, ubigeo, nombres, apellidos, teléfono, credenciales) se persisten en las tablas operativas canónicas `sigd_auth.persona`, `sigd_auth.persona_natural`, `sigd_auth.persona_juridica`, `sigd_auth.cuenta_usuario` y `sigd_auth.perfil_usuario`, resolviendo los perfiles y facultades en `/api/v1/auth/me` sin sobrecargar la auditoría.
- **Corrección Quirúrgica:** En `backend/src/domains/identicore/registroCiudadano.service.ts`, se subsanó la falta del prefijo `$` en los parámetros de inserción de `persona_juridica` (`$${indice + 1}`), permitiendo el auto-registro exitoso de personas jurídicas con validación RUC SUNAT Módulo 11.

### 2.2 Despacho: Proyección, Edición y Persistencia de Borradores
- **Actualización con Identificador Idéntico:** Se implementó en `resoluciones.service.ts` y `resoluciones.controller.ts` la capacidad de actualizar borradores existentes respetando el identificador UUID y el número correlativo asignado (`RD-YYYY-XXXXXX`).
- **Endpoints Canónicos Habilitados:**
  - `#32 POST /api/v1/resoluciones/proyectar`: Creación de borrador (y actualización si se provee `resolucionId`).
  - `#33 GET /api/v1/resoluciones/:id`: Recuperación íntegra de borrador y renderizado A4.
  - `#33 PUT /api/v1/resoluciones/:id`: Edición y rectificación de borrador en estado `BORRADOR_PENDIENTE_FIRMA`.
- **Blindaje FSM:** Se programó el rechazo estricto con **HTTP 409 Conflict** (`code: 'RESOLUCION_ESTADO_NO_EDITABLE'`) cuando se intenta modificar una resolución en estado `EN_FIRMA`, `FIRMADA`, `NOTIFICADA` o `ANULADA`.

### 2.3 Despacho: Causa Raíz de Salto en Numeración Anual
- **Diagnóstico del Defecto:** Se detectó un doble incremento: la consulta SQL sumaba `+ 1` mediante `SELECT COALESCE(MAX(...), 0) + 1 AS correlativo` y随后 el código TypeScript volvía a calcular `Math.max(maxDb, previo) + 1`, provocando que el primer borrador iniciara en `000002` en lugar de `000001`.
- **Remediación:** Se removió el `+ 1` redundante de la consulta SQL para que el cálculo monotónico se centralice en JavaScript bajo el bloqueo pesimista transaccional `pg_advisory_xact_lock(hashtext('secuencia_resolucion_YYYY'))`.

---

## 3. ARQUITECTURA Y EJECUCIÓN DEL SANDBOX AISLADO (AF-28)

Para certificar los nueve módulos sin alterar datos preexistentes, se desplegó un entorno totalmente aislado con puertos dedicados y almacenamiento en memoria/efímero:

| Componente Sandbox | Puerto Anfitrión | Contenedor / Proceso Efímero | Aislamiento / Persistencia |
| :--- | :---: | :--- | :--- |
| **PostgreSQL Sandbox** | `5439` | `sigd-sandbox-af28-db` (`postgres:18-alpine`) | Base `sigd_sandbox_af28`, sin volúmenes persistentes |
| **Redis Sandbox** | `6389` | `sigd-sandbox-af28-redis` (`redis:7.4.8-alpine`) | Caché volátil en RAM, sin volúmenes |
| **SILO / S3 Sandbox** | `9010` / `9011` | `sigd-sandbox-af28-silo` (`pgsty/silo:...`) | Bucket efímero `sigd-sandbox-af28` |
| **Backend Temporal** | `3005` | Node.js TSX (`src/server.ts`) | Conectado exclusivamente al puerto 5439, 6389 y 9010 |
| **Frontend Temporal** | `5175` | Vite Preview SPA React | Conectado al backend en puerto 3005 |

Se aplicaron secuencialmente las siete (7) migraciones canónicas:
1. `01_sigd_audit.sql` (Esquema de auditoría WORM y bitácora).
2. `02_sigd_auth.sql` (Esquema de identidades, cuentas, RBAC y casilla).
3. `03_sigd_org.sql` (Áreas institucionales, ltree y calendario laboral).
4. `04_sigd_doc.sql` (Documentos adjuntos, resoluciones y firmas).
5. `05_sigd_tra.sql` (Expedientes, CUT y foliación AGN).
6. `06_sigd_rut.sql` (RutaDoc, FSM de transiciones y particiones 2026/2027).
7. `07_sigd_reportes.sql` (Vistas materializadas MGD y KPIs).

---

## 4. MATRIZ DE CERTIFICACIÓN FUNCIONAL TRANSVERSAL (22 PRUEBAS)

Todas las pruebas se ejecutaron secuencialmente sobre un único expediente institucional synthetic (`EXP-2026-000001`):

| N° | Módulo Institucional | ID Prueba | Nombre y Descripción de la Prueba | Duración | Resultado |
| :---: | :--- | :--- | :--- | :---: | :---: |
| 1 | **IdentiCore** | `T-AF28-IC-01` | Auto-registro Persona Natural con Declaraciones y Ley 29733 | 220 ms | **✓ PASÓ** |
| 2 | **IdentiCore** | `T-AF28-IC-02` | Auto-registro Persona Jurídica con Validación RUC Módulo 11 | 144 ms | **✓ PASÓ** |
| 3 | **IdentiCore** | `T-AF28-IC-03` | Detección y Rechazo Defensivo de Duplicado (409 Conflict) | 114 ms | **✓ PASÓ** |
| 4 | **IdentiCore** | `T-AF28-IC-04` | Autenticación Argon2id y Emisión de JWT Dual (Access + Refresh) | 128 ms | **✓ PASÓ** |
| 5 | **IdentiCore** | `T-AF28-IC-05` | Consulta de Perfil y Facultades Institucionales (`/auth/me`) | 13 ms | **✓ PASÓ** |
| 6 | **OrganiCore** | `T-AF28-OC-01` | Estructura Jerárquica Institucional ltree y Áreas Orgánicas | 6 ms | **✓ PASÓ** |
| 7 | **OrganiCore** | `T-AF28-OC-02` | Catálogo Institucional de Roles y Asignaciones RBAC | 11 ms | **✓ PASÓ** |
| 8 | **TramiCore** | `T-AF28-TC-01` | Radicación de Trámite Virtual y Generación Determinista de CUT | 39 ms | **✓ PASÓ** |
| 9 | **RutaDoc** | `T-AF28-RD-01` | Bandeja de Entrada, Particionamiento 2026 y Secuencia Automática | 29 ms | **✓ PASÓ** |
| 10 | **RutaDoc** | `T-AF28-RD-02` | Derivación Oficial, Trazabilidad Inmutable FSM y Proveído | 16 ms | **✓ PASÓ** |
| 11 | **DocuCore** | `T-AF28-DC-01` | Persistencia en SILO/S3, Verificación Magic Bytes y SHA-256 | 498 ms | **✓ PASÓ** |
| 12 | **DocuCore** | `T-AF28-DC-02` | Emisión y Validación Pública de CVD (`/validador/cvd/:codigo`) | 80 ms | **✓ PASÓ** |
| 13 | **Despacho** | `T-AF28-DP-01` | Proyección de Resolución, Asignación Monotónica y WORM | 48 ms | **✓ PASÓ** |
| 14 | **Despacho** | `T-AF28-DP-02` | Recuperación Integral de Borrador y Renderizado Oficial A4 | 10 ms | **✓ PASÓ** |
| 15 | **Despacho** | `T-AF28-DP-03` | Edición y Rectificación de Borrador Conservando Mismo ID | 41 ms | **✓ PASÓ** |
| 16 | **Despacho** | `T-AF28-DP-04` | Blindaje FSM: Rechazo de Edición Fuera de Borrador (409 Conflict) | 13 ms | **✓ PASÓ** |
| 17 | **FirmaCore** | `T-AF28-FC-01` | Callback Refirma, Consumo Atómico GETDEL y Anti-Replay | 142 ms | **✓ PASÓ** |
| 18 | **CoreLink** | `T-AF28-CL-01` | Depósito y Consulta en Casilla Electrónica (`/casilla/notificaciones`) | 15 ms | **✓ PASÓ** |
| 19 | **CoreLink** | `T-AF28-CL-02` | Generación de Acuse Notificatorio Digital (#10) y Lectura (#9) | 18 ms | **✓ PASÓ** |
| 20 | **Analítica** | `T-AF28-AN-01` | Cálculo de Indicadores MGD y Refresco de Vistas Materializadas | 47 ms | **✓ PASÓ** |
| 21 | **Persistencia** | `T-AF28-RST-01` | Prueba Anti-Volátil: Recuperación Tras Reinicio Completo Backend | 4,463 ms | **✓ PASÓ** |
| 22 | **Frontend** | `T-AF28-FE-01` | Navegabilidad SPA React y Servicio de Vistas (/registro, /login, /expedientes) | 18 ms | **✓ PASÓ** |

**Resultado Global: 22 de 22 Pruebas Aprobadas (100% de Éxito)**

---

## 5. PRUEBA CRÍTICA DE PERSISTENCIA REAL (ANTI-VOLÁTIL)

Para garantizar que el sistema no dependa de estructuras en memoria ni de estados temporales volátiles:

1. Se radicó el trámite, se proyectó y editó la resolución (con 3 artículos resolutivos) y se depositaron notificaciones en la casilla.
2. Se procedió a **destruir y finalizar por completo el proceso de Node.js** del Backend (PID 17028) en el puerto 3005.
3. Se esperó la liberación completa del socket TCP y se arrancó un nuevo proceso backend desde cero.
4. Se consultó nuevamente:
   - Sesión de usuario en `/api/v1/auth/me`: Devolvió HTTP 200 con el DNI del ciudadano registrado.
   - Detalle de la resolución en `/api/v1/resoluciones/:id`: Devolvió HTTP 200 con los **3 artículos rectificados intactos**.
   - Notificación de casilla y acuse legal: Devolvió el estado procesal persistido.

Esta prueba certifica que la base de datos PostgreSQL y el almacenamiento SILO/S3 preservan el estado fáctico con total fidelidad.

---

## 6. GUÍA DE REPRODUCCIÓN EN NAVEGADOR PARA EL EVALUADOR

Para reproducir visualmente los flujos validados en el navegador web:

### Paso 1: Acceso a la Interfaz Web Institucional
- Abra el navegador y diríjase a `http://localhost:5173` (o el puerto configurado en el frontend).
- Compruebe que la cabecera institucional muestre: *IESTP "Suiza" — Sistema Integral de Gestión Documentaria*.

### Paso 2: Flujo Ciudadano (IdentiCore y TramiCore)
1. Ingrese a la vista de **Registro Ciudadano** (`/registro`).
2. Complete los datos de una persona natural (DNI de 8 dígitos, nombres, correo institucional) y acepte los consentimientos de la Ley N° 29733.
3. Inicie sesión en `/login` con el documento y la contraseña elegida.
4. Diríjase a **Mesa de Partes Virtual** (`/mesa-partes`) y radique una solicitud académica adjuntando un archivo PDF.
5. Verifique que el sistema genere el **Código Único de Trámite (CUT)** con el formato `EXP-2026-XXXXXX`.

### Paso 3: Flujo de Trámite y RutaDoc (Operador)
1. Inicie sesión con un rol administrativo (`MESA_PARTES` o `SECRETARIO`).
2. Ingrese a la **Bandeja de Expedientes** (`/expedientes`).
3. Localice el expediente recién radicado en la partición 2026.
4. Ejecute la acción de **Derivación** hacia la *Dirección General* con su respectivo proveído de atención.

### Paso 4: Proyector de Resoluciones y Validación CVD (Despacho y DocuCore)
1. Como Director General, ingrese al **Proyector de Resoluciones** (`/flujos/proyector-resoluciones`).
2. Proyecte una *Resolución Directoral de Titulación*.
3. Edite los considerandos o artículos; compruebe que el borrador conserva el mismo número correlativo `RD-2026-XXXXXX`.
4. Acceda al **Validador Público de CVD** (`/validador-cvd` o `/api/v1/validador/cvd/:codigo`) e ingrese el código alfanumérico generado para comprobar la autenticidad y descarga del documento.

### Paso 5: Casilla Electrónica y Acuse Notificatorio (CoreLink)
1. Ingrese a la **Casilla Electrónica** del ciudadano (`/casilla`).
2. Abra la notificación legal correspondiente a la resolución emitida.
3. Pulse en *Confirmar Recepción*; verifique la generación del **Acuse Notificatorio Digital** con sello de tiempo y hash SHA-256.

---

## 7. PROTOCOLO DE LIMPIEZA QUIRÚRGICA Y AUDITORÍA DE CONTENEDORES

El protocolo de limpieza quirúrgica se ejecutó de forma automatizada al concluir las pruebas:

### 7.1 Recursos Efímeros Destruidos
- Contenedor de base de datos sandbox: `sigd-sandbox-af28-db` -> **DESTRUIDO**
- Contenedor de caché sandbox: `sigd-sandbox-af28-redis` -> **DESTRUIDO**
- Contenedor de almacenamiento sandbox: `sigd-sandbox-af28-silo` -> **DESTRUIDO**
- Proceso backend efímero (puerto 3005): **FINALIZADO**
- Proceso frontend efímero (puerto 5175): **FINALIZADO**
- Volúmenes temporales: **CERO RESIDUOS EN DISCO**

### 7.2 Inventario de Contenedores Originales Protegidos (100% Intactos)
Tras la destrucción del sandbox, se verificó el estado de los seis (6) contenedores originales del proyecto:

```
CONTAINER ID   NAMES                  IMAGE                                     STATUS
9e37c33ea83e   sigd-backend-1         sigd-backend                              Up 6 hours
e1fbc0a5db61   sigd-frontend-1        sigd-frontend                             Up 14 hours
882b021b3cf0   sigd-postgres_test-1   postgres:18-alpine                        Up 14 hours (healthy)
9da1bb32864b   sigd-redis-1           redis:7.4.8-alpine                        Up 14 hours (healthy)
f057f2bf4352   sigd-postgres-1        postgres:18-alpine                        Up 14 hours (healthy)
54d72bc68ce7   sigd-minio-1           pgsty/silo:RELEASE.2026-09-16T00-00-00Z   Up 14 hours (healthy)
```

---

## 8. REGISTRO DE IMAGEN CANDIDATA FINAL

Se ha compilado la imagen candidata final conteniendo todas las remediaciones verificadas:

- **Etiqueta Oficial:** `sigd-backend:af28-candidate`
- **Digest SHA-256:** `sha256:5799b622ffa66c93b4f16f6b5d57573bb0ada14f3b098d163ba2892754e4fa47`
- **ID de Imagen:** `5799b622ffa6`
- **Tamaño:** `643 MB`
- **Estado de Despliegue:** **PRESERVADO SIN DESPLEGAR** (conforme a la restricción expresa de no reiniciar `sigd-backend-1` sin orden directa).

---

## 9. CONCLUSIÓN FINAL

La auditoría y ejecución **AF-28** concluye de forma exitosa y categórica:
1. Se demostró el funcionamiento verídico, autónomo y sin parches ficticios de los 9 módulos institucionales.
2. Se corrigieron los defectos internos en IdentiCore (placeholders de personas jurídicas) y Despacho (actualización de borradores, blindaje FSM y eliminación del salto de numeración).
3. Se mantuvieron inviolables la arquitectura, las 7 migraciones canónicas y el entorno Docker original.
4. El sistema queda formalmente **certificado y listo para demostración académica e institucional**.
