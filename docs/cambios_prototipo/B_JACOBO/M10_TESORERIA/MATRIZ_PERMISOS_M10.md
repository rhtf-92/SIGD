## Estado vigente de la última fase (31/10/2026)

La ampliación pública está preparada en código, pero no activada ni verificada integralmente. No se ejecutaron migraciones ni reinicios. SUZ26-068 sigue pendiente; las otras 18 tarifas y los hechos financieros permanecen intactos. TESORERO sigue siendo el único rol administrativo vigente. Consulte [ULTIMA_FASE_CIERRE_M10.md](./ULTIMA_FASE_CIERRE_M10.md) y [FORMATO_RECIBO_INTERNO_M10.md](./FORMATO_RECIBO_INTERNO_M10.md).

El contenido siguiente es evidencia de las fases anteriores.

---

## Actualización vigente: efectivo y rol único — 31/10/2026

Esta actualización sustituye las decisiones anteriores sobre medios bancarios, cuatro roles y tarifas indiscriminadamente pendientes. Se conserva el contenido anterior como historial, no como política vigente. Fuente de cierre: [CIERRE_EFECTIVO_M10.md](./CIERRE_EFECTIVO_M10.md).

TESORERO es el único rol administrativo vigente y reúne los nueve permisos M10. Los otros tres roles permanecen inactivos para conservar historia. Backend consulta RBAC real, no confía en los roles declarados en JWT/React. La única asignación TESORERO es una identidad QA nueva; ningún trabajador preexistente recibió el rol.

---

# Permisos M10 — consolidación

Se comprobaron los cuatro roles existentes, sin crear roles adicionales ni asignarlos a usuarios reales.

| Rol | Capacidades financieras |
|---|---|
| CAJERO | LEER, PAGO_REGISTRAR |
| TESORERO | LEER, TARIFA_PROPONER, PAGO_VERIFICAR, DEVOLUCION_EVALUAR |
| SUPERVISOR_TESORERIA | LEER, REPORTES, TARIFA_VALIDAR, DEVOLUCION_EJECUTAR |
| APROBADOR_DEVOLUCIONES | LEER, REPORTES, DEVOLUCION_APROBAR |

Los nombres anteriores tienen prefijo TESORERIA_. El ciudadano solo opera sobre su propia orden/pago/devolución y no recibe lectura administrativa ni facultades de aprobación. ADMINISTRADOR no obtiene privilegios financieros implícitos. El JWT identifica cuenta; los permisos efectivos se obtienen de PostgreSQL. Cambiar roles en React no concede acceso.

Se conservan proponente/validador distintos, registrador/verificador distintos y evaluador/aprobador/ejecutor de devolución separados. Se corrigió el permiso del reintento de CERRADA para el ejecutor. La subsanación solo añade evidencia propia, no concede verificación. La constancia exige titularidad o TESORERIA_LEER y ejecución registrada.

Evidencia real: cero asignaciones financieras persistentes; 17 asignaciones de usuarios previas y sus huellas preservadas. Los actores administrativos de E2E fueron fixtures dentro de SQL revertido, con las definiciones de rol reales. No se compartieron credenciales ni se alteraron permisos institucionales.

Pendiente: Dirección debe autorizar titulares y suplentes, límites y reglas de aprobación. El propietario DDL actual de demo conserva capacidad de desactivar triggers; antes de producción se debe separar propietario/operador y autorizar el plan de privilegios. No se ejecutó DDL ni revocaciones para hacerlo en esta fase.
