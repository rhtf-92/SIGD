# Modelo de Datos IdentiCore v2.0

> **Implementación actual: BIGSERIAL/BIGINT, según `03_esquema_sigd_auth_v2.sql`.**
> Alineación documental realizada para mantener coherencia con la implementación.
> La decisión queda sujeta a validación de Jair/Grupo 4.
> El modelo es una vista conceptual; la referencia física es el SQL.

## 1. Resumen Ejecutivo
El modelo v2.0 de IdentiCore establece una jerarquía de entidades para la identificación unificada (Personas Naturales y Jurídicas), gestión de cuentas de usuario, sesiones concurrentes, apoderamiento legal y cumplimiento normativo (LPDP / Consentimiento de datos).

## 2. Diagrama de Entidades y Relaciones (PlantUML)

```plantuml
@startuml
skinparam class {
    BackgroundColor #FFFFFF
    HeaderBackgroundColor #2563EB
    BorderColor #2563EB
    FontColor #000000
    FontSize 12
}

entity "tipos_documento" as tipos_documento {
    + PK id : BIGSERIAL
    --
    codigo : VARCHAR(20) [UQ]
    nombre : VARCHAR(60)
    estado : BOOLEAN
}

entity "persona" as persona {
    + PK id : BIGSERIAL
    --
    FK tipo_documento_id : BIGINT
    numero_documento : VARCHAR(20)
    nombres : VARCHAR(120)
    apellido_paterno : VARCHAR(120)
    apellido_materno : VARCHAR(120)
    fecha_nacimiento : DATE
    genero : VARCHAR(1)
    telefono : VARCHAR(20)
    email_contacto : VARCHAR(150)
    estado : BOOLEAN
    tipo_persona : VARCHAR(20)
}

entity "persona_natural" as persona_natural {
    + PK id : BIGSERIAL
    --
    FK persona_id : BIGINT
    numero_documento : VARCHAR(20)
    nombres : VARCHAR(120)
    apellido_paterno : VARCHAR(120)
    apellido_materno : VARCHAR(120)
    fecha_nacimiento : DATE
    genero : VARCHAR(1)
    telefono : VARCHAR(20)
    email_contacto : VARCHAR(150)
    estado : BOOLEAN
}

entity "persona_juridica" as persona_juridica {
    + PK id : BIGSERIAL
    --
    FK persona_id : BIGINT
    razon_social : VARCHAR(200) [UQ]
    nombre_comercial : VARCHAR(200)
    partida_registral_sunarp : BIGINT
    estado : BOOLEAN
}

entity "representacion_legal" as representacion_legal {
    + PK id : BIGSERIAL
    --
    FK persona_natural_id : BIGINT
    FK persona_juridica_id : BIGINT
    vigencia_inicio : DATE
    vigencia_fin : DATE
    activo : BOOLEAN
}

entity "persona_documento_historial" as persona_documento_historial {
    + PK id : BIGSERIAL
    --
    FK persona_id : BIGINT
    FK tipo_documento_id : BIGINT
    numero_documento_anterior : VARCHAR(20)
    fecha_registro : TIMESTAMPTZ
    motivo : TEXT
}

entity "cuenta_usuario" as cuenta_usuario {
    + PK id : BIGSERIAL
    --
    FK persona_id : BIGINT
    username : VARCHAR(50) [UQ]
    email_login : VARCHAR(150) [UQ]
    password_hash : VARCHAR(255)
    estado : BOOLEAN
    intentos_fallidos : SMALLINT
    bloqueado_hasta : TIMESTAMPTZ
    ultimo_acceso : TIMESTAMPTZ
}

entity "sesion_usuario" as sesion_usuario {
    + PK id : BIGSERIAL
    --
    FK usuario_id : BIGINT
    token_refresh : VARCHAR(255)
    created_at : TIMESTAMPTZ
    expires_at : TIMESTAMPTZ
    ip_address : INET
    user_agent : TEXT
    last_ip : INET
    last_user_agent : TEXT
}

entity "consentimiento_datos" as consentimiento_datos {
    + PK id : BIGSERIAL
    --
    FK usuario_id : BIGINT
    fecha_aceptacion : TIMESTAMPTZ
    ip_address : INET
    version_termsoservicio : VARCHAR(50)
    aceptacion_notificaciones : BOOLEAN
    consentimiento_obfuscacion : BOOLEAN
}

entity "perfil_usuario" as perfil_usuario {
    + PK id : BIGSERIAL
    --
    FK persona_id : BIGINT
    FK cuenta_usuario_id : BIGINT NULL
    tipo_usuario : VARCHAR(20)
    condicion_registro : VARCHAR(20)
    area_id : BIGINT NULL
    cargo_id : BIGINT NULL
    rol_id : BIGINT NULL
    fecha_vigencia_inicio : DATE
    fecha_vigencia_fin : DATE
    estado : BOOLEAN
}

entity "auditoria_usuarios" as auditoria_usuarios {
    + PK id : BIGSERIAL
    --
    FK usuario_accion_id : BIGINT
    entidad_afectada : VARCHAR(40)
    entidad_id : BIGINT
    accion : VARCHAR(30)
    detalle : JSONB
    fecha : TIMESTAMPTZ
}

tipos_documento ||--o{ persona : "clasifica"
persona ||--o{ persona_natural : "extiende"
persona ||--o{ persona_juridica : "extiende"
persona ||--o{ persona_documento_historial : "historial"
persona ||--o{ cuenta_usuario : "posee"
persona_natural ||--o{ representacion_legal : "ejerce"
persona_juridica ||--o{ representacion_legal : "recibe"
cuenta_usuario ||--o{ sesion_usuario : "inicia"
cuenta_usuario ||--o{ consentimiento_datos : "consiente"
cuenta_usuario ||--o{ perfil_usuario : "asigna"
persona ||--o{ perfil_usuario : "vincula"
cuenta_usuario ||--o{ auditoria_usuarios : "audita"
tipos_documento ||--o{ persona_documento_historial : "versiona"
@enduml
```

## 3. Notas de alcance
* La especialización `persona` → `persona_natural` / `persona_juridica` es N:1 en SQL; la exclusividad total 1:1 requiere lógica transaccional PENDIENTE.
* `representacion_legal` garantiza dupla única y coherencia temporal básica, no anti-solapamiento por rango.
* `area_id` / `cargo_id` / `rol_id` son referencias conceptuales a OrganiCore, sin FK física.
* Cumplimiento Ley 29733 y bloqueo 5 intentos/15 min son lógica de aplicación, no constraints SQL.
