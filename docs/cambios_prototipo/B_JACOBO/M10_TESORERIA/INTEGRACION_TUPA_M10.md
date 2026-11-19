## Estado vigente de la última fase (31/10/2026)

La ampliación pública está preparada en código, pero no activada ni verificada integralmente. No se ejecutaron migraciones ni reinicios. SUZ26-068 sigue pendiente; las otras 18 tarifas y los hechos financieros permanecen intactos. TESORERO sigue siendo el único rol administrativo vigente. Consulte [ULTIMA_FASE_CIERRE_M10.md](./ULTIMA_FASE_CIERRE_M10.md) y [FORMATO_RECIBO_INTERNO_M10.md](./FORMATO_RECIBO_INTERNO_M10.md).

El contenido siguiente es evidencia de las fases anteriores.

---

## Actualización vigente: efectivo y rol único — 31/10/2026

Esta actualización sustituye las decisiones anteriores sobre medios bancarios, cuatro roles y tarifas indiscriminadamente pendientes. Se conserva el contenido anterior como historial, no como política vigente. Fuente de cierre: [CIERRE_EFECTIVO_M10.md](./CIERRE_EFECTIVO_M10.md).

18 tarifas importadas y contrastadas; solo SUZ26-068 pendiente. Ninguna gratuidad institucional acreditada entre las18. No se modificaron el TUPA ni sus requisitos.

|Código|Importe S/|Condición|
|---|---:|---|
| SUZ26-031 | 16.50 | SUJETO_PAGO |
| SUZ26-034 | 105.00 | SUJETO_PAGO |
| SUZ26-035 | 124.00 | SUJETO_PAGO |
| SUZ26-036 | 16.00 | SUJETO_PAGO |
| SUZ26-044 | 269.00 | SUJETO_PAGO |
| SUZ26-045 | 309.00 | SUJETO_PAGO |
| SUZ26-050 | 300.00 | SUJETO_PAGO |
| SUZ26-051 | 31.00 | SUJETO_PAGO |
| SUZ26-052 | 42.00 | SUJETO_PAGO |
| SUZ26-053 | 23.00 | SUJETO_PAGO |
| SUZ26-054 | 46.50 | SUJETO_PAGO |
| SUZ26-055 | 46.50 | SUJETO_PAGO |
| SUZ26-056 | 21.00 | SUJETO_PAGO |
| SUZ26-063 | 66.00 | SUJETO_PAGO |
| SUZ26-064 | 66.00 | SUJETO_PAGO |
| SUZ26-065 | 309.00 | SUJETO_PAGO |
| SUZ26-066 | 412.00 | SUJETO_PAGO |
| SUZ26-068 | No determinado de forma única | PENDIENTE_VALIDACION |
| SUZ26-072 | 515.00 | SUJETO_PAGO |

---

# Integración TUPA M10 — catálogo efectivo 31/10/2026

Se consultó exclusivamente sigd_jacobo_demo en modo READ ONLY: 19 procedimientos vigentes y 3 inactivos heredados. M3/M10 usan sigd_doc.tipo_tramite_tupa y sus mismos UUID/códigos; no se creó otro catálogo ni se convirtieron conceptos informativos de Ventanilla en procedimientos radicables.

**Resultado financiero actual: 19 PENDIENTE_VALIDACION, 0 gratuitos acreditados y 0 tarifados aprobados en M10.** No significa que los 19 sean gratuitos. Hay importes declarados en descripciones, pero ninguna tarifa financiera aprobada con evidencia y segundo validador. El PDF TUPA citado no está en los recursos revisados de FOTOS; la investigación previa tampoco lo localizó. No se puede certificar de nuevo su procedencia documental.

| Código | Denominación registrada | Importe declarado, NO aprobado para cobrar | Condición M10 | Requisitos/documentos configurados | Vigencia |
|---|---|---|---|---|---|
| SUZ26-031 | Constancia de No Adeudar — para fines de titulación | S/ 16.50 (0.30 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-034 | Expedición de Título | S/ 105.00 (1.90 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-035 | Certificado de Estudios Superiores (6 semestres) | S/ 124.00 (2.24 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-036 | Visación de Certificado de Estudios Superiores | S/ 16.00 (0.29 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-044 | Modificación de Datos del Título | S/ 269.00 (4.88 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-045 | Derecho de duplicado de Título | S/ 309.00 (5.61 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-050 | Derecho de Reincorporación (Reingreso) | S/ 300.00 | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-051 | Constancia de Egresado | S/ 31.00 | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-052 | Certificado de Bachillerato | S/ 42.00 (0.75 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-053 | Constancias — de título, estudios o matrícula | S/ 23.00 (0.41 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-054 | Convalidación entre Planes de Estudios | S/ 46.50 (0.84 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-055 | Convalidación por Unidades de Competencia | S/ 46.50 (0.84 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-056 | Devolución de Expediente | S/ 21.00 (0.37 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-063 | Reserva de Matrícula — ingresantes | S/ 66.00 (1.20 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-064 | Licencia de Estudios — estudiantes antiguos | S/ 66.00 (1.20 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-065 | Traslado Interno | S/ 309.00 (5.61 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |
| SUZ26-066 | Traslado Externo | S/ 412.00 (7.48 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO; FUT: opcional; PDF FUT | Vigente |
| SUZ26-068 | Acceso a la Información Pública | El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente. | PENDIENTE_VALIDACION | FUT: opcional; PDF FUT | Vigente |
| SUZ26-072 | Titulación de Otros Institutos Tecnológicos | S/ 515.00 (9.35 % UIT vigente) | PENDIENTE_VALIDACION | COMPROBANTE_PAGO: opcional; PDF COMPROBANTE_PAGO | Vigente |

Los documentos son los configurados en el catálogo, no una certificación de suficiencia académica. “Opcional” no equivale a gratuidad. La unidad registrada es la cabecera general DIRECCIÓN GENERAL DE EDUCACIÓN SUPERIOR Y TÉCNICO PROFESIONAL; requiere confirmación de competencia específica. El concepto financiero está pendiente de propuesta/validación en todos los procedimientos. SUZ26-068 requiere aclarar importe y unidad de cobro: no se eligió un precio arbitrario.

Fuentes locales inspeccionadas:

- backend/carga_tupa_suiza_2026.sql — SHA-256 e5b5fe021492b8985baa0915ccc61b0d18fcc39785a3fff908de7a66cac5109a
- frontend/src/data/tupaSuiza2026.ts — SHA-256 e9fb0ecc1f02a042e1801b5e943d024b3b7d3fb1d8c0ce9fda5c0518f876373d

También se consultaron tipo_tramite_tupa, requisito, tipo_documento_requisito y tipo_documento. Evidencia completa: scratch/evidencias-m10/consolidacion-catalogo-esquema.json. No se modificaron SQL de carga, TypeScript TUPA, precios, requisitos ni registros institucionales.

## Fuente de verdad

El servidor usa versiones sigd_tes.tarifa VALIDADAS y vigentes en America/Lima. Exactamente una tarifa 0.00 significa GRATUITO; exactamente una positiva, SUJETO_PAGO; ausencia/ambigüedad, PENDIENTE_VALIDACION. El importe de la orden es un snapshot del servidor; el DTO rechaza importe/persona/roles adicionales del cliente.

La disponibilidad pública y la carga pública consultan esa condición, salvo la excepción demo comprobada. El núcleo de radicación la valida otra vez dentro de su transacción antes del CUT. Estos cambios backend permanecen sin activar por la prohibición de reinicio. Con la bandera actual demo=true, los 19 siguen habilitados para recepción demostrativa sin cobros ni falsos pagos.

Las tarifas 80.00 y 0.00 usadas en pruebas fueron fixtures revertidas y rotuladas, nunca tarifas institucionales guardadas ni propuestas para importar al catálogo real.
