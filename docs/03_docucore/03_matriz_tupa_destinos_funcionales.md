# MATRIZ MAESTRA DE DESTINOS FUNCIONALES TUPA 2026 (72 PROCEDIMIENTOS)
## SISTEMA INTEGRAL DE GESTIÓN DOCUMENTARIA (SIGD) — IESTP "SUIZA"

**Documento:** `03_matriz_tupa_destinos_funcionales.md`  
**Fase:** C1 — Matriz TUPA, Identidad y Estructura Funcional  
**Versión TUPA:** `TUPA-2026` (`c281022c-69b0-40b5-8cd4-6b25dea9af35`) — `VIGENTE`  
**Migración Canónica:** `backend/migraciones/46_sigd_tupa_destinos_funcionales.sql`  
**Código Fuente TS:** `backend/src/domains/tramicore/tupa72.destinos.ts`  

---

## 1. PRINCIPIO ARQUITECTÓNICO FUNDAMENTAL: NO INVENTAR ÁREAS

El SIGD distingue estrictamente entre:
```text
ÁREA FÍSICA CANÓNICA ≠ ROL DE SISTEMA ≠ PERFIL OPERATIVO ≠ FUNCIÓN ≠ CARGO
```

Las áreas físicas canónicas del instituto son exclusivamente:
1. **Dirección General (`DIR`)**: `a0000000-0000-0000-0000-000000000002`
2. **Subdirección Académica (`SDA`)**: `a0000000-0000-0000-0000-000000000001`

Queda terminantemente prohibido crear registros en `sigd_org.area` tales como `AREA_IDIOMAS`, `CENTRO_IDIOMAS`, `TESORERIA`, `MESA_PARTES`, `TITULACION`, `MATRICULA` o `PRACTICAS`.

### Estructura de Adscripción Funcional
```text
DIR (Dirección General)
 ├── Función Mesa de Partes (GESTOR_RECEPCION_DOCUMENTAL)
 ├── Función Tesorería (GESTOR_TESORERIA)
 ├── Función Administrativa / Comercial (GESTOR_ADMINISTRATIVO)
 └── Director General (Firma Directoral / Acto Administrativo Resolutivo)

SDA (Subdirección Académica)
 ├── Función Secretaría Académica
 ├── Función Idiomas (Centro de Idiomas / Certificaciones)
 ├── Función Titulación y Grados
 ├── Función Matrícula y Registros Académicos
 └── Función Prácticas / EFSRT (Supervisión Académica)
```

---

## 2. DEFINICIÓN DE LAS CUATRO UNIDADES ESTRUCTURALES

Para cada uno de los 72 procedimientos se configuran cuatro campos independientes en `sigd_doc.tupa_procedimiento`:

1. **Unidad Receptora (`unidad_receptora_id`)**:
   - Dependencia física por donde ingresa el trámite.
   - Dado que Mesa de Partes opera bajo `DIR`, se configura físicamente como `DIR`.
   - Función operativa asociada: `MESA_PARTES` / `GESTOR_RECEPCION_DOCUMENTAL`.

2. **Unidad Responsable (`unidad_responsable_id`)**:
   - Área sustantiva encargada de instruir, revisar técnicamente y elaborar los informes o dictámenes.
   - Trámites académicos instructivos: `SDA` (con perfil `GESTOR_AREA_ACADEMICA`).
   - Trámites comerciales, alquileres, producción y recepción directa: `DIR` (con perfil `GESTOR_ADMINISTRATIVO` o `GESTOR_RECEPCION_DOCUMENTAL`).

3. **Unidad Resolutiva (`unidad_resolutiva_id`)**:
   - Autoridad investida de la competencia formal para emitir el acto administrativo final.
   - Actos directorales (Resoluciones Directorales, Títulos Profesionales, Visaciones Oficiales, Certificados Oficiales suscritos por el Director): `DIR`.
   - Actos académicos de competencia interna (exámenes, convalidaciones internas, registros de notas, constancias simples): `SDA`.

4. **Unidad Financiera (`unidad_financiera_id`)**:
   - Dependencia que recauda y liquida los derechos económicos (Tesorería).
   - Físicamente adscrita a `DIR`.
   - Todos los 72 procedimientos de TUPA-2026 tienen arancel asignado (`monto >= S/ 4.00`), por lo que todos requieren intervención financiera (`intervencion_financiera = 'REQUIERE_PAGO'`).

---

## 3. FUENTES Y NIVELES DE CERTEZA (REGLA DE TRANSPARENCIA)

Ninguna inferencia funcional es presentada como normativa oficial externa. Cada clasificación registra su procedencia metodológica:
- `OFICIAL_CONFIRMADO`: Derivado directamente del TUPA 2026 aprobado (PDF oficial SHA-256 `377dd8e1...`) o de la Ley 30512 / TUO Ley 27444.
- `INFERENCIA_CONTROLADA`: Asignación funcional lógica indispensable para la operatividad del sistema sin crear entidades ficticias.
- `REFERENCIAL`: Propuesta adaptada sujeta a homologación institucional final.

---

## 4. CASO PILOTO: CERTIFICADO DE INGLÉS (`p1-fila-06`)

```text
Código de Referencia : p1-fila-06
Denominación         : Certificado de Inglés
Monto                : S/ 100.00
Unidad Receptora     : DIR (Mesa de Partes)
Unidad Responsable   : SDA (Instrucción por área de Idiomas / GESTOR_AREA_ACADEMICA)
Unidad Resolutiva    : DIR (Certificación oficial firmada por Dirección General)
Unidad Financiera    : DIR (Tesorería)
Intervención Finan.  : REQUIERE_PAGO
```

---

## 5. MATRIZ COMPLETA DE LOS 72 PROCEDIMIENTOS

| Ref | Denominación del Procedimiento | Rec | Resp | Perfil Responsable | Resol | Fin | Interv. | F. Resp | F. Resol | Confianza |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `p1-fila-01` | Prácticas Iniciales | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p1-fila-02` | Prácticas Intermedias | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p1-fila-03` | Prácticas Finales | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p1-fila-04` | EFSRT por cada Módulo (I, II, III, IV) | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p1-fila-05` | Certificado Modular (I, II, III, IV) | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p1-fila-06` | **Certificado de Inglés** | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Idiomas) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p1-fila-07` | Centro de Idiomas Básico (Alumnos) | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Idiomas) | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p1-fila-08` | Centro de Idiomas Básico (Externos) | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Idiomas) | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p1-fila-09` | Examen de Suficiencia Inglés/Portugués | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Idiomas) | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p1-fila-10` | CEPRETEC 2026 | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | MEDIA |
| `p2-fila-01` | Alquiler de Galpón Agrícola | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-02` | Alquiler de Retroproyector | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-03` | Alquiler de Aulas - Diario | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-04` | Alquiler de Cancha de Fútbol | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-05` | Alquiler de Ambientes de Alimentación | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-06` | Alquiler del Auditorio | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-07` | Alquiler de Laboratorio de Cómputo | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-08` | Venta Ambulatoria Diaria | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-09` | Venta de Mangos (Ciento) | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p2-fila-10` | Venta de Patos BB | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-01` | Venta de Patos Pichones | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-02` | Venta de Pati Pollos | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-03` | Venta de Patos Adultos Hembras | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-04` | Venta de Patos Adultos Machos | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-05` | Venta de Porcino para Consumo Kg | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-06` | Venta de Porcino en Pie Kg | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-07` | Venta de Ganado Vacuno en Pie Kg | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p3-fila-08` | Servicio de Empadre | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p4-fila-01` | Formulario Único de Trámite (FUT) | DIR | DIR | `GESTOR_RECEPCION_DOCUMENTAL` | DIR | DIR | REQUIERE_PAGO | `OFICIAL_CONFIRMADO` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-02` | Constancia de No Adeudar | DIR | DIR | `GESTOR_TESORERIA` | DIR | DIR | REQUIERE_PAGO | `OFICIAL_CONFIRMADO` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-03` | Trabajo de Aplicación Profesional | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p4-fila-04` | Examen de Suficiencia Profesional | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p4-fila-05` | Expedición de Título Profesional | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-06` | Certificado de Estudios Superiores | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-07` | Visación de Certificado de Estudios | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-08` | Caligrafiado de Título | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p4-fila-09` | Derecho de Formato de Título | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p4-fila-10` | Inscripción de Título | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-11` | Medallas de Graduación | DIR | DIR | `GESTOR_ADMINISTRATIVO` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | PROVISIONAL |
| `p4-fila-12` | Protector de Título | DIR | DIR | `GESTOR_ADMINISTRATIVO` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | PROVISIONAL |
| `p4-fila-13` | Ceremonia de Colación | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-14` | Protector de Certificado Modular | DIR | DIR | `GESTOR_ADMINISTRATIVO` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | PROVISIONAL |
| `p4-fila-15` | Modificación de Datos de Título | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p4-fila-16` | Derecho de Duplicado de Título | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-01` | Matrícula Regular | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Matrícula) | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-02` | Proceso de Admisión 2026 | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-03` | Guías del Postulante | DIR | DIR | `GESTOR_RECEPCION_DOCUMENTAL` | DIR | DIR | REQUIERE_PAGO | `OFICIAL_CONFIRMADO` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-04` | Admisión Titulados | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-05` | Reincorporación (Reingreso) | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Matrícula) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-06` | Constancia de Egresado | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-07` | Certificado de Bachillerato | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-08` | Constancias (Título, Estudios, Matrícula) | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-09` | Convalidación entre Planes | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-10` | Convalidación por Competencias | DIR | SDA | `GESTOR_AREA_ACADEMICA` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-11` | Devolución de Expediente | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-12` | Evaluación Extraordinaria (A) | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-13` | Evaluación Extraordinaria (RM 069) | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-14` | Examen de Recuperación | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-15` | Examen de Cargo | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-16` | Repitencia de Unidad Didáctica | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-17` | Repitencia de Semestre | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p5-fila-18` | Reserva de Matrícula (Ingresantes) | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Matrícula) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-19` | Licencia de Estudios (Regulares) | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Matrícula) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-20` | Traslado Interno | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Matrícula) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p5-fila-21` | Traslado Externo | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Matrícula) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p6-fila-01` | Demora Devolución Libro Biblioteca | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `REFERENCIAL` | MEDIA |
| `p6-fila-02` | Acceso a la Información Pública | DIR | DIR | `GESTOR_ADMINISTRATIVO` | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p6-fila-03` | Duplicados de Boletas / Síllabus | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p6-fila-04` | Titulación de Otros Institutos | DIR | SDA | `GESTOR_AREA_ACADEMICA` (Titulación) | DIR | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `OFICIAL_CONFIRMADO` | ALTA |
| `p6-fila-05` | Examen de Subsanación con Jurado | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p6-fila-06` | Prueba de Suficiencia Académica | DIR | SDA | `GESTOR_AREA_ACADEMICA` | SDA | DIR | REQUIERE_PAGO | `INFERENCIA_CONTROLADA` | `INFERENCIA_CONTROLADA` | ALTA |
| `p6-fila-07` | Carnets, Insignia y Distintivos | DIR | DIR | `GESTOR_RECEPCION_DOCUMENTAL` | DIR | DIR | REQUIERE_PAGO | `OFICIAL_CONFIRMADO` | `OFICIAL_CONFIRMADO` | ALTA |
