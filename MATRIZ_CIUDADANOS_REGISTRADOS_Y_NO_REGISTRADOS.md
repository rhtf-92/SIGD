# SIGD RENATO — MATRIZ DE CIUDADANOS REGISTRADOS Y NO REGISTRADOS (PÚBLICOS)

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Sistema:** Sistema Integral de Gestión Documentaria — SIGD RENATO  
**Base Legal:** TUO de la Ley N° 27444 (D.S. 004-2019-JUS, Arts. 124, 134, principio de informalismo, debido procedimiento y presunción de veracidad); Ley N° 29733 de Protección de Datos Personales; D.S. 029-2021-PCM (Reglamento de Gobierno Digital).  
**Rama Oficial:** `B_JACOBO`  
**Base de Datos:** `sigd_jacobo_demo` (PostgreSQL 18 en puerto 5433)  
**Fecha de Certificación:** 22 de Noviembre de 2026  

---

## 1. INTRODUCCIÓN Y POLÍTICA DE ACCESIBILIDAD UNIVERSAL

El ordenamiento administrativo peruano prohíbe condicionar la recepción o radicación de un escrito a que el ciudadano cuente previamente con un usuario y contraseña en el sistema institucional. En estricta observancia del **principio de informalismo** y el **derecho de petición administrativa**, el SIGD RENATO implementa una arquitectura dual de atención que procesa con idéntico rigor jurídico y trazabilidad documental tanto a ciudadanos autenticados en su Casilla Electrónica como a administrados que radican por el canal público sin poseer cuenta de usuario.

---

## 2. MATRIZ COMPARATIVA TÉCNICA Y OPERATIVA

| Dimensión Técnica / Operativa | Ciudadanos Registrados (Con Cuenta) | Ciudadanos No Registrados (Públicos / Sin Cuenta) | Soporte en PostgreSQL (`sigd_jacobo_demo`) |
| :--- | :--- | :--- | :--- |
| **Identificación Institucional** | Cuenta de usuario con login biométrico o credenciales Argon2/bcrypt. Posee UUID en `sigd_auth.cuenta_usuario`. | Declaración jurada de identidad bajo presunción de veracidad. Vinculación en `sigd_auth.persona` y `sigd_auth.persona_natural`. | `sigd_auth.persona`<br>`sigd_auth.persona_natural`<br>`sigd_auth.cuenta_usuario` *(NULL para no registrados)* |
| **Radicación Documental** | Módulo de Radicación Virtual Interno (`/tramites/nuevo`). Sesión JWT verificada con claim `sub = id_usuario`. | Formulario Público de Trámite Web (`/tramites/radicacion-publica`). No exige login. Genera huella SHA-256 de sesión y payload. | Tabla `sigd_tra.radicacion_publica`<br>(Columnas `sesion_hash`, `payload_hash`, `datos_declarados`, `respuesta`). |
| **Orden de Pago (Tesorería)** | `ciudadano_id` obligatorio vinculado a `cuenta_usuario`. `sesion_publica_hash = NULL`, `solicitante_declarado = NULL`. | `ciudadano_id = NULL`. Exigencia estricta por check constraint de `sesion_publica_hash` (64 chars) y `solicitante_declarado` (jsonb). | Check constraint en `sigd_tes.orden_pago`: `orden_titular_o_capacidad`. |
| **Cómputo de 15 Días Hábiles** | Inicia al radicar. Pago verificable en ventanilla o web. Habilita de inmediato para Mesa de Partes al abonar. | Inicia al radicar. Pago verificable por DNI en Caja o referencia bancaria. Habilita de inmediato para Mesa de Partes. | `sigd_tra.expediente_habilitacion`<br>(Columnas `habilitado`, `estado_plazo`, `fecha_vencimiento_pago`). |
| **Notificación Principal de Actos** | **Casilla Electrónica Oficial** (`sigd_auth.notificacion_casilla`). Genera acuse automático con sellado de tiempo y CVD. | **Correo Electrónico Declarado** (`sigd_auth.persona_natural.correo` o `payload.correoDeclarado`). | `sigd_auth.notificacion_casilla` (Registrados)<br>Despachador Outbox Email Fallback (No Registrados). |
| **Notificación Complementaria** | Correo registrado + WhatsApp Business Cloud API Sandbox al celular validado. | Correo declarado + WhatsApp Business Cloud API Sandbox al celular declarado en la solicitud. | `sigd_auth.notificacion_whatsapp`<br>(Columnas `telefono`, `tipo_cierre`, `proveedor`, `message_id`). |
| **Portal de Consulta y Tracking** | Panel privado "Mis Expedientes" (`/tramites/mis-expedientes`) con bitácora interactiva de movimientos. | Portal de Consulta Pública Segura (`/tramites/consulta-publica/{cut}`) ingresando Código CUT y DNI del solicitante. | `sigd_tra.expediente`<br>`sigd_rut.movimiento_tramite` |
| **Custodia y Archivo Final** | Transferencia formal a Archivo Central con constancia en su buzón de Casilla. | Transferencia formal a Archivo Central con notificación por correo y WhatsApp con enlace al archivo. | `sigd_rut.expediente_cierre_historial`<br>(Inmutabilidad WORM garantizada). |

---

## 3. IMPLEMENTACIÓN DEL DESPACHO DE NOTIFICACIONES MULTICANAL SIN CUENTA PREVIA

En `backend/src/audit/despachador-notificaciones.ts`, se implementó el algoritmo de resolución jerárquica de destinatario:

```typescript
// Si no existe cuenta de usuario registrada, resolver correo desde persona_natural o payload
let correoDestino = usuarioId ? await buscarCorreoPorUsuarioId(conexion, usuarioId) : null;

if (!correoDestino && payload.expediente_id) {
  const personaRes = await conexion.query(`
    SELECT pn.correo, pn.telefono
      FROM sigd_tra.expediente e
      JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
     WHERE e.expediente_id = $1::uuid
     LIMIT 1;
  `, [payload.expediente_id]);
  
  if (personaRes.rows[0]?.correo) {
    correoDestino = personaRes.rows[0].correo;
  }
}

// Fallback final a correo declarado en el evento outbox
if (!correoDestino && payload.correoDeclarado) {
  correoDestino = payload.correoDeclarado;
}
```

Esta lógica garantiza que ningún evento público quede en estado `FALLIDO` o sin remitir por el hecho de que el solicitante no tenga usuario en la plataforma.

---

## 4. CASOS DE PRUEBA Y EVIDENCIA PERICIAL FORENSE

### 4.1. Caso A: Ciudadano Registrado con Pago Temprano y Conclusión Satisfactoria
- **Código CUT:** `EXP-2026-000212`
- **Solicitante:** Carlos Alberto Vásquez Mori (DNI `72145896`).
- **Usuario:** `0492855d-9f27-4cdf-b1ee-3bc200bfaaa3` (cuenta activa con Casilla).
- **Orden de Pago:** `OP-2026-000212` emitida con `ciudadano_id = '0492855d-...'`.
- **Pago:** `RC-2026-000212` en Caja el 05/11/2026 (Día 2). Habilitación Inmediata.
- **Resolución:** `RD-2026-000018` firmada digitalmente con CVD `CVD-2026-RD-000018-8A3F`.
- **Notificación:** Casilla Electrónica (`sigd_auth.notificacion_casilla`), Acuse `ACU-2026-000212`.
- **WhatsApp Final:** `wamid.HBgM0E209DEF15A0B79F1489493A6DBDF65E` remitido al celular `961234567`.
- **Custodia:** Archivo Central (Estante E-06, Balda B-02, Caja C-22).

### 4.2. Caso B: Ciudadano No Registrado con Pago en Ventanilla y Conclusión Satisfactoria
- **Código CUT:** `EXP-2026-000213`
- **Solicitante Declarado:** Carlos Alberto Mendoza Ruiz (DNI `44556677`).
- **Persona:** `4f607328-f737-4a4e-a91b-e71c73677acb` (sin cuenta en `cuenta_usuario`).
- **Radicación Pública:** Registrada en `sigd_tra.radicacion_publica` con sesion hash SHA-256.
- **Orden de Pago:** `OP-2026-000213` con `ciudadano_id = NULL`, `sesion_publica_hash` validada y objeto `solicitante_declarado`.
- **Pago:** `RC-2026-000213` en Caja al día siguiente (Día 1). Habilitación Inmediata.
- **Resolución:** `RD-2026-000019`.
- **Notificación:** Correo electrónico institucional remitido a `carlos.mendoza@test.suiza.edu.pe`.
- **WhatsApp Final:** `wamid.HBgM55871961E3210CB48D37207E19A2F340` remitido al celular `961234567` con enlace de consulta pública: `http://localhost:5178/tramites/consulta-publica/EXP-2026-000213`.
- **Custodia:** Archivo Central.

### 4.3. Caso C: Ciudadano Registrado con Falta de Pago (Caducidad Legal a los 15 Días Hábiles)
- **Código CUT:** `EXP-2026-000214`
- **Solicitante:** Carlos Alberto Vásquez Mori (DNI `72145896`).
- **Radicación:** 03/11/2026.
- **Día 14 Hábil (23/11/2026):** `habilitado = false`, `estado_plazo = 'EN_PLAZO'`, 1 día restante.
- **Día 16 (25/11/2026):** Plazo perentorio expirado. Ejecución de `archivarPorFaltaDePago()`.
- **Resultado en BD:** `sigd_tra.expediente.estado = 'ARCHIVADO'`, `sigd_doc.expediente.estado = 'ANULADO'`.
- **Bitácora WORM:** Movimiento `REGISTRADO` + `CIERRE` → `ARCHIVADO` registrado en `sigd_rut.movimiento_tramite` y asiento inmutable en `sigd_rut.expediente_cierre_historial`.
- **WhatsApp de Cierre:** `wamid.HBgM2DF9BD8016ED841FE3372722B1F0CEC7` notificando archivo por falta de pago conforme al Art. 143 LPAG.

### 4.4. Caso D: Ciudadano No Registrado con Falta de Pago (Barrido Transaccional por Batch Job)
- **Código CUT:** `EXP-2026-000215`
- **Solicitante Declarado:** Persona Demostracion Publica (DNI `00000887`).
- **Persona:** `3fb6323e-964b-424c-9bc5-e55fd8b439e7` (sin cuenta).
- **Radicación:** 03/11/2026. Plazo vencido el 24/11/2026.
- **Barrido de Vencimientos:** Ejecución de `procesarVencimientosPago(client, '2026-11-25')`.
- **Resultado:** Detección automática en lote, bloqueo con lock transaccional, archivo definitivo en `sigd_tra` y `sigd_doc`.
- **WhatsApp de Cierre:** `wamid.HBgM351721E2BD9602F7FC78F11D00114D36` remitido al celular declarado `999999999` informando el archivo definitivo.
