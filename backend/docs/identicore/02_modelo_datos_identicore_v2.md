# Modelo de Datos IdentiCore v2.0

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

entity "persona" as persona {
    + PK id_persona : UUID
    --
    tipo_persona : VARCHAR(20)
    estado : VARCHAR(20)
    creado_en : TIMESTAMPTZ
}

entity "persona_natural" as persona_natural {
    + PK/FK id_persona : UUID
    --
    tipo_documento : VARCHAR(20)
    numero_documento : VARCHAR(20) [UQ]
    nombres : VARCHAR(100)
    apellido_paterno : VARCHAR(100)
}

entity "persona_juridica" as persona_juridica {
    + PK/FK id_persona : UUID
    --
    ruc : VARCHAR(11) [UQ]
    razon_social : VARCHAR(200)
}

entity "representacion_legal" as representacion_legal {
    + PK id_representacion : UUID
    --
    FK persona_juridica_id : UUID
    FK persona_natural_id : UUID
    cargo : VARCHAR(100)
    estado : VARCHAR(20)
}

entity "cuenta_usuario" as cuenta_usuario {
    + PK id_cuenta : UUID
    --
    FK persona_id : UUID [UQ]
    email : VARCHAR(150) [UQ]
    password_hash : VARCHAR(255)
    estado_cuenta : VARCHAR(20)
}

entity "sesion_usuario" as sesion_usuario {
    + PK id_sesion : UUID
    --
    FK cuenta_id : UUID
    refresh_token_hash : VARCHAR(255) [UQ]
    expira_en : TIMESTAMPTZ
}

entity "consentimiento_datos" as consentimiento_datos {
    + PK id_consentimiento : UUID
    --
    FK persona_id : UUID
    version_politica : VARCHAR(20)
    aceptado : BOOLEAN
}

entity "perfil_usuario" as perfil_usuario {
    + PK id_perfil : UUID
    --
    FK cuenta_id : UUID
    nombre_perfil : VARCHAR(50)
}

persona ||--|| persona_natural : "es"
persona ||--|| persona_juridica : "es"
persona ||--o| cuenta_usuario : "posee"
persona ||--o{ consentimiento_datos : "registra"
persona_juridica ||--o{ representacion_legal : "otorgada a"
persona_natural ||--o{ representacion_legal : "ejerce"
cuenta_usuario ||--o{ sesion_usuario : "inicia"
cuenta_usuario ||--o{ perfil_usuario : "asigna"
@enduml