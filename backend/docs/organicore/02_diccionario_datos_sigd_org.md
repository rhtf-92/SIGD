# Diccionario de Datos - Módulo OrganiCore (`sigd_org`)

## Tabla: `sigd_org.area`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `area_id` | UUID | NOT NULL | PK | Identificador único gen_random_uuid() |
| `nombre` | VARCHAR(150) | NOT NULL | - | Nombre completo del área u oficina |
| `sigla` | VARCHAR(20) | NOT NULL | UNIQUE | Abreviatura oficial del área |
| `parent_id` | UUID | NULL | FK (`area.area_id`) | Identificador del área jerárquica superior |
| `path` | TEXT | NOT NULL | - | Ruta de jerarquía Materialized Path (ej. 'root.area1.area2') |
| `nivel_organizacional` | INT | NOT NULL | - | Nivel jerárquico dentro de la entidad |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo (Inactivación Lógica) |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha y hora de creación del registro |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha y hora de última modificación |

---

## Tabla: `sigd_org.cargo`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `cargo_id` | UUID | NOT NULL | PK | Identificador único gen_random_uuid() |
| `nombre` | VARCHAR(100) | NOT NULL | UNIQUE | Denominación formal del cargo |
| `descripcion` | TEXT | NULL | - | Detalle de funciones del cargo |
| `es_titular_despacho` | BOOLEAN | NOT NULL | DEFAULT false | Indica si ejerce la titularidad del despacho |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha de creación del registro |

---

## Tabla: `sigd_org.asignacion_area`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `asignacion_id` | UUID | NOT NULL | PK | Identificador único de la asignación |
| `cuenta_id` | UUID | NOT NULL | FK (`sigd_auth.cuenta_usuario`) | Referencia al usuario autenticado (IdentiCore) |
| `area_id` | UUID | NOT NULL | FK (`area.area_id`) | Área institucional asignada |
| `cargo_id` | UUID | NOT NULL | FK (`cargo.cargo_id`) | Cargo desempeñado |
| `fecha_inicio` | DATE | NOT NULL | - | Inicio de adscripción al área |
| `fecha_fin` | DATE | NULL | - | Fin de adscripción (NULL si está vigente) |
| `es_principal` | BOOLEAN | NOT NULL | DEFAULT true | Indica si es el área principal del usuario |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado de la asignación |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha de registro |

---

## Tabla: `sigd_org.encargatura_despacho`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `encargatura_id` | UUID | NOT NULL | PK | Identificador de suplencia/encargatura legal |
| `cuenta_id` | UUID | NOT NULL | FK (`sigd_auth.cuenta_usuario`) | Usuario que asume la función interina |
| `area_id` | UUID | NOT NULL | FK (`area.area_id`) | Área sobre la que ejerce el despacho |
| `cargo_id` | UUID | NOT NULL | FK (`cargo.cargo_id`) | Cargo asumido durante el periodo |
| `tipo_encargatura` | VARCHAR(30) | NOT NULL | - | Tipo: INTERINO, SUPLENTE, DELEGADO, ACCIDENTAL |
| `documento_sustento` | VARCHAR(120) | NOT NULL | - | Acto administrativo de respaldo (ej. Res. Dir.) |
| `fecha_inicio` | TIMESTAMPTZ | NOT NULL | - | Inicio del periodo de encargatura |
| `fecha_fin` | TIMESTAMPTZ | NOT NULL | - | Fin del periodo determinado |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado de la encargatura |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha de registro |

---

## Tabla: `sigd_org.rol_sistema`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `rol_id` | UUID | NOT NULL | PK | Identificador único del rol |
| `codigo` | VARCHAR(50) | NOT NULL | UNIQUE | Clave técnica (ej. 'ROL_MESA_PARTES') |
| `nombre` | VARCHAR(100) | NOT NULL | - | Nombre descriptivo del rol |
| `descripcion` | TEXT | NULL | - | Detalle de las capacidades del rol |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |

---

## Tabla: `sigd_org.permiso_sistema`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `permiso_id` | UUID | NOT NULL | PK | Identificador único del permiso |
| `codigo` | VARCHAR(80) | NOT NULL | UNIQUE | Clave de autorización (ej. 'tramite.derivar') |
| `modulo` | VARCHAR(50) | NOT NULL | - | Módulo del sistema al que pertenece |
| `descripcion` | TEXT | NULL | - | Descripción de la operación autorizada |
| `alcance_predeterminado` | VARCHAR(20) | NOT NULL | DEFAULT 'AREA' | Scope: AREA, SUBAREAS, GLOBAL |

---

## Tabla: `sigd_org.rol_permiso`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `rol_id` | UUID | NOT NULL | PK, FK (`rol_sistema.rol_id`) | Rol asociado |
| `permiso_id` | UUID | NOT NULL | PK, FK (`permiso_sistema.permiso_id`) | Permiso concedido |

---

## Tabla: `sigd_org.usuario_rol`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `cuenta_id` | UUID | NOT NULL | PK, FK (`sigd_auth.cuenta_usuario`) | Usuario asociado |
| `rol_id` | UUID | NOT NULL | PK, FK (`rol_sistema.rol_id`) | Rol asignado |
| `asignado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha de asignación del rol |