# 01. Análisis Funcional A: Objetivo, Actores y Flujo Normal

**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)
**Módulo:** Módulo de Gestión Documental y Expedientes - DocuCore
**Autor:** Azareño
**Rama Git:** `B_AZAREÑO`
**Entregable:** `docs/analisis-funcional/01_analisis_objetivo_actores_flujo.md`
**Destinatario:** Cristian (Modelado de Datos - `B_CHRISTIAN`)
**Fecha:** 29 de agosto de 2026
**Versión:** 1.1 — corregida para concordancia con `02_reglas_requisitos_adjuntos.md` (Valentín)

---

## 1. Objetivo del Módulo

DocuCore es el módulo del SIGD encargado de **configurar y capturar trámites documentarios**: define qué tipos de documento existen, qué formulario corresponde a cada uno, y recibe los datos que la persona ingresa al solicitarlo.

El problema que resuelve es evitar que cada nuevo tipo de trámite requiera programar un formulario desde cero. En lugar de eso, un administrador configura el tipo de documento, sus campos y sus requisitos, y el sistema genera el formulario automáticamente. Esto le da flexibilidad al SIGD para crecer sin depender de desarrollo a medida cada vez que la institución necesita un trámite nuevo.

Respecto a documentos y formularios, DocuCore cumple tres funciones:
1. **Configuración:** permite definir tipos de documento y sus formularios asociados.
2. **Captura:** presenta el formulario correcto al usuario y recoge los datos ingresados.
3. **Preparación del trámite:** entrega la información validada para que el expediente pueda crearse (a cargo del módulo de expedientes/requisitos, definido por Valentín).

---

## 2. Alcance

Este análisis cubre el objetivo del módulo, sus actores y el flujo normal de uso — es decir, el camino esperado cuando todo ocurre sin errores.

**No cubre:**
- Reglas de requisitos, archivos adjuntos ni casos excepcionales (ver `02_reglas_requisitos_adjuntos.md`, de Valentín).
- El modelo de datos ni el diccionario de datos (ver entregables de Cristian).
- La implementación técnica en base de datos (ver entregables de Piero).

---

## 3. Actores

| Actor | Responsabilidad |
|---|---|
| **Administrador de Trámites** | Crea tipos de documento y configura sus formularios (campos, orden, tipo de dato). Es quien define qué existe en el catálogo. |
| **Solicitante** | Selecciona un tipo de documento, llena el formulario correspondiente y envía el trámite. |
| **Evaluador** | Revisa la información y los requisitos enviados por el solicitante, y decide si el trámite avanza o queda observado. Este documento solo reconoce al actor y su vínculo con los datos capturados por el formulario; el detalle de sus decisiones (estados, reglas de aprobación/observación) pertenece al análisis de Valentín. |
| **Consultante** | Rol de solo lectura — puede revisar información de trámites ya existentes sin participar en su creación ni evaluación (ej. un área de estadísticas o auditoría interna). |

⚠️ Los nombres exactos de estos roles (¿"Administrador" o "Configurador"?, ¿"Solicitante" o "Ciudadano"?) son propuestas de trabajo, no una nomenclatura oficial confirmada — ver Sección 7.

---

## 4. Catálogo Preliminar de Documentos

Ejemplos preliminares de tipos de documento que el módulo debería poder representar:

- Solicitud.
- Certificado de estudios.
- Memorándum.

⚠️ **Esto es un catálogo de EJEMPLO**, no la lista oficial. Se eligieron por ser variados en estructura (uno simple, uno con datos académicos, uno interno), no porque representen necesariamente los trámites reales del SIGD. La lista oficial debe confirmarse con el profesor (ver Sección 7).

> **Nota de coordinación:** el documento de Valentín (`02_reglas_requisitos_adjuntos.md`) usa ejemplos de otro dominio (Licencia de Funcionamiento, Licencia Ambiental, Mesa de Partes). Ambos catálogos son ilustrativos y no se contradicen a nivel de modelo — pero como grupo conviene resolver con el profesor a qué tipo de institución corresponde el SIGD, para unificar los ejemplos en la entrega final.

> **Nota de coordinación (entidad `TRAMITE_PLANTILLA`):** el guion técnico de Valentín menciona una entidad pendiente `TRAMITE_PLANTILLA`, con nota de que proviene del "Módulo de Configuración de Trámites" — que es justamente el dominio que cubre este documento. Hipótesis de trabajo: `TRAMITE_PLANTILLA` **es la misma entidad** que aquí se describe como "tipo de documento" (la configuración del trámite: campos, formulario, requisitos asociados). Esto debe confirmarse con Cristian antes del modelado para no duplicar la entidad con dos nombres distintos — ver pregunta 5 en la Sección 7.

---

## 5. Flujo Normal

1. **Selección del tipo de documento:** el solicitante elige, de la lista de tipos de documento configurados, cuál trámite desea iniciar.
2. **Presentación del formulario:** el sistema recupera la configuración de ese tipo de documento y arma el formulario correspondiente (campos, orden, obligatoriedad de cada campo).
3. **Ingreso de datos:** el solicitante llena los campos del formulario.
4. **Verificación inicial:** el sistema valida que los campos obligatorios estén completos y que el formato de cada dato sea el esperado (ej. una fecha es una fecha, no texto libre).
5. **Preparación del trámite:** si la verificación es correcta, el sistema empaqueta los datos capturados y los entrega al módulo de expedientes para que se cree el trámite formal.

**Entrada del sistema:** el tipo de documento seleccionado y los valores ingresados en cada campo del formulario.
**Salida del sistema:** un conjunto de datos validado, listo para convertirse en expediente — o, si la verificación falla, un aviso indicando qué campo debe corregirse (el detalle de mensajes de error y casos excepcionales pertenece al análisis de Valentín).

> **Nota de coordinación con el flujo de Valentín:** el trámite que resulta de este flujo nace en estado `BORRADOR` — todavía no tiene código oficial de expediente. La radicación final (asignación del código `EXP-XXXX` y paso a `EN_REVISION`) ocurre recién cuando se cargan los requisitos y adjuntos obligatorios, según el flujo definido por Valentín. Este documento solo cubre hasta la creación del trámite en `BORRADOR`; lo que pasa después es responsabilidad de `02_reglas_requisitos_adjuntos.md`.

---

## 6. Fuentes Consultadas

- Documentación de patrones de formularios dinámicos/configurables (form builders) — para fundamentar por qué separar "tipo de documento" de "definición de campos" en vez de crear una tabla por cada trámite.
- Buenas prácticas de UX para formularios largos (agrupación de campos, validación en tiempo real) — para justificar por qué la verificación ocurre antes de enviar el trámite y no solo al final.

*(Fuentes específicas —enlaces y autores— pendientes de anexar; el criterio de selección y lo aprendido puede explicarse oralmente en la sustentación, según lo solicitado.)*

---

## 7. Preguntas Pendientes

1. ¿Cuál es la lista oficial de tipos de documento que maneja la institución? (Define si el catálogo final se parece más a los ejemplos de este documento o a los de Valentín — ver nota en Sección 4).
2. ¿Los roles "Administrador de Trámites", "Solicitante", "Evaluador" y "Consultante" corresponden a los roles reales del SIGD, o la institución ya tiene una nomenclatura definida?
3. ¿Un mismo formulario puede reutilizarse entre distintos tipos de documento, o cada tipo de documento tiene siempre su propio formulario exclusivo?
4. ¿Quién tiene permiso para crear o modificar tipos de documento — es un rol único o puede variar según el área de la institución?
5. ¿La entidad `TRAMITE_PLANTILLA` (mencionada en la especificación de Valentín) es la misma entidad que "tipo de documento" descrita en este análisis, o son dos conceptos distintos que Cristian debe modelar por separado? (Confirmar con Cristian antes del modelado — ver nota en Sección 4).
