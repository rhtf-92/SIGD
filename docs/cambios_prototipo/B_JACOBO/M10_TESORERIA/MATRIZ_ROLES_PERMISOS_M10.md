# Matriz de roles y permisos M10

Los seis roles previos se preservan. La migración 11 añade cuatro roles al catálogo y amplía de forma compatible su CHECK; no cambia el rol ni las asignaciones de ningún usuario existente.

| Capacidad | CAJERO | TESORERO | SUPERVISOR_TESORERIA | APROBADOR_DEVOLUCIONES | CIUDADANO |
|---|---|---|---|---|---|
| TESORERIA_LEER | Sí | Sí | Sí | Sí | No: solo operaciones propias |
| TESORERIA_PAGO_REGISTRAR | Sí | No | No | No | Solo su orden |
| TESORERIA_PAGO_VERIFICAR | No | Sí | No | No | No |
| TESORERIA_TARIFA_PROPONER | No | Sí | No | No | No |
| TESORERIA_TARIFA_VALIDAR | No | No | Sí | No | No |
| TESORERIA_DEVOLUCION_EVALUAR | No | Sí | No | No | No |
| TESORERIA_DEVOLUCION_APROBAR | No | No | No | Sí | No |
| TESORERIA_DEVOLUCION_EJECUTAR | No | No | Sí | No | No |
| TESORERIA_REPORTES | No | No | Sí | Sí | No |
| Solicitar devolución | No por rol | No por rol | No por rol | No por rol | Solo su pago verificado |

ADMINISTRADOR, DIRECTOR, SECRETARIO, ESPECIALISTA y MESA_PARTES no reciben permisos financieros automáticamente. Que una persona administre usuarios no significa que pueda verificar su propio pago. La cuenta debe tener un rol ciudadano para operar como titular y una capacidad financiera expresa para funciones institucionales.

## Segregación obligatoria del servidor

- Validador de tarifa distinto del proponente.
- Verificador de pago distinto del registrador y del ciudadano titular cuando corresponde.
- Evaluador, aprobador y ejecutor de devolución diferentes; ninguno resuelve su propia solicitud.
- Acción solo si el estado previo admite la transición; permisos enviados por React no se aceptan.
- El titular solo ve documentos asociados a su operación; el ID arbitrario no concede acceso.

La prueba integrada utilizó las definiciones reales de los nuevos roles con cuentas de fixture dentro de una transacción revertida. No dejó asignaciones financieras persistentes. Las 17 asignaciones previas conservan su huella antes/después.

## Decisiones institucionales pendientes

Dirección/Administración deben autorizar responsables, suplencias, límites de devolución, doble aprobación según importe y documentos exigibles. Tesorería debe definir evidencias de conciliación, entidad/referencia canónica y cierre/arqueo de caja. El esquema actual registra movimientos y reportes, pero no implementa un cierre contable certificado ni atribuye esas facultades al administrador técnico.

Para producción, separar propietario DDL y cuenta operativa PostgreSQL; los triggers protegen frente a operaciones ordinarias, no frente al propietario que pueda deshabilitarlos.
