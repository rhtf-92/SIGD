# Diccionario de Datos - Módulo OrganiCore (`sigd_org`)

## Tabla: `sigd_org.area`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id_area` | UUID | NOT NULL | PK | Identificador único de área generado con `gen_random_uuid()` |
| `nombre` | VARCHAR(150) | NOT NULL | - | Nombre completo del área u oficina |
| `sigla` | VARCHAR(20) | NOT NULL | UNIQUE | Abreviatura oficial del área |
| `parent_id` | UUID | NULL | FK (`sigd_org.area.id_area`) | Área jerárquica superior |
| `path` | LTREE | NOT NULL | - | Ruta jerárquica materializada (`ltree`) |
| `nivel_organizacional` | INT | NOT NULL | - | Nivel jerárquico dentro de la estructura |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha y hora de creación |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha y hora de última modificación |

---

## Tabla: `sigd_org.cargo`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `cargo_id` | UUID | NOT NULL | PK | Identificador único del cargo |
| `nombre` | VARCHAR(100) | NOT NULL | UNIQUE | Denominación formal del cargo |
| `descripcion` | TEXT | NULL | - | Detalle de funciones del cargo |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |
| `creado_en` | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | Fecha de creación |

---

## Tabla: `sigd_org.asignacion_personal`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `asignacion_id` | UUID | NOT NULL | PK | Identificador único de la asignación |
| `cuenta_id` | UUID | NOT NULL | FK (`sigd_auth.cuenta_usuario`) | Usuario autenticado asociado |
| `id_area` | UUID | NOT NULL | FK (`sigd_org.area.id_area`) | Área institucional asignada |
| `cargo_id` | UUID | NOT NULL | FK (`sigd_org.cargo.cargo_id`) | Cargo desempeñado |
| `es_titular` | BOOLEAN | NOT NULL | DEFAULT true | Indica titularidad en el cargo |
| `vigencia` | TSTZRANGE | NOT NULL | - | Rango temporal de vigencia |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado de la asignación |

---

## Tabla: `sigd_org.encargatura_despacho`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `encargatura_id` | UUID | NOT NULL | PK | Identificador de suplencia o encargatura legal |
| `id_area` | UUID | NOT NULL | FK (`sigd_org.area.id_area`) | Área sobre la que se ejerce el despacho |
| `cargo_id` | UUID | NOT NULL | FK (`sigd_org.cargo.cargo_id`) | Cargo asumido durante el periodo |
| `facultad_despacho_id` | UUID | NOT NULL | FK (`sigd_org.facultad_despacho.facultad_id`) | Facultad asociada |
| `usuario_titular_id` | UUID | NOT NULL | - | Usuario titular de la función |
| `usuario_suplente_id` | UUID | NOT NULL | - | Usuario suplente o interino |
| `tipo_delegacion` | VARCHAR(40) | NOT NULL | - | Tipo: SUPLENCIA, DELEGADO, INTERINO |
| `resolucion_ref` | VARCHAR(120) | NOT NULL | - | Referencia documental de la resolución |
| `periodo_vigencia` | TSTZRANGE | NOT NULL | - | Rango temporal de la encargatura |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado de la encargatura |

---

## Tabla: `sigd_org.rol_sistema`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `rol_id` | UUID | NOT NULL | PK | Identificador único del rol |
| `codigo` | VARCHAR(50) | NOT NULL | UNIQUE | Clave técnica del rol |
| `nombre` | VARCHAR(100) | NOT NULL | - | Nombre descriptivo del rol |
| `descripcion` | TEXT | NULL | - | Detalle de capacidades |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |

---

## Tabla: `sigd_org.permiso_sistema`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `permiso_id` | UUID | NOT NULL | PK | Identificador único del permiso |
| `codigo` | VARCHAR(80) | NOT NULL | UNIQUE | Clave de autorización |
| `descripcion` | TEXT | NULL | - | Descripción de la operación |
| `alcance_predeterminado` | VARCHAR(20) | NOT NULL | DEFAULT 'AREA' | Alcance: AREA, SUBAREAS, GLOBAL |
| `activo` | BOOLEAN | NOT NULL | DEFAULT true | Estado activo/inactivo |

---

## Tabla: `sigd_org.rol_permiso`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `rol_id` | UUID | NOT NULL | PK, FK (`sigd_org.rol_sistema.rol_id`) | Rol asociado |
| `permiso_id` | UUID | NOT NULL | PK, FK (`sigd_org.permiso_sistema.permiso_id`) | Permiso concedido |

---

## Tabla: `sigd_org.usuario_rol`
| Campo | Tipo de Dato | Nulidad | Llave | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `cuenta_id` | UUID | NOT NULL | PK, FK (`sigd_auth.cuenta_usuario`) | Usuario asociado |
| `rol_id` | UUID | NOT NULL | PK, FK (`sigd_org.rol_sistema.rol_id`) | Rol asignado |
| `vigencia` | TSTZRANGE | NOT NULL | - | Rango temporal de vigencia del rol |