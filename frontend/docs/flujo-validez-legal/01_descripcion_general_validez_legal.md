| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-FLUJO-VALIDEZ-LEGAL-01 |
| **Módulo** | flujo-validez-legal / Flujo Interno de Trabajo y Validez Legal |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Geric, Jacobo, Jhasy |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 01. Descripción General y Objetivos — Flujo Interno y Validez Legal

## 1. Misión Institucional en el IESTP "Suiza"

El Instituto de Educación Superior Tecnológico Público "Suiza" (IESTP "Suiza"), ubicado en Pucallpa, Provincia de Coronel Portillo, Región Ucayali, gestiona una vasta actividad académica y administrativa orientada a la formación técnica superior de excelencia. En el ejercicio de sus funciones formativas e institucionales, emite actos administrativos y certificaciones oficiales —tales como Actas de Evaluación del Rendimiento Académico, Certificados Modulares y de Estudios, Títulos Profesionales Técnicos y Resoluciones Directorales— que demandan plena seguridad jurídica, autenticidad, integridad e inalterabilidad.

El Módulo de **Flujo Interno y Validez Legal** del Sistema Integral de Gestión Documentaria (SIGD) constituye el núcleo articulador del despacho institucional. Su propósito es garantizar que todo expediente transite de forma transparente y automatizada por las unidades orgánicas competentes, respetando el debido procedimiento administrativo y culminando en documentos electrónicos con valor probatorio idéntico o superior al soporte en papel, conforme al marco legal del Estado Peruano.

---

## 2. Principios Rectores y Marco Legal de Aplicación

La concepción, diseño e implementación de este módulo se fundamenta en los siguientes principios y cuerpos normativos:

1. **Principio del Debido Procedimiento Administrativo (TUO de la Ley N° 27444, D.S. N° 004-2019-JUS):**
   Garantiza que los administrados (estudiantes, egresados, docentes y ciudadanía) gocen de todos los derechos y garantías implícitos al procedimiento administrativo, asegurando que ninguna etapa sea omitida, que cada instancia fundamentada ejerza su competencia en los plazos previstos (SLA) y que los actos emitidos cuenten con motivación y respaldo documental.

2. **Principio de Celeridad y Eficacia (Ley N° 27444):**
   Elimina los trámites burocráticos redundantes mediante transiciones de estado automatizadas, notificaciones en tiempo real y bandejas de despacho digital que suprimen el traslado físico de expedientes entre pabellones del instituto.

3. **Ley de Firmas y Certificados Digitales (Ley N° 27269 y su Reglamento D.S. N° 052-2008-PCM):**
   Otorga a la firma digital emitida bajo la Infraestructura Oficial de Firma Electrónica (IOFE) la misma validez y eficacia jurídica que la firma manuscrita, garantizando **autenticidad** (vinculación inequívoca con el titular firmante), **integridad** (detección de cualquier alteración posterior) y **no repudio** (imposibilidad legal de desconocer la autoría).

4. **Ley de Gobierno Digital (D. Leg. N° 1412 y D.S. N° 029-2021-PCM):**
   Establece la interoperabilidad de servicios digitales, el uso preferente de documentos electrónicos firmados digitalmente y la verificación pública mediante Código de Verificación Digital (CVD).

5. **Oponibilidad Jurídica:**
   Los documentos emanados del SIGD cuentan con plena eficacia legal frente a terceros, incluyendo el Ministerio de Educación (MINEDU), la Dirección Regional de Educación de Ucayali (DREU), organismos de fiscalización técnica, entidades bancarias y empleadores públicos o privados.

---

## 3. Arquitectura Funcional del Módulo

El módulo se compone de dos subsistemas estrechamente integrados:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SISTEMA INTEGRAL SIGD - IESTP "SUIZA"                 │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 1. MOTOR DE FLUJOS (WORKFLOW FSM)    │ 2. MOTOR DE FIRMA Y VALIDEZ LEGAL    │
│  • Enrutamiento jerárquico           │  • Generación PDF desde plantilla    │
│  • Máquina de estados finitos (10 E) │  • Integración Refirma RENIEC (DNIe) │
│  • Control de plazos normativos      │  • Sellado de tiempo criptográfico   │
│  • Bandejas de trabajo por rol       │  • Código de Verificación Digital    │
│  • Trazabilidad y auditoría WORM     │  • Verificador público QR y URL      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

1. **Submódulo de Flujos de Trabajo (Workflow Académico-Administrativo):**
   Automatiza el ciclo de vida de los trámites mediante una Máquina de Estados Finitos (FSM) que orquesta las derivaciones entre la Secretaría Académica, la Dirección de Administración y la Dirección General, asegurando validaciones escalonadas y reglas de negocio estrictas.

2. **Submódulo de Creación de Documentos y Validez Legal:**
   Sintetiza la información académica y administrativa en documentos oficiales estructurados en PDF/A, coordina la firma digital mediante componentes acreditados por INDECOPI (Refirma RENIEC) e inserta metadatos de verificación digital (CVD y código QR).

---

## 4. Objetivo General

Implementar en la arquitectura frontend del SIGD (React 19, TypeScript 5.9 y Tailwind CSS 4) una interfaz robusta, accesible e intuitiva que permita modelar, ejecutar, monitorear y fiscalizar los flujos de trámites del IESTP "Suiza", facilitando la formulación, suscripción criptográfica, archivo inmutable y verificación pública de los documentos oficiales con pleno valor jurídico.

---

## 5. Objetivos Específicos

1. **Modelar los Flujos Operativos Académicos:** Mapear digitalmente los procedimientos de Solicitud de Título Profesional Técnico, Expedición de Certificados de Estudios, Emisión de Actas de Evaluación y Resoluciones Directorales.
2. **Garantizar la Jerarquía de Competencias:** Restringir las acciones operativas según la estructura orgánica del IESTP "Suiza" (Secretaría Académica valida méritos académicos; Administración valida derechos de tramitación; Dirección General aprueba y resuelve).
3. **Controlar Plazos y Niveles de Servicio (SLA):** Computar los plazos de atención conforme al horario hábil institucional (08:00 a 17:00 America/Lima) y corte de recepción a las 16:30 hrs, alertando desvíos o riesgos de caducidad procesal.
4. **Integrar la Firma Digital Oficial:** Incorporar en la experiencia de usuario la invocación segura a componentes de firma digital acreditados (Refirma RENIEC / DNIe), manteniendo aisladas las credenciales privadas y garantizando sellos de tiempo confiables.
5. **Implementar el Validador Público CVD:** Proveer un mecanismo universal de verificación que permita a cualquier administrado o entidad contrastar la autenticidad e integridad de un documento mediante código QR o ingreso directo del código alfanumérico CVD.
6. **Sostener la Trazabilidad Integral:** Registrar cada transición, firma, observación o derivación en el historial inmutable de auditoría, sincronizado con los identificadores globales de correlación (`X-Correlation-ID`).

---

## 6. Alcance Documental y Operativo

* **Alcance Incluido:**
  - Especificación formal de requisitos de interfaz de usuario (UI/UX) para las bandejas de trabajo y despacho.
  - Catálogo de componentes React 19 para visualización de líneas de tiempo (*timelines*), previsualización de documentos PDF, modales de firma digital y lectores de verificación CVD.
  - Definición de contratos de integración REST con el backend (`/api/v1/tramites/...`, `/api/v1/documentos/...`, `/api/v1/validador/...`).
  - Modelo relacional estructurado en DBML para soporte de etapas, trámites, firmas y correlativos institucionales.
* **Alcance Excluido:**
  - Custodia de claves privadas en el cliente (el frontend nunca almacena ni transmite llaves criptográficas de usuario).
  - Emisión de certificados digitales de personas (responsabilidad exclusiva de las Entidades de Certificación acreditadas por INDECOPI).
