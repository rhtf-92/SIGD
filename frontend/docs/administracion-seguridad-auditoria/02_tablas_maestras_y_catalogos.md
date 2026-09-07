| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-02 |
| **Módulo** | administracion-seguridad-auditoria / Administración, Seguridad y Auditoría |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Jhonatan Nijar Gonzales de Souza, Carlos Perea ("Gato"), Leonel Rivera Maxin ("Maxin"), Cristian Macedo |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 02. Tablas Maestras y Catálogos Paramétricos

## 1. Introducción y Rol en la Arquitectura Institucional

Las **Tablas Maestras** constituyen la columna vertebral de configuración del SIGD en el IESTP "Suiza". Almacenan los catálogos y entidades paramétricas indispensables para garantizar la coherencia semántica, la normalización de la correspondencia y la integridad referencial en todos los flujos de trabajo institucionales.

La gestión de estas tablas en el frontend está plenamente implementada y articulada a través del componente `frontend/src/pages/administracion/TablasMaestrasPage.tsx`, el cual provee una interfaz unificada basada en pestañas para la administración de:
1. **Sedes Institucionales:** Infraestructura física y locales oficiales.
2. **Organigrama Institucional (Áreas y Departamentos):** Unidades orgánicas jerárquicas y dependencias funcionales.
3. **Catálogo de Tipos Documentales:** Taxonomía de actos y comunicaciones oficiales.

---

## 2. Definición de Tipos e Interfaces en TypeScript

La interfaz del frontend se sustenta en modelos tipados estrictos definidos en `TablasMaestrasPage.tsx`:

```typescript
export type TipoTabla = "Sedes" | "Áreas" | "Tipos documentales";
export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: number;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
}
```

---

## 3. Catálogos Paramétricos Institucionales

### 3.1. Configuración de Sedes Físicas
Centraliza los locales y campus autorizados del instituto donde operan ventanillas de mesa de partes, despachos directivos y aulas tecnológicas:
* **Sede Principal (SED-001):** Campus central de Pucallpa (Av. Centenario Km 3.5), sede de la Dirección General, Secretaría Académica, Mesa de Partes Central y Archivo Central.
* **Propósito:** Define la sede geográfica de radicación del expediente y determina qué ventanilla física recepciona los documentos originales en soporte papel.

### 3.2. Organigrama Institucional (Áreas y Departamentos)
Mapea la jerarquía orgánica del IESTP "Suiza" para el correcto enrutamiento, derivación y custodia de expedientes:
* `ARE-001 - Dirección General`: Órgano de máxima autoridad resolutiva institucional.
* `ARE-002 - Secretaría Académica`: Órgano normativo y de registro académico de notas, títulos y expedientes.
* `ARE-003 - Mesa de Partes`: Órgano de recepción, foliación inicial y admisibilidad de trámites.
* `ARE-004 - Administración`: Gestión financiera, cobro de derechos y logística patrimonial.
* `ARE-005 - Archivo Central`: Custodia pasiva y custodia histórica conforme a directivas del AGN.
* `ARE-006 - Coordinación DSI (Desarrollo de Sistemas de Información)`: Unidad académica formativa.

### 3.3. Catálogo Oficial de Tipos Documentales
Estandariza los tipos de documentos admitidos y tramitados en el sistema, fijando su código nemotécnico y naturaleza procesal:
* `SOL (Solicitud)`: Escrito presentado por el administrado iniciando un trámite.
* `OFI (Oficio)`: Comunicación externa con otras entidades del Estado (MINEDU, DREU, GOREU).
* `MEMO (Memorando)`: Comunicación interna de gestión y coordinación entre jefaturas.
* `INF (Informe Técnico / Legal)`: Documento de sustento pericial o académico que fundamenta una decisión.
* `RD (Resolución Directoral)`: Acto resolutivo de máxima jerarquía institucional.
* `ACT (Acta de Notas / Evaluación)`: Registro oficial e inalterable de calificaciones semestrales.

---

## 4. Matriz de Impacto Cruzado en el Sistema

| Entidad Maestra | Módulos Impactados | Impacto en el Negocio y la Operación |
| :--- | :--- | :--- |
| **Sedes** | Mesa de Partes, Registro Documentario | Fija la jurisdicción física del ingreso del documento y la trazabilidad de recepción. |
| **Áreas** | Gestión de Expedientes, Flujo de Trabajo | Determina las bandejas de entrada (Inbox), las rutas permitidas de derivación y los responsables funcionales. |
| **Tipos Documentales** | Generación de Documentos, Foliado AGN | Normaliza las plantillas digitales, requisitos obligatorios, prefijos de correlativo y reglas de foliado. |
| **Usuarios** | Roles, Permisos y Auditoría | Asigna los privilegios operativos específicos y vincula la autoría en las pistas de auditoría inmutables. |

---

## 5. Reglas de Negocio y Garantía de Integridad Referencial

1. **Invariante de Borrado Lógico:** Queda estrictamente prohibida la eliminación física (`DELETE FROM ...`) de cualquier registro en las tablas maestras. La desactivación de un registro conmuta su estado a `"Inactivo"`.
2. **Protección de Históricos:** Si un área o tipo documental se desactiva, los expedientes históricos que la referencian conservan intacta su validez y trazabilidad en el visor de expedientes; únicamente se bloquea la selección del elemento inactivo para nuevas radicaciones o derivaciones.
3. **Unicidad de Códigos:** El código nemotécnico (`codigo`) es alfanumérico, normalizado en mayúsculas y único en su categoría para evitar ambigüedad en los prefijos de documentos oficiales.
