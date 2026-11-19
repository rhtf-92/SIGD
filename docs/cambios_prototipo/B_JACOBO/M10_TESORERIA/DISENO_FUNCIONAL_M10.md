# Diseño funcional M10 — 31/10/2026

## Alcance implementado

Tesorería es un dominio del backend y una ruta protegida `/tesoreria` del frontend actual. Reutiliza identidad, RBAC, almacenamiento, auditoría, Outbox y Casilla. No es un servidor separado. La portada pública conserva encabezado, hero, fotografías y tarjetas; la nueva tarjeta pertenece a la vista autenticada.

La interfaz tiene seis pestañas: Resumen, Pagos, Comprobantes, Devoluciones, Movimientos y Reportes. El ciudadano ve exclusivamente sus operaciones; las acciones administrativas dependen de capacidades recuperadas del backend. El panel no concede permisos por ocultar o mostrar botones.

## Tarifa y orden antes del CUT

1. Un responsable propone una versión de tarifa con procedimiento vigente, importe decimal, concepto, periodo, fuente y PDF sustentatorio.
2. Otro responsable con permiso de validación acepta o rechaza la propuesta. Se impiden periodos validados superpuestos.
3. El ciudadano selecciona un procedimiento con tarifa validada. El servidor fija importe, moneda y concepto; el navegador no los decide.
4. Se genera una referencia `OP-<UUID>` independiente del CUT. La cuenta y persona provienen de la sesión validada.
5. El registro es idempotente por cuenta y clave de solicitud; se conserva la clave durante reintentos y se renueva tras una nueva intención confirmada.

La falta de una tarifa no significa gratuidad. Una tarifa validada de `0.00` permite continuar sin pago; no se sembraron tarifas cero ni importes oficiales sin fuente verificable.

## Registro y verificación manual

El ciudadano adjunta un PDF bancario o de caja y declara medio, entidad, referencia y fecha. El registro comienza en REGISTRADO, no en VERIFICADO. Un responsable diferente revisa el documento contra evidencia institucional externa. Puede pasar a EN_VERIFICACION, OBSERVADO, RECHAZADO o VERIFICADO según las transiciones admitidas. Una carga de archivo no demuestra abono bancario.

El sistema no cobra, no consulta bancos y no emite comprobantes tributarios. La referencia única evita reutilizar la misma operación declarada; la revisión humana debe comprobar entidad, importe, titular y correspondencia con el procedimiento. No hay cuentas bancarias ni QR inventados.

## Mesa de Partes

La persona autenticada puede consultar sus órdenes verificadas en el paso documental. M3 comprueba nuevamente titular, procedimiento, estado del pago, ausencia de otra aplicación y ausencia de devolución. Consume la orden dentro de la transacción que crea el expediente. Los reintentos de una radicación ya confirmada recuperan el resultado de idempotencia anterior.

El flujo público existente permanece disponible. `SIGD_DEMO_OMITIR_PAGO=true` sigue siendo una excepción de demostración condicionada a la base efectiva `sigd_jacobo_demo`; no crea pagos ni modifica el TUPA. Sin excepción y sin tarifa validada, el backend rechaza la radicación. El pago público previo al registro mediante identidad verificada requiere un diseño adicional; no se asigna a una cuenta genérica.

## Devoluciones

El titular solicita un importe positivo dentro del saldo de un pago verificado, con motivo y sustento. La solicitud recibe una referencia `DEV-<UUID>` y no modifica el pago original. Los importes solicitados reservan saldo hasta su rechazo o devolución; los ya devueltos continúan descontándolo. No se permite una segunda solicitud activa para el mismo pago.

Secuencia: SOLICITADA → EN_EVALUACION → PENDIENTE_APROBACION → APROBADA → EN_PROCESO_DEVOLUCION → DEVUELTA → CERRADA. La evaluación admite observación y rechazo; la aprobación también puede rechazar. El evaluador, aprobador y ejecutor deben ser personas autorizadas distintas; ninguno puede resolver su propia solicitud.

DEVUELTA exige fecha, entidad, referencia externa, PDF sustentatorio y confirmación explícita de una ejecución externa ya realizada. El sistema registra esa ejecución; no efectúa transferencias. Una prueba con datos sintéticos revertidos no acredita reembolso real.

## Límites actuales

- Fuente oficial de tarifas no localizada: ninguna tarifa financiera quedó validada en la base.
- Roles creados sin asignarlos a cuentas: Dirección debe autorizar responsables.
- No hay emisión SUNAT, pasarela, conciliación bancaria automática ni firma institucional del comprobante.
- No existe aún un flujo de anexos adicionales para subsanar un comprobante observado conservando versiones; se mantiene el original inmutable.
- El backend del puerto 3008 no se reinició para activar estos cambios; las pruebas integradas utilizaron un servidor temporal cerrado al terminar.
- La devolución real y el ciclo financiero persistente requieren una operación autorizada y documentación auténtica. No se simularon para satisfacer el criterio de cierre.
