# Logs de Auditoría

## 1. Descripción

Los Logs de Auditoría son un mecanismo que permite registrar todas las
acciones importantes realizadas por los usuarios dentro del Sistema
Integral de Gestión Documentaria (SIGD).

Su principal objetivo es mantener un historial de las operaciones realizadas,
permitiendo conocer quién realizó una acción, qué acción realizó y cuándo
se realizó.

---

## 2. Objetivo

El objetivo de los Logs de Auditoría es garantizar la trazabilidad de las
acciones realizadas dentro del sistema y proporcionar evidencia para los
procesos de control y cumplimiento normativo.

---

## 3. Registro de acciones

El sistema debe registrar las acciones realizadas por los usuarios, como:

- Inicio de sesión.
- Cierre de sesión.
- Creación de registros.
- Modificación de registros.
- Eliminación lógica de registros.
- Consulta de información.
- Cambios realizados en la información del sistema.

Cada acción debe quedar registrada para poder consultar posteriormente
el historial de operaciones.

---

## 4. Información del registro

Cada Log de Auditoría debe contener información que permita identificar
la operación realizada.

| Campo | Descripción |
|---|---|
| `id` | Identificador único del registro |
| `usuario` | Usuario que realizó la acción |
| `accion` | Acción realizada |
| `modulo` | Módulo donde se realizó la acción |
| `fecha_hora` | Fecha y hora de la operación |
| `descripcion` | Detalle de la operación |
| `direccion_ip` | Dirección IP desde donde se realizó la acción |

---

## 5. Registro imborrable

Los Logs de Auditoría deben ser registros históricos que no puedan ser
eliminados ni modificados por los usuarios del sistema.

La información debe conservarse para garantizar la integridad y trazabilidad
de las operaciones realizadas.

Los usuarios normales no deben contar con permisos para eliminar o modificar
los registros de auditoría.

---

## 6. Trazabilidad

La trazabilidad permite conocer el historial de las acciones realizadas
dentro del sistema.

Por ejemplo:

```text
Usuario: usuario01
Acción: ACTUALIZAR
Módulo: Documentos
Fecha y hora: 02/09/2026 17:30
IP: 192.168.1.10
Descripción: Se actualizó información de un documento