# Formato institucional propuesto — recibo interno RC-v2

Propuesta para aprobación del Instituto. No modifica, renumera ni regenera recibos existentes. No se presenta como comprobante tributario electrónico ni como integración SUNAT.

## Revisión del PDF actual

Se leyó el PDF real de demostración recibo-ingreso-demo.pdf mediante pdf-lib y se extrajo su contenido. Contiene: IESTP Público Suiza, correlativo DEMO-RC-1, orden, concepto, importe aplicado124.00, efectivo recibido150.00, vuelto26.00, fecha/hora Perú y UUID del responsable. Incluye expresamente SIN MOVIMIENTO DE DINERO REAL y que no es boleta ni factura SUNAT.

No contiene explícitamente el DNI, nombre del ciudadano, código TUPA ni nombre legible del tesorero. Esos campos se proponen para nuevas emisiones; el PDF histórico se conserva intacto, junto con su hash y correlativo.

## Diseño propuesto

Una página A5 o media página A4, legible al imprimir, encabezado institucional y bloques compactos:

1. Instituto de Educación Superior Tecnológico Público «Suiza» — Tesorería.
2. RECIBO INTERNO DE TESORERÍA. Correlativo RC existente y versión de plantilla RC-v2. DEMO visible cuando corresponda.
3. Fecha y hora de recepción, zona America/Lima. No usar la fecha legal diferida de radicación como fecha del cobro.
4. Titular: nombres/apellidos o razón social que corresponda al modelo autorizado; tipo y número de documento. No incluir contraseña, correo innecesario ni otro dato sensible.
5. Procedimiento: código SUZ26 y denominación; concepto de pago; moneda PEN; importe aplicado según la orden inmutable y tarifa backend.
6. Dinero entregado por el ciudadano = efectivo recibido en caja. Vuelto entregado por el tesorero. Mostrar ambos separados del importe aplicado.
7. Código de orden OP y código de operación/recibo RC. CUT y expediente solo cuando ya existan; una orden previa no tiene CUT y no debe inventárselo.
8. TESORERO responsable: nombre institucional obtenido del backend e identificador del usuario; fecha y hora de confirmación. No inventar un funcionario designado ni utilizar el nombre enviado por React.
9. Leyenda: «Recibo interno de Tesorería. No sustituye boleta o factura electrónica ni acredita por sí mismo validez tributaria. No representa una operación bancaria».
10. Integridad: identificador de documento y verificación autorizada. No imprimir la capacidad secreta de acceso público ni una URL firmada reutilizable en un QR público.

Ejemplo exclusivamente del ensayo ya registrado: tarifa/aplicado S/124.00; entregado por el ciudadano S/150.00; vuelto S/26.00. No constituye un nuevo pago ni una tarifa de ejemplo inventada.

Para devoluciones, usar una constancia diferenciada: código DEV y referencia RD, pago/orden original, importe entregado en efectivo por TESORERO, motivo, aprobador/ejecutor, fechas y estado. Aprobación y entrega deben figurar separadas. No representar el importe devuelto como vuelto del cobro original.

## Numeración e integridad

Reutilizar los correlativos existentes; no reiniciarlos ni atribuir retrospectivamente una serie anual. Cualquier serie institucional futura requiere configuración y aprobación, sin cambiar los códigos RC/RD emitidos. La versión de plantilla identifica cambios de presentación, no reemplaza el identificador financiero.

Generar nuevas emisiones desde datos oficiales del backend, almacenar PDF y SHA-256 y mantener el acceso por titularidad/capacidad. Una reimpresión debe conservar el documento original; una corrección necesita constancia trazable, nunca sobrescritura silenciosa.

Pendiente: aprobación institucional de formato, denominación de serie y reglas de firma/acreditación. No se incorporó firma digital ni validez tributaria ficticia.
