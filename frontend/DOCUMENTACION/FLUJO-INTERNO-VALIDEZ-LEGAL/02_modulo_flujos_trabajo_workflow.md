# 02. Módulo de Flujos de Trabajo (Workflow Académico-Administrativo)

## 1. Introducción

El Módulo de Flujos de Trabajo automatiza el recorrido de cada trámite del instituto. En lugar de depender de la entrega física de expedientes entre oficinas, el sistema envía el trámite a cada instancia responsable en el orden definido, con las validaciones necesarias y el registro automático de la trazabilidad.

## 2. Especificidad IESTP

A diferencia de un sistema de trámite documentario genérico, en un instituto público de educación superior el router del trámite debe reflejar la estructura orgánica y regulatoria real:

* La **Secretaría Académica** verifica la información académica (notas, requisitos, expediente académico del estudiante).
* La **Administración** verifica los aspectos económicos (pagos, derechos de trámite, deudas pendientes).
* La **Dirección General** ejerce la aprobación final y suscribe la resolución, acta o certificado correspondiente.

Cada instancia actúa como una **etapa (nodo)** con su propia condición de avance: si la verificación falla, el trámite se observa y regresa; si cumple, deriva a la siguiente etapa.

## 3. Tipos de Trámites Modelados

| Tipo de Trámite | Flujo típico |
|-----------------|--------------|
| Solicitud de Título Profesional | Alumno → Secretaría Académica (verifica notas/expediente) → Administración (verifica pagos) → Dirección General (aprueba y resuelve) |
| Emisión de Certificado de Estudios | Alumno → Secretaría Académica → Administración → Dirección General |
| Expedición de Actas de Notas | Docente/Secretaría Académica → Registro → Dirección General |
| Resolución Directoral (ingreso, promoción, sanciones, acuerdos) | Área gestora → Secretaría Académica → Administración → Dirección General |
| Constancia de Egresado / Matrícula | Alumno → Secretaría Académica → Administración |

## 4. Ejemplo de Recorrido: Solicitud de Título

```text
Solicitud de Título
        │
        ▼
[1] Secretaría Académica
    • Verifica notas aprobatorias
    • Verifica expediente académico completo
    • Verifica requisitos legales
        │ aprueba
        ▼
[2] Administración
    • Verifica pagos y derechos de trámite
    • Verifica ausencia de deudas
        │ aprueba
        ▼
[3] Dirección General
    • Revisa el expediente completo
    • Aprueba la entrega
    • Dispone la emisión de la Resolución Directoral
        │
        ▼
    Se genera documento + Firma Digital (Módulo Paso 5)
```

Si en cualquier etapa la verificación falla, el sistema registra la **observación** y devuelve el trámite a la etapa anterior (o al solicitante) sin saltar ninguna instancia.

## 5. Estados del Trámite

* **Borrador / Iniciado:** el solicitante o el área crea el trámite aún no derivado.
* **Enviado / En trámite:** el expediente está circulando entre etapas.
* **En revisión:** la etapa actual está procesando el trámite.
* **Observado / Devuelto:** la etapa actual encontró un incumplimiento y requiere subsanación.
* **Aprobado:** todas las etapas autorizaron el avance.
* **Finalizado / Resuelto:** el trámite concluyó y se emitió el documento.
* **Anulado / Cancelado:** se desestimó el trámite por el solicitante o la autoridad.

## 6. Configuración de Flujos (Administrador)

* **Plantillas de flujo:** cada tipo de trámite se asocia a una secuencia de etapas configurable (orden, responsable, rol).
* **Etapas opcionales/obligatorias:** se define si una etapa puede omitirse según la ruta del trámite.
* **Roles y responsables:** cada etapa se enlaza a uno o varios usuarios con un rol (Secretaría Académica, Administración, Dirección).
* **Plazos (SLA):** cada etapa puede tener un plazo máximo de atención y recordatorios automáticos.

## 7. Funcionalidades del Frontend

* **Bandeja de trabajo (Inbox):** lista de trámites asignados al usuario, con filtros por estado, tipo y prioridad.
* **Detalle de trámite:** expediente completo, requisitos cargados, historial de pasos, observaciones.
* **Acciones por etapa:** Aprobar, Derivar, Observar, Rechazar, Devolver, Adjuntar documento.
* **Línea de tiempo visual (timeline):** muestra el recorrido del trámite con fechas y responsables.
* **Notificaciones:** alertas internas y por correo al cambiar de etapa o al requerir subsanación.
* **Búsqueda y seguimiento:** seguimiento por código de trámite del interesado.
