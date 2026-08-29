# SIGD · Grupo 2 "TramiCore" — Validación y Reglas del Módulo de Registro

## 1. Actores y Roles Definidos
* **Administrado / Solicitante (Externo o Interno):** Registra solicitudes por Mesa de Partes (presencial o virtual), aporta datos de contacto, adjunta requisitos y realiza seguimiento.
* **Operador de Mesa de Partes:** Valida requisitos y folios, apertura el expediente, asienta el ingreso en el Libro de Registro y emite el cargo oficial.
* **Especialista / Funcionario de Área Resolutora:** Revisa el fondo, emite informes/oficios, solicita subsanaciones o deriva el expediente.
* **Jefe de Área / Autoridad Institucional:** Suscribe el acto resolutivo final, autoriza reasignaciones y dispone el cierre o reapertura.
* **Administrador del Sistema SIGD:** Configura periodos de numeración, audita inmutabilidad y ejecuta anulaciones lógicas justificadas.

---

## 2. Identificadores Técnicos vs. Códigos Visibles
* **IDs Técnicos Internos (PK):** Administrados por PostgreSQL (`BIGSERIAL`). Nunca se exponen al usuario final ni se usan como códigos de ventanilla.
* **Códigos Visibles de Negocio:** Formato legible como `EXP-2026-000001`. Generados estrictamente mediante secuencias transaccionales atómicas (`SEQUENCE`), prohibiendo el uso de `MAX() + 1` para evitar concurrencia.

---

## 3. Matriz Funcional Propuesta

| Operación / Función | Entradas | Procesamiento / Reglas | Salidas | Estado Resultante | Responsable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registrar Trámite** | Remitente, destinatario, asunto, folios, PDF. | Valida requisitos, asigna ID, genera código visible y crea asiento global. | Expediente creado, Asiento emitido, Cargo. | `REGISTRADO` | Mesa de Partes |
| **Consultar Expediente** | Código visible o DNI/RUC. | Filtra por permisos y expone cronología de asientos. | Ficha de expediente y trazabilidad. | *(Sin cambio)* | Público / Funcionarios |
| **Corregir / Subsanar** | Escrito de subsanación. | Válido únicamente en estado `OBSERVADO`. No destruye historial. | Asiento de subsanación, documentos anexados. | `EN_TRAMITE` | Administrado / Mesa de Partes |
| **Derivar Expediente** | Cód. expediente, área destino, proveído. | Verifica tenencia activa y genera nuevo asiento de movimiento. | Notificación a receptora, Asiento derivación. | `EN_TRAMITE` | Especialista / Mesa de Partes |
| **Cerrar Expediente** | Documento resolutivo final, notificación. | Valida resolución y bloquea nuevos trámites ordinarios. | Expediente concluido, Asiento de cierre. | `CERRADO` | Jefe de Área Resolutora |
| **Reabrir Expediente** | Solicitud justificada, recurso legal. | Requiere validación de estado `CERRADO` y permiso de jefatura. | Expediente reactivado, Asiento reapertura. | `REABIERTO` | Jefe de Área / Admin |
| **Anular Registro** | Código de expediente, justificación formal. | Borrado lógico (`anulado = true`), mantiene auditoría. | Expediente invalidado, Asiento de anulación. | `ANULADO` | Administrador del Sistema |

---

## 4. Respuestas a Preguntas Pendientes (Definición Institucional)
1. **Diferencia entre trámite, expediente y asiento:** El *Trámite* representa la solicitud del ciudadano; el *Expediente* es el contenedor digital documentario; el *Asiento* es el registro inmutable de auditoría en el Libro General.
2. **Cardinalidad:** Un Trámite genera exactamente un Expediente (1:1), y un Expediente registra de 1 a N Asientos en su ciclo de vida.
3. **Formatos de Código:** El código de trámite/expediente sigue la estructura `EXP-[AÑO]-[CORRELATIVO 6 DÍGITOS]` (ej. `EXP-2026-000001`).
4. **Numeración de Registro:** El correlativo de asiento de registro es una secuencia global, ininterrumpida e inalterable generada por el sistema (`SEQUENCE`).
5. **Borrado y Corrección:** No existe borrado físico. Las correcciones generan un nuevo asiento de subsanación y las anulaciones aplican borrado lógico (`anulado = true`) conservando el historial.