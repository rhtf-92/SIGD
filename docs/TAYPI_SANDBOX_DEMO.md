# GUÍA DE DEMOSTRACIÓN: PAGO QR AUTOMÁTICO CON TAYPI SANDBOX (SIGD 2026)

Esta guía describe el procedimiento técnico y operativo para demostrar en vivo la integración del método de pago automatizado **QR Automático — TAYPI Sandbox** con desbloqueo de expedientes en el Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza".

---

## 1. Arquitectura y Métodos de Pago Disponibles

El módulo de Tesorería del SIGD cuenta con **tres métodos de recaudación coexistentes**:

1. **Efectivo en Ventanilla:**  
   Cobro presencial con cálculo automático de vuelto y confirmación manual por Tesorería.
2. **Yape / QR Asistido:**  
   Escaneo de QR institucional personal de Tesorería, validación del número de operación bancario y confirmación manual.
3. **QR Automático — TAYPI Sandbox (Nuevo):**  
   Generación de QR dinámico por orden, simulación de pago móvil en sandbox, webhook cryptográfico HMAC-SHA256 y desbloqueo automático del expediente en tiempo real.

> **Regla de Continuidad Operativa:**  
> Si la conexión a internet, el webhook o el sandbox no están disponibles durante la demo, el operador de Tesorería puede cambiar en un clic a **Efectivo** o **Yape Asistido** para confirmar el pago manualmente sin detener la atención.

---

## 2. Variables de Entorno y Configuración

> **ADVERTENCIA DE SEGURIDAD:**  
> Nunca guarde claves reales ni las exponga en repositorios públicos. Las llaves de sandbox deben configurarse únicamente en sus archivos locales `.env`.

### 2.1 Backend (`backend/.env`)

Configure las siguientes variables en su archivo `backend/.env` local:

```env
# Integración TAYPI Sandbox
TAYPI_BASE_URL=https://sandbox.taypi.pe
TAYPI_PUBLIC_KEY=taypi_pk_test_... # Su Public Key de Sandbox
TAYPI_SECRET_KEY=taypi_sk_test_... # Su Secret Key de Sandbox (usada para validar HMAC-SHA256)
TAYPI_SANDBOX=true
TAYPI_WEBHOOK_ENABLED=true
```

### 2.2 Frontend (`frontend/.env`)

```env
# Public Key para el SDK de Taypi en Frontend
VITE_TAYPI_PUBLIC_KEY=taypi_pk_test_...
```

---

## 3. Exposición del Webhook Local con Ngrok

Para recibir los webhooks reales de TAYPI Sandbox en su máquina de desarrollo local:

1. Inicie su túnel ngrok apuntando al puerto del backend (por defecto `3000`):
   ```bash
   ngrok http 3000
   ```
2. Ngrok proporcionará una URL pública segura, por ejemplo:
   `https://ejemplo-subdominio.ngrok-free.app`
3. En el panel de control de TAYPI Sandbox (**Webhooks**):
   - **URL del Webhook:** `https://ejemplo-subdominio.ngrok-free.app/api/v1/webhooks/taypi`
   - **Evento:** `payment.completed`
   - **Método HTTP:** `POST`

---

## 4. Flujo Paso a Paso para la Demostración

### Paso 1: Radicación del Trámite con Costo (Mesa de Partes / Ciudadano)
1. Inicie sesión con `mesa_partes_demo` (o como ciudadano).
2. Radique un trámite que contenga un arancel TUPA vigente (por ejemplo, *Constancia de Egresado*, *Certificado de Estudios* u otro procedimiento con arancel S/ > 0).
3. Observe que el expediente se crea en estado inicial, pero **la derivación está bloqueada** con advertencia:
   `"El trámite requiere pago de arancel TUPA (S/ ...). Debe confirmarse la orden de pago en Tesorería antes de derivar."`
4. Se emite la orden de pago institucional `PAG-2026-XXXXXX`.

### Paso 2: Apertura en Caja (Tesorería)
1. Inicie sesión con la cuenta `tesoreria_demo` (`TesoreriaDemo#2026`).
2. El sistema redirige automáticamente a `/tesoreria`.
3. En la tabla de órdenes pendientes, busque la orden correspondiente al expediente y presione el botón **[Procesar Pago]**.
4. En el panel de procesamiento verá las tres pestañas:
   - `[ Efectivo en Ventanilla ]`
   - `[ Yape / QR Asistido ]`
   - `[ QR automático — Sandbox ]`

### Paso 3: Generación del QR Dinámico
1. Seleccione la pestaña **[ QR automático — Sandbox ]**.
2. El sistema se comunicará con TAYPI Sandbox e inmediatamente renderizará:
   - El código QR dinámico generado específicamente para esta orden.
   - El monto exacto en Soles (PEN).
   - El identificador del pago del proveedor.
   - El temporizador de expiración (15 minutos).
   - Enlace directo al simulador móvil: `https://sandbox.taypi.pe/simulator`.

### Paso 4: Simulación del Pago desde el Teléfono Móvil
1. Abra en el navegador de su teléfono móvil (o en una ventana de navegador paralela):
   `https://sandbox.taypi.pe/simulator`
2. Puede:
   - Escanear el código QR que se muestra en la pantalla de Tesorería con la cámara del celular.
   - O ingresar el código de verificación/pago visible en el simulador.
3. Presione **"Confirmar Pago Exitoso"** en el simulador de TAYPI.

### Paso 5: Recepción del Webhook y Desbloqueo Automático
1. TAYPI enviará un payload JSON firmado con HMAC-SHA256 al endpoint `/api/v1/webhooks/taypi`.
2. El backend del SIGD:
   - Valida la firma criptográfica raw-body contra `TAYPI_SECRET_KEY`.
   - Verifica que el monto y la moneda (`PEN`) coincidan exactamente con la orden.
   - Aplica bloqueo pesimista en base de datos para evitar condiciones de carrera.
   - Genera el recibo de caja oficial correlativo `REC-2026-XXXXXX`.
   - Publica el evento transaccional en el Outbox (`PAGO_CONFIRMADO`).
   - Registra la traza en la bitácora de auditoría inmutable.
   - Desbloquea automáticamente el expediente en la máquina de estados FSM transicionándolo a `REGISTRADO`.
3. La interfaz de Tesorería detecta automáticamente la confirmación sin recargar la página:
   - Muestra el distintivo verde **"✓ Pago confirmado automáticamente"**.
   - Habilita el botón **[Ver constancia de pago]** para imprimir o descargar el comprobante de Tesorería.

### Paso 6: Derivación Exitosa en Mesa de Partes
1. Vuelva a la bandeja de Mesa de Partes (`/expedientes/:id`).
2. El expediente ahora muestra la orden como **"PAGADO"** con su respectivo recibo oficial.
3. El botón **[Derivar Expediente]** está completamente desbloqueado y permite transferir el expediente al área de destino institucional.

---

## 5. Protocolo de Contingencia / Fallback Manual

Si durante la demostración:
- El simulador de Taypi no responde o tiene demoras de red.
- La conexión ngrok se interrumpe.
- La configuración de llaves de sandbox fue omitida.

**Acción Inmediata:**
1. Haga clic en la pestaña **[ Efectivo en Ventanilla ]** o **[ Yape / QR Asistido ]**.
2. Ingrese el monto en efectivo recibido o el número de operación de Yape.
3. Presione **[Confirmar Pago]**.
4. El sistema emitirá el recibo oficial de forma inmediata y desbloqueará el expediente con total normalidad.
