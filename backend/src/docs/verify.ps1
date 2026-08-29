# 04_contratos_y_decisiones_pendientes.md

- **Responsable previsto:** B_AREVALO
- **Rama prevista:** B_AREVALO
- **Estado:** BORRADOR PENDIENTE DE REVISIÓN DEL RESPONSABLE
- **Alcance:** Matriz conceptual de dependencias inter-módulos y registro de riesgos.
- **Dependencias:** Coordinación y respuesta de los grupos propietarios (Grupos 1 al 5).
- **Fecha de revisión:** 29 de agosto de 2026

## Propósito y problema que resuelve
Consolidar un inventario conceptual de cómo el Grupo 1 interactuará con el resto. El Grupo 6 no posee decisiones confirmadas sobre los demás grupos; su labor aquí se limita a proponer, registrar y coordinar la resolución de las dependencias.

## Alcance y elementos fuera de alcance
**Alcance:** 
- Registro conceptual de qué datos consume RutaDoc y de quién.
- Listado de riesgos de interconexión propuestos.

**Fuera de alcance:** 
- Definir unilateralmente endpoints, formatos exactos o SLAs (esto es potestad de cada grupo productor).

## Definiciones
- **Contrato Conceptual:** Relación de necesidad de datos antes de definir el endpoint tecnológico exacto.

## Propuesta principal y reglas aplicables
**[PROPUESTA] Matriz Conceptual de Dependencias:**

| ID Contrato | Grupo Productor | Grupo Consumidor | Dato o capacidad | Propietario | Validación esperada | Tratamiento histórico | Estado | Pregunta pendiente |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CT-G2-G1-001` | G2 (Expedientes) | G1 (RutaDoc) | IDs de expedientes | G2 | Existencia y formato del identificador de expediente | Pendiente G2 | PROPUESTA | ¿UUID o secuenciales? |
| `CT-G3-G1-001` | G3 (Permisos) | G1 (RutaDoc) | Áreas y permisos | G3 | Existencia y vigencia del área; permiso aplicable pendiente | Pendiente G3 | PROPUESTA | ¿Se consultará por cada petición o vendrá en el payload central? |
| `CT-G4-G1-001` | G4 (Usuarios) | G1 (RutaDoc) | IDs de usuarios | G4 | Existencia y estado activo del identificador de usuario | Pendiente G4 | PROPUESTA | ¿Cómo se validará la existencia y vigencia del usuario sin duplicar sus datos? |
| `CT-G5-G1-001` | G5 (Documentos) | G1 (RutaDoc) | IDs de documentos | G5 | Existencia del documento y coherencia de la versión | Pendiente G5 | PROPUESTA | ¿Se permitirá descargar el archivo binario desde G1 o solo metadatos? |

**[PROPUESTA] Matriz de Riesgos:**

| ID Riesgo | Contrato Afectado | Riesgo Detectado | Responsable de coordinar la respuesta |
| :--- | :--- | :--- | :--- |
| `RI-INT-001` | `CT-G4-G1-001` | Referencia a un usuario inexistente o inactivo | B_AREVALO / Líder G4 |
| `RI-INT-002` | `CT-G5-G1-001` | Límite máximo de tamaño de archivo (pregunta separada del ID) | B_AREVALO / Líder G5 |

## Ejemplos ficticios marcados como [EJEMPLO]
*(Los contratos de arriba son identificaciones de necesidades reales, pero sus soluciones tecnológicas siguen siendo un [EJEMPLO]/[PROPUESTA] hasta ser validadas).*

## Dependencias con otros módulos
- Las decisiones requieren coordinación y respuesta de los grupos propietarios para convertirse en confirmadas.

## Decisiones y Estado
| Decisión | Estado | Fuente o evidencia de la decisión |
| :--- | :--- | :--- |
| Endpoints físicos y validaciones exactas de G1 a G5 | PENDIENTE | Ninguna |

## Fuentes técnicas consultadas
- (No aplican RFCs específicos para la organización de matrices).

## Fuentes o decisiones pendientes de comprobar
- Mecanismo en el que el Grupo 6 recopilará las respuestas formales de los líderes G2, G3, G4 y G5.
