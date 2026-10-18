# CP-GERIC-005 — Diagnóstico normativo, funcional y arquitectónico del SIGD

**Fecha de inspección:** 10 de octubre de 2026 (America/Lima). **Alcance:** lectura del árbol en `b46c270`; ninguna migración, seed, importación ni modificación funcional. **Naturaleza:** evaluación técnica para revisión de Geric, el profesor y la institución; no es asesoría jurídica ni certificación de cumplimiento. Las afirmaciones de los README e informes previos son hipótesis hasta cotejarlas con código, datos y fuente oficial.

## 1. Resumen ejecutivo

El monorepo conserva una estructura útil: SPA React, API Express, seis dominios backend, siete migraciones ordenadas, PostgreSQL por esquemas, outbox, S3 y Redis. Hay reglas reales para identidad, CUT, auditoría, transiciones y calendarios. Su operación conjunta aún no está demostrada. El bloqueo mayor para TUPA es contractual: `sigd_doc.tipo_tramite_tupa` usa `tipo_tramite_id` y `vigente`; radicación virtual busca `id_tipo_tramite_tupa` y `activo`, y la consulta pública une por el primer nombre inexistente. La ventanilla muestra el TUPA **Pasco**, el wizard tiene otra lista, y los seeds de BD asignan significados distintos a `TUPA-02/03`.

Las referencias legales también requieren depuración. El TUO de la Ley 27444 aprobado por D.S. 006-2026-JUS sustituyó la cita antigua de D.S. 004-2019-JUS. El reglamento de datos personales D.S. 003-2013-JUS fue derogado por D.S. 016-2024-JUS. El D.S. 070-2013-PCM trata de transparencia y acceso a información, no de firma digital ni de CVD; el D.S. 026-2016-PCM trata de infraestructura de firma digital, no aprueba el MGD. La Directiva 001-2019-AGN/DDPA trata del plan anual archivístico; la directiva de foliación localizada es 006-2019-AGN/DDPA. La R.J. 000073-2023-AGN/JEF localizada no regula foliación. Por ello, las etiquetas de «conformidad plena» del informe pericial previo no son prueba de validez jurídica ni de funcionamiento extremo a extremo.

**Criterio de estado:** «implementada» significa mecanismo visible en código/migración, no servicio operativo certificado; «parcial» significa que falta conexión, datos, autorización o prueba de recorrido; «contradictoria» significa choque comprobado de contratos o referencias; «pendiente institucional» significa que la regla depende de una aprobación no presente.

## 2. Línea base Git y worktree

| Elemento | Resultado |
|---|---|
| Repositorio fuente | `C:\Users\Geric\Desktop\WorkSpace\SIGD` |
| Rama y HEAD fuente | `B_GERIC`, `b46c270c5572c4663e7a434ca94031cf85537ecd` |
| Estado fuente | `git status --short`: vacío; Git no pudo leer el archivo global de exclusiones. |
| `git fetch --all --prune` | Falló: DNS no resolvió `github.com`; referencias remotas locales pueden estar desactualizadas. |
| Comparación local | `origin/B_GERIC` = HEAD; HEAD 2 commits delante de `origin/main`, 0 detrás (`0bae92f`, `b46c270`). |
| Worktree de inspección | `C:\Users\Geric\Documents\Codex\2026-10-10\pu\work\sigd-diagnostico-reglas`, HEAD separado en `b46c270`. Se eligió esta base porque contiene CP-GERIC-004 y los ajustes de demo que `origin/main` local no contiene. |
| Otros worktrees | Principal `B_GERIC`; `SIGD_GERIC_TUPA_AUDIT` separado y limpio; `SIGD_AUDIT_PANAIFO` en `B_PANAIFO` con `backend/src/app.ts.resolved` sin seguimiento. Ese archivo debe preservarse. |

## 3. Inventario documental y jerarquía de evidencia

El conteo se obtuvo con `git ls-files -- docs backend/docs frontend/docs`: **211 candidatos versionados**. Se excluyeron **44 artefactos generados o temporales** (directorios `logs/` y `logs_pruebas/`, más vistas `.png`/`.svg`) y **5 marcadores `.gitkeep`**. El inventario depurado del anexo B contiene **162 archivos**: `docs/` (5), `backend/docs/` (118) y `frontend/docs/` (39). Por ser rutas versionadas y filtradas, el conteo excluye `node_modules`, `dist`, `coverage`, temporales y archivos no seguidos. Entre los 162 hay 127 documentos `.md`, 8 fuentes de diagramas (`.drawio`, `.dbml`, `.mmd`), 26 SQL de referencia y 1 script de apoyo; **los SQL y el script no se cuentan como documentos narrativos**. Se revisaron además los cinco README, el informe pericial raíz, el plan de conmutación y CP-GERIC-001 a 004. Separadamente, se identificaron 7 migraciones ejecutables (`backend/migraciones/`), 147 rutas `backend/src/`, 236 `frontend/src/`, 62 `backend/tests/` y 42 `frontend/tests/` (los archivos de prueba dentro de `src/` se cuentan también en `src/`, por lo que estas cifras no son sumables). Configuración: dos Compose, dos ejemplos `.env`, dos `package.json` y dos lockfiles. No hay `AGENTS.md` versionado ni `.github/` en este checkout; `.agents/` contiene material auxiliar, no instrucciones `AGENTS.md`. Los enlaces del README a `PROJECT.md`, `AUDIT_MATRIX.md`, `TEST_READY.md`, `TEST_INFRA.md`, `INDICE_MAESTRO_DOCUMENTACION_SIGD.md` y `colaboradores.md` no se resuelven en este árbol ([README.md](../../../README.md), sección final). No se abrieron archivos `.env` reales; solo se constató la presencia de ejemplos sin copiar valores.

| Fuente | Valor probatorio y límite |
|---|---|
| `backend/migraciones/01`–`07` y runner | DDL ejecutable y seeds iniciales; no prueba que una base concreta esté migrada. |
| `backend/src`, `frontend/src` | Comportamiento codificado; algunas rutas dependen de configuración, servicios o mocks. |
| `backend/tests`, `frontend/tests` | Intención y cobertura de casos; no equivalen a una ejecución actual ni a validación legal. |
| `backend/docs/00_corelink` a `05_rutadoc`, `frontend/docs/01` a `06` | Modelos, planes, decisiones y criterios docentes; coexisten versiones e históricos. |
| CP-GERIC-004 | Auditoría TUPA previa útil; su afirmación de que no hay tabla de requisitos contradice `04_sigd_doc.sql:130-139`. Su PDF Suiza 2026 no está versionado en este checkout; no se contrastaron nuevamente los importes. |
| Informe pericial raíz y plan de conmutación | Declaran conformidad y pruebas históricas; esta inspección detecta contratos incompatibles y no valida esas cifras. |

## 4. Inventario normativo y verificación oficial

**Método:** búsqueda de las palabras solicitadas (ley, decreto, resolución, norma, reglamento, TUPA, UIT, procedimiento, plazo, silencio, expediente, trazabilidad, SLA, firma, documento, archivo, conservación, datos personales, consentimiento, seguridad, auditoría, notificación, interoperabilidad, transparencia, accesibilidad, ciudadano y administrado) en documentación, SQL y código. El anexo A registra archivos y líneas de los identificadores explícitos detectados por el patrón descrito allí, excluyendo este informe para evitar autorreferencias; no captura alusiones sin número ni variantes tipográficas no previstas. Se consultaron portales oficiales el **10-10-2026**. «Existencia verificada» se refiere a instrumento y materia; «vigencia» solo se afirma cuando la fuente oficial lo permite. La aplicabilidad y el artículo preciso requieren validación institucional. La tabla siguiente contiene **22 instrumentos contrastados con fuentes oficiales**; hay **4 referencias con verificaciones pendientes** detalladas debajo. No se certificó la vigencia integral frente a todas las modificatorias.

### 4.1. Instrumentos contrastados con fuentes oficiales (22)

| N.º | Denominación y número exactos | Entidad emisora | Fuente oficial | Existencia | Vigencia o cambio comprobado | Aplicabilidad al SIGD |
|---:|---|---|---|---|---|---|
| 1 | Ley del Procedimiento Administrativo General, **Ley N.º 27444** | Congreso | [MINJUSDH, TUO](https://www.gob.pe/institucion/minjus/informes-publicaciones/8441836-primera-edicion-oficial-del-texto-unico-ordenado-de-la-ley-n-27444-ley-del-procedimiento-administrativo-general-aprobado-por-el-decreto-supremo-n-006-2026-jus-actualizada-al-8-07-2026) | Sí | Vigencia verificada del TUO 2026; artículos concretos por cotejar | Directa, interpretación pendiente |
| 2 | Decreto Supremo que aprueba el TUO de la Ley 27444, **D.S. N.º 006-2026-JUS** | MINJUSDH / Poder Ejecutivo | [MINJUSDH](https://www.gob.pe/institucion/minjus/normas-legales/8169463-006-2026-jus) | Sí | Vigencia verificada: TUO 2026 publicado | Directa, interpretación pendiente |
| 3 | Decreto Supremo que aprobó el TUO anterior de la Ley 27444, **D.S. N.º 004-2019-JUS** | MINJUSDH / Poder Ejecutivo | [TUO sucesor, MINJUSDH](https://www.gob.pe/institucion/minjus/normas-legales/8169463-006-2026-jus) | Sí | Derogado como TUO por D.S. 006-2026-JUS; cita histórica | Indirecta, histórica |
| 4 | Ley de Protección de Datos Personales, **Ley N.º 29733** | Congreso | [Congreso](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470) | Sí | Vigencia integral no confirmada; modificaciones no auditadas | Directa, interpretación pendiente |
| 5 | Reglamento de la Ley 29733, **D.S. N.º 016-2024-JUS** | MINJUSDH / Poder Ejecutivo | [ANPD](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus), [vigencia ANPD](https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales) | Sí | Vigencia verificada desde 31-03-2025 según ANPD | Directa, interpretación pendiente |
| 6 | Reglamento anterior de la Ley 29733, **D.S. N.º 003-2013-JUS** | MINJUSDH / Poder Ejecutivo | [D.S. 016-2024-JUS, disposición derogatoria](https://www3.congreso.gob.pe/Docs/DGP/DIDP/files/ds_016-2024-jus.pdf) | Sí | Derogado por D.S. 016-2024-JUS | Indirecta, histórica |
| 7 | Ley de Firmas y Certificados Digitales, **Ley N.º 27269** | Congreso | [MINJUSDH](https://www.gob.pe/institucion/minjus/normas-legales/1792706-27269-2000) | Sí | Vigencia integral no confirmada; modificatorias sin consolidar | Directa, interpretación pendiente |
| 8 | Reglamento de la Ley de Firmas y Certificados Digitales, **D.S. N.º 052-2008-PCM** | PCM / Poder Ejecutivo | [PCM](https://www.gob.pe/institucion/pcm/normas-legales/292462-052-2008-pcm), [modificación PCM](https://www.gob.pe/institucion/pcm/normas-legales/292351-105-2012-pcm) | Sí | Modificado; vigencia de cada artículo no confirmada | Directa, interpretación pendiente |
| 9 | Decreto Supremo que modifica el Reglamento de Transparencia y Acceso a la Información Pública, **D.S. N.º 070-2013-PCM** | PCM / Poder Ejecutivo | [texto oficial alojado por SUNAT](https://www.sunat.gob.pe/legislacion/procedim/normasadua/normasociada/gja-00.02/ctrlCambios/anexos/DS.070-2013-PCM.pdf), [ficha estatal](https://www.gob.pe/institucion/gsru-amazonas/normas-legales/2078195-70-2013-pcm) | Sí | Vigencia autónoma no confirmada; reglamento base sustituido por D.S. 007-2024-JUS | Indirecta; **no es norma de firma/CVD** |
| 10 | Decreto Legislativo que aprueba la Ley de Gobierno Digital, **D. Leg. N.º 1412** | Poder Ejecutivo | [PCM](https://www.gob.pe/institucion/pcm/normas-legales/289706-1412) | Sí | Vigencia integral no confirmada; cambios posteriores sin consolidar | Directa, alcance institucional pendiente |
| 11 | Reglamento de la Ley de Gobierno Digital, **D.S. N.º 029-2021-PCM** | PCM / Poder Ejecutivo | [PCM](https://www.gob.pe/institucion/pcm/normas-legales/1705101-029-2021-pcm) | Sí | Modificado, entre otros, por D.S. 098-2025-PCM; texto consolidado pendiente | Directa, alcance institucional pendiente |
| 12 | Medidas para fortalecer la Infraestructura Oficial de Firma Electrónica e implementar progresivamente firma digital, **D.S. N.º 026-2016-PCM** | PCM / Poder Ejecutivo | [PCM](https://www.gob.pe/institucion/pcm/normas-legales/292321-026-2016-pcm) | Sí | Vigencia integral no confirmada | Indirecta; **no aprueba el MGD** |
| 13 | Resolución que aprueba el Modelo de Gestión Documental, **R.S.G.D. N.º 001-2017-PCM/SEGDI** | Secretaría de Gobierno Digital, PCM | [PCM](https://www.gob.pe/institucion/pcm/normas-legales/292301-001-2017-pcm-segdi) | Sí | Modificada en 2018; versión consolidada pendiente | Pendiente institucional para IESTP |
| 14 | Normas para la Elaboración del Plan Anual de Trabajo Archivístico de las Entidades Públicas, **Directiva N.º 001-2019-AGN/DDPA** | AGN | [AGN, resolución aprobatoria](https://www.gob.pe/institucion/agn/normas-legales/1114093-021-2019-agn-j) | Sí | Modificada en 2025; no trata de foliación | Indirecta, planificación archivística |
| 15 | Resolución que aprueba la Directiva 001-2019-AGN/DDPA, **R.J. N.º 021-2019-AGN/J** | AGN | [AGN](https://www.gob.pe/institucion/agn/normas-legales/1114093-021-2019-agn-j) | Sí | Modificada la directiva que aprueba; alcance actual por cotejar | Indirecta, no es base de foliación |
| 16 | Lineamientos para la foliación de documentos archivísticos de las entidades públicas, **Directiva N.º 006-2019-AGN/DDPA** | AGN | [AGN, resolución aprobatoria](https://www.gob.pe/institucion/agn/normas-legales/1114098-026-2019-agn-j) | Sí | Vigencia integral no confirmada; alcance digital por cotejar | Pendiente institucional |
| 17 | Resolución que aprueba la Directiva 006-2019-AGN/DDPA, **R.J. N.º 026-2019-AGN/J** | AGN | [AGN](https://www.gob.pe/institucion/agn/normas-legales/1114098-026-2019-agn-j) | Sí | Vigencia integral no confirmada; modificatorias no revisadas | Indirecta, base de foliación a validar |
| 18 | Resolución que designa responsables de acceso a información pública del AGN, **R.J. N.º 000073-2023-AGN/JEF** | AGN | [AGN](https://www.gob.pe/institucion/agn/normas-legales/4076902-000073-2023-agn-jef) | Sí | Vigencia actual de designaciones no confirmada | Indirecta; **no regula foliación ni CCD** |
| 19 | Ley de Institutos y Escuelas de Educación Superior y de la Carrera Pública de sus Docentes, **Ley N.º 30512** | Congreso | [MINEDU, publicación oficial de la ley](https://www.minedu.gob.pe/reforma-magisterial/pdf-ley-reforma-magisterial/ley-30512-institutos-escuelas-de-educacion-superior.pdf) | Sí | Modificada; texto consolidado no auditado | Directa, interpretación pendiente |
| 20 | Reglamento de la Ley 30512, **D.S. N.º 010-2017-MINEDU** | MINEDU / Poder Ejecutivo | [MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/274628-010-2017-) | Sí | Modificado; artículos actuales no cotejados | Directa, interpretación pendiente |
| 21 | Resolución que modifica los Lineamientos Académicos Generales, **R.VM. N.º 277-2019-MINEDU** | MINEDU | [MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/354248-277-2019-), [actualización de 2022](https://www.gob.pe/institucion/minedu/normas-legales/2946166-049-2022-minedu) | Sí | Modificada por R.VM. 049-2022; versión aplicable por confirmar | Directa, versión aplicable por confirmar |
| 22 | Ley que prohíbe la discriminación remunerativa entre varones y mujeres, **Ley N.º 30709** | Congreso | [Congreso, publicación oficial de la ley](https://www.leyes.congreso.gob.pe/Documentos/2016_2021/Boletin_de_Normas_Legales/NL20171227.pdf) | Sí | Vigencia integral no confirmada | Indirecta laboral; **no sustenta feriados** |

### 4.2. Cuatro referencias con verificación pendiente

1. **D. Leg. N.º 713.** Se verificó oficialmente que regula descansos remunerados del régimen laboral privado ([SUNAFIL](https://www.gob.pe/institucion/sunafil/noticias/1084901-si-estoy-de-vacaciones-y-sufro-un-accidente-mis-vacaciones-se-interrumpen)); falta demostrar qué disposiciones sirven al calendario de procedimientos del IESTP, su texto consolidado y los feriados regionales. `calendario.service.ts:6,187` le atribuye feriados nacionales.
2. **Ley N.º 29001.** El seed `backend/migraciones/03_sigd_org.sql:275-276` y `calendario.service.ts:7,192` la invocan para dos feriados de Ucayali. Falta fuente oficial del texto y vínculo jurídico de esos días; no debe validarse la regla por el número escrito en el código.
3. **R.VM. N.º 178-2018-MINEDU.** Se localizó la [resolución MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/221079-178-2018-) y la [actualización 049-2022](https://www.gob.pe/institucion/minedu/normas-legales/2946166-049-2022-minedu). Falta cotejar el anexo vigente y cada etapa/requisito de titulación o convalidación atribuido por la UI; la existencia de la norma sí está comprobada.
4. **Código Penal, artículo 411.** La advertencia aparece en `frontend/src/components/registro/DeclaracionJuradaCheckbox.tsx:35`. Falta cotejar texto y vigencia en versión oficial consolidada y validar que la advertencia concreta corresponda a la declaración del SIGD.

### 4.3. Síntesis por módulo y brechas

| Norma o referencia | Fuente oficial, entidad y estado comprobado | Tema atribuido por SIGD; evidencia y juicio |
|---|---|
| Ley 27444; D.S. 006-2026-JUS | [MINJUSDH, TUO 2026](https://www.gob.pe/institucion/minjus/normas-legales/8169463-006-2026-jus); [edición oficial actualizada 08-07-2026](https://www.gob.pe/institucion/minjus/informes-publicaciones/8441836-primera-edicion-oficial-del-texto-unico-ordenado-de-la-ley-n-27444-ley-del-procedimiento-administrativo-general-aprobado-por-el-decreto-supremo-n-006-2026-jus-actualizada-al-8-07-2026). TUO 2026 aprobado; comprobar numeración y alcance de arts. 20, 38, 138, 142/143 y 160 con asesoría institucional. | Corte, plazo, acumulación, notificación, TUPA. Código en `horarioCorte.util.ts`, `sla.service.ts`, `05_sigd_tra.sql`; **parcial** por contratos y base legal de horarios/feriados no acreditada. |
| D.S. 004-2019-JUS | Sustituido como TUO por el [D.S. 006-2026-JUS, MINJUSDH](https://www.gob.pe/institucion/minjus/normas-legales/8169463-006-2026-jus). | README aún lo presenta como texto rector; **contradictoria**. |
| Ley 29733; D.S. 016-2024-JUS | [Ley, Congreso](https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470); [reglamento, ANPD](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus); [ANPD: vigente desde 31-03-2025](https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales). | Consentimiento, finalidad, privacidad, casilla. `PersonaNaturalForm.tsx:314-352`, `02_sigd_auth.sql:120-133`; **parcial**, falta verificar política institucional y fundamento de notificación. |
| D.S. 003-2013-JUS | Derogado expresamente por la disposición derogatoria del [D.S. 016-2024-JUS](https://www3.congreso.gob.pe/Docs/DGP/DIDP/files/ds_016-2024-jus.pdf), Congreso/El Peruano. | Cita aún en README y documentación de casilla; **contradictoria**. |
| Ley 27269; D.S. 052-2008-PCM; D.S. 026-2016-PCM | [Ley, MINJUSDH](https://www.gob.pe/institucion/minjus/normas-legales/1792706-27269-2000), [reglamento, PCM](https://www.gob.pe/institucion/pcm/normas-legales/292462-052-2008-pcm), [medidas de firma, PCM](https://www.gob.pe/institucion/pcm/normas-legales/292321-026-2016-pcm). Evidencia oficial de existencia y materia; no se ha cotejado que CVD de 16 caracteres, QR o `refirma://` deriven de artículos concretos. | Firma y verificación: `firma.service.ts`, `cvdStamp.service.ts`, `validadorCvd.controller.ts`, `RefirmaConnectorModal.tsx`; **cumplimiento parcial observado; requiere validación institucional**. La [directiva PCM 002-2021-PCM/SGTD](https://www.gob.pe/institucion/pcm/normas-legales/2159126-002-2021-pcm-sgtd) sobre CVD es contexto adicional, fuera de los 22 instrumentos. |
| Ley 27806; TUO D.S. 021-2019-JUS; reglamento D.S. 007-2024-JUS | [TUO, MINJUSDH](https://www.gob.pe/institucion/minjus/normas-legales/1434443-021-2019-jus); [nuevo reglamento, MINJUSDH](https://www.gob.pe/institucion/minjus/noticias/955147-minjusdh-publica-nuevo-reglamento-de-la-ley-de-transparencia-y-acceso-a-la-informacion-publica). El D.S. 070-2013-PCM modificaba el reglamento anterior 072-2003-PCM; no es fundamento de firma. Estos textos actuales son contexto adicional y no aumentan la tabla de 22. | Transparencia y acceso a información: no se comprobó un recorrido institucional específico en SIGD; **interpretación pendiente y requiere validación institucional** de obligaciones, excepciones y responsables. |
| D. Leg. 1412; D.S. 029-2021-PCM | [Compendio PCM](https://www.gob.pe/institucion/pcm/tema/transformacion-digital/normas-legales), Ley y reglamento publicados; modificaciones posteriores deben cotejarse. | Gobierno digital, interoperabilidad y notificación; hay API y SSE, pero no se demostró PIDE ni entrega interinstitucional; **parcial**. |
| R.S.G.D. 001-2017-PCM/SEGDI | [modelo MGD, PCM](https://www.gob.pe/institucion/pcm/normas-legales/292301-001-2017-pcm-segdi); [orientación MGD, PCM](https://www.gob.pe/62913-implementar-el-modelo-de-gestion-documental-mgd). La resolución aprueba el MGD; el D.S. 026-2016-PCM pertenece a firma digital. | CUT, WORM, trazabilidad, indicadores. Migraciones 01, 05, 06, 07; **cumplimiento parcial observado**; obligatoriedad concreta para el instituto, **pendiente de validación institucional**. |
| Directiva 001-2019-AGN/DDPA; R.J. 021-2019-AGN/J | [AGN](https://www.gob.pe/institucion/agn/normas-legales/1114093-021-2019-agn-j): plan anual de trabajo archivístico, con modificación en [2025](https://www.gob.pe/institucion/agn/normas-legales/7011184-000221-2025-agn-jef). | El proyecto la usa como fundamento de foliación; **contradictoria** aunque existe mecanismo de foliado. |
| Directiva 006-2019-AGN/DDPA; R.J. 026-2019-AGN/J | [AGN](https://www.gob.pe/institucion/agn/normas-legales/1114098-026-2019-agn-j): lineamientos para foliación. | Fuente potencialmente pertinente **no citada en el código**; cotejar versión y alcance digital antes de cambiar la referencia. |
| R.J. 000073-2023-AGN/JEF | [AGN](https://www.gob.pe/institucion/agn/normas-legales/4076902-000073-2023-agn-jef): designación de responsables de acceso a información. | README y docs le atribuyen foliación/CCD; **contradictoria**. |
| Ley 30512; D.S. 010-2017-MINEDU; R.VM. 178-2018 y 277-2019-MINEDU | [reglamento, MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/274628-010-2017-), [RVM 277, MINEDU](https://www.gob.pe/institucion/minedu/normas-legales/354248-277-2019-), [marco sectorial](https://minedu.gob.pe/superiortecnologica/procedimiento-licenciamiento.php). Existencia verificada; vigente con modificaciones, artículo exacto y flujo de cinco etapas sin cotejo jurídico. | Titulación, convalidación, RD: `PlantillaResolucionEditor.tsx:30`, seeds `04_sigd_doc.sql:264-266`; **parcial / pendiente institucional**. |
| D. Leg. 713 | Referencia a feriados nacionales en `calendario.service.ts:6,187` y `slaCalculator.ts:23`; **no se verificó aquí** su texto actualizado ni que cubra los feriados regionales. | Calendario y SLA; **pendiente de validación**. |
| Ley 29001 | Solo seed `03_sigd_org.sql:275-276` y comentario `calendario.service.ts:7,192`; no se halló fuente oficial que vincule esa ley con feriados de Ucayali. | **No verificada** para esa regla, riesgo de calendario incorrecto. |
| Ley 30709 | [MTPE](https://www.gob.pe/institucion/mtpe/normas-legales/2253-002-2018-tr): discriminación remunerativa; `kpi.service.ts:9` la atribuye a feriados regionales. | **Contradictoria**; no sustenta ese calendario. |
| Código Penal, art. 411 | `README.md` y `DeclaracionJuradaCheckbox.tsx:35`; **no verificado** artículo ni texto actualizado. | Advertencia por declaración falsa; confirmar formulación con asesoría institucional. |

**Archivo y conservación documental:** la Directiva 006-2019-AGN/DDPA permite identificar una fuente de foliación, pero esta revisión no localizó una tabla de retención o política institucional aprobada que determine plazos de conservación, eliminación o transferencia para expedientes SIGD. El CCD visible en código no prueba aprobación archivística; **interpretación pendiente y requiere validación institucional** antes de asignar conservación automática. La R.J. 000073-2023-AGN/JEF no cubre esta brecha.

Normas reales, políticas internas y estándares deben mantenerse separados: `EXP-YYYY-XXXXXX`, corte 16:30, CVD de 16 caracteres, umbrales SLA, roles `DIRECTOR/ADMINISTRADOR`, RFC 7807/9457 y WCAG 2.1 AA son decisiones técnicas o referencias de estándar; su sola presencia en el README no demuestra que una norma peruana imponga exactamente esos valores.

## 5. Matriz de cumplimiento técnico

| Norma / artículo o tema | Fuente y estado | Menciones y módulo | Regla esperada | Evidencia real / pruebas | Estado, brecha y riesgo | Decisión y validador |
|---|---|---|---|---|---|---|
| Ley 27444, TUO 2026; corte y plazo | MINJUSDH, TUO 006-2026 | `README.md:101-113`, `backend/src/domains/tramicore/horarioCorte.util.ts`, `frontend/src/hooks/useHorarioCorte.ts`; TramiCore/RutaDoc | Registrar hora técnica y legal, calcular plazo según procedimiento y calendario aprobado | `radicacionVirtual.service.ts:174`, `sla.service.ts`; `cut.spec.ts`, `sla.spec.ts`, `useHorarioCorte.test.ts` | **Parcial**: corte fijo y feriados de fundamento incierto; riesgo de vencimiento inválido | Institución/asesoría jurídica aprueba horario y regla; Geric alinea contrato |
| Ley 27444; TUPA, silencio y requisitos | MINJUSDH, TUO 2026 | `backend/migraciones/04_sigd_doc.sql:16-32,130-139`, `backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md`; Docu/Trami | Catálogo aprobado con versiones, requisitos, calificación y plazos | Tabla y endpoint `tramites.controller.ts:64-88`; pruebas `tramiteTupaCatalog.test.ts`, `tramites.e2e.test.ts` | **Contradictoria**: columnas, códigos y procedencia Pasco; radicación bloqueable | Dirección/secretaría académica aprueba catálogo; Geric define contrato |
| Ley 29733 y reglamento 016-2024 | ANPD, vigente desde 2025 | `README.md:142`, `ConsentimientoLey29733Modal.tsx:45-53`; IdentiCore/UI | Información adecuada, tratamiento y registro de consentimiento | `02_sigd_auth.sql:120-133`; formularios y `ConsentimientoModal.test.tsx` | **Parcial**: aviso centrado en admisión/matrícula, uso SIGD más amplio; cita reglamento derogado | Responsable institucional de datos/ANPD interna |
| Ley 27269, reglamento 052-2008 y D.S. 026-2016 | MINJUSDH/PCM; materia de firma verificada | `frontend/docs/03_flujo-validez-legal`, `backend/src/domains/docucore`; DocuCore | Firma verificable, integridad, copia autenticable | Servicios de firma/CVD, `firma.service.spec.ts`, `cvdStamp.adversarial.spec.ts` | **Parcial**: pasarela `refirma://`, simulaciones y certificado real no comprobados; riesgo de falsa apariencia de firma válida | Profesor, oficina de firma/gestión documental |
| MGD 001-2017-PCM/SEGDI | PCM, modelo publicado | `README.md:114-125`, migraciones 01/05/06/07; transversal | Registro, trazabilidad, integridad, intercambio | Trigger WORM `01_sigd_audit.sql:87-127`, CUT `05_sigd_tra.sql:90-125`, outbox; pruebas unitarias | **Parcial**: no hay prueba actual de PIDE ni de adopción institucional; la aplicabilidad concreta no está acreditada | Dirección/gestión documental, profesor |
| AGN 001-2019 / 006-2019 / R.J. 073-2023 | AGN, materia de 001 y 073 contradice cita | `README.md:97-98,152`; `05_sigd_tra.sql:7,259`; RutaDoc/DocuCore | Foliación y CCD conforme a fuente correcta | Tabla folio y `foliacion.service.ts`, `foliadoValidator.test.ts` | **Contradictoria** la atribución jurídica; regla técnica parcialmente implementada | Archivo institucional y asesoría jurídica |
| Ley 30512 y lineamientos | MINEDU, publicados con modificatorias | `04_sigd_doc.sql:264-266`, `PlantillaResolucionEditor.tsx:30`; flujos académicos | Titulación/convalidación según procedimiento aprobado | Wizard y plantilla; `useWorkflowAcademico.ts:256` tiene bandeja demo | **Parcial**: equivalencias y etapas no validadas | Secretaría académica, profesor |

## 6. Matriz separada de reglas del sistema

En cada fila «origen» es la fuente local y línea; las pruebas nombradas son archivos presentes, **no resultados ejecutados**. En las 21 filas: **4 implementadas en código, 14 parciales, 2 contradictorias y 1 no implementada**. La fila de estados se cuenta como parcial aunque contiene una contradicción. Tablas y pantallas son relaciones de diseño, no evidencia de recorrido operativo.

| Regla y origen | Esperado / implementación real | Frontend; backend; tabla; prueba | Estado / conflicto / impacto TUPA |
|---|---|---|---|
| Roles y permisos: `backend/migraciones/03_sigd_org.sql:93-124,225-244` | RBAC desde BD; roles/permiso existen, pero `adminMaestras.routes.ts:19-21` reconoce middleware pendiente | `RbacGuard.tsx`, `useRbacConfig.ts:156-185`; `auth.guard.ts`; `sigd_org.rol_permiso`; `RbacGuard.test.tsx` | **Parcial**; no confiar solo en control UI para administrar TUPA |
| Autenticación: `backend/src/domains/identicore/auth.router.ts:6-8,92-114,144-192` | Access JWT y refresh rotatorio implementados | `authStore.ts`, `ProtectedRoute.tsx`; `sigd_auth.sesion_usuario`; `auth.router.spec.ts` | **Implementada en código**; revisar almacenamiento local y sesiones reales antes de habilitar TUPA |
| Estados/transiciones: `backend/migraciones/06_sigd_rut.sql:9-45`, `backend/src/domains/rutadoc/rutadoc.fsm.ts:1-45` | FSM y tabla de transiciones; `sigd_doc.expediente` y `sigd_tra.expediente` tienen estados/llaves distintos | Bandeja y timeline; `rutadoc.service.ts`; `sigd_rut.*`; `fsm.spec.ts` | **Parcial**; contradicción de identidad pendiente: decidir expediente canónico para enrutar TUPA |
| Concurrencia/idempotencia: `backend/migraciones/06_sigd_rut.sql:74-86,126-145`; `backend/src/audit/outbox-worker.ts:98-103` | Secuencia protegida, outbox con `SKIP LOCKED` | Bandeja; RutaDoc/outbox; `sigd_rut.movimiento_identidad`, `sigd_audit.evento_outbox`; `reversion.spec.ts` | **Implementada en código**; falta recorrido conjunto con expedientes TUPA |
| Trazabilidad e inmutabilidad: `backend/migraciones/01_sigd_audit.sql:18-37,87-127` | Bitácora append-only con trigger y permisos SQL | `ExpedienteTimeline.tsx`; `bitacora-auditoria.repository.ts`; `sigd_audit.bitacora_auditoria`; `e2e-06-contexto-auditoria.test.ts` | **Parcial** por timeline mock posible; TUPA debe emitir mismos eventos |
| Plazos/SLA: `backend/migraciones/04_sigd_doc.sql:23-28`, `backend/src/domains/rutadoc/sla.service.ts:1-30`, `frontend/src/utils/slaCalculator.ts:23` | Plazo por trámite y días hábiles; UI también usa umbrales genéricos de 30 días | `SlaBadge.tsx`; `sigd_org.calendario_laboral`; `sla.spec.ts`, `slaCalculator.test.ts` | **Parcial**; TUPA no debe heredar 30 días si su ficha aprobada dice otro plazo |
| Feriados: `backend/migraciones/03_sigd_org.sql:248-276`; `backend/src/domains/organicore/calendario.service.ts:6-7` | Calendario por DB y cómputo; seeds regionales con Ley 29001 no verificada | `CalendarioLaboralPage.tsx`; OrganiCore; `sigd_org.calendario_laboral`; `calendario.spec.ts` | **Contradictoria** base legal; validar calendario antes de prometer vencimientos |
| Corte 16:30: `frontend/src/hooks/useHorarioCorte.ts:1-16`, `backend/src/domains/tramicore/horarioCorte.util.ts:1-16` | Separar instante recibido e inicio legal; lógica duplicada cliente/servidor | Mesa de Partes y Ventanilla; TramiCore; expedientes; `useHorarioCorte.test.ts`, `cut.spec.ts` | **Parcial**; institución debe aprobar horario y zona horaria |
| CUT/foliación: `backend/migraciones/05_sigd_tra.sql:90-125,245-259`, `backend/src/domains/rutadoc/foliacion.service.ts:1-24` | CUT único y folios continuos; esquemas de expediente divergentes | `RegistroFoliado.tsx`; TramiCore/RutaDoc; `sigd_tra.expediente`; `RegistroFoliado.test.tsx` | **Parcial**; definir vínculo del trámite TUPA con folios y CUT |
| Clasificación documental: `backend/src/domains/rutadoc/ccd.service.ts:4-31`, `CcdTreeSelector.tsx` | CCD por serie aprobada; UI permite selección | RutaDoc, `sigd_doc.tipo_documento`; `CcdTreeSelector.test.tsx` | **Parcial**; clasificación de rubros TUPA exige decisión archivística |
| Requisitos y formularios: `backend/migraciones/04_sigd_doc.sql:52-62,130-139` | Tabla de requisitos y JSON Schema versionado; wizard usa `mockTupaSchema` (`useTramiteWizard.ts:190`) | `DynamicSchemaForm.tsx`; `schemaValidator.service.ts`; `sigd_doc.requisito/formulario_version`; `schemaValidator.spec.ts` | **Parcial**; el modelo existe, faltan requisitos Suiza aprobados y conexión |
| Catálogo TUPA: `backend/migraciones/04_sigd_doc.sql:16-29,261-267` | Códigos y UUID canónicos; tres seeds y dos catálogos UI diferentes | `VentanillaPresencialPage.tsx:4,371`, `StepDocumentos.tsx:41-71`; `tramites.controller.ts:64-88`; `sigd_doc.tipo_tramite_tupa`; `tramiteTupaCatalog.test.ts` | **Contradictoria**; bloqueador de selección/cobro |
| Tarifa Suiza versionada: `backend/migraciones/04_sigd_doc.sql:16-29`, `docs/cambios_prototipo/GERIC/CP-GERIC-004-auditoria-tupa-suiza.md:79-96` | Monto, UIT, unidad, rubro y año aprobados; columnas ausentes de la tabla | Ventanilla Pasco; endpoint TUPA; `sigd_doc.tipo_tramite_tupa`; sin prueba de tarifa Suiza | **No implementada**; impide publicar o cobrar el TUPA Suiza |
| Notificaciones/casilla: `backend/migraciones/02_sigd_auth.sql:169-207`, `backend/src/domains/identicore/casilla.router.ts:146` | Casilla y acuse; outbox disponible | `CasillaElectronicaPage.tsx`; `despachador-notificaciones.ts`; `sigd_auth.notificacion_casilla`; `casillaElectronica.test.tsx` | **Parcial**; efecto jurídico del depósito requiere validación |
| Adjuntos/S3: `backend/src/core/storage/storage.router.ts:47-68`, `backend/src/core/storage/s3-storage.service.ts:1-40` | URL firmada, verificación de archivo y persistencia; demoMode simula subida (`usePresignedUpload.ts:152-165`) | `FileUploadDropzone.tsx`; DocuCore; `sigd_doc.documento`; `magicBytes.spec.ts` | **Parcial**; prohibir cargo TUPA exitoso con `demo://` |
| Datos personales: `backend/migraciones/02_sigd_auth.sql:120-133`, `frontend/src/components/registro/PersonaNaturalForm.tsx:314-352` | Consentimiento y acceso delimitado; modal contiene finalidades restringidas | `ConsentimientoLey29733Modal.tsx:45-53`; IdentiCore; `sigd_auth.consentimiento_datos`; `ConsentimientoModal.test.tsx` | **Parcial**; revisar minimización, retención y finalidades TUPA |
| Auditoría: `backend/migraciones/01_sigd_audit.sql:18-37`; `backend/src/middleware/context-middleware.ts:4-14` | Correlation ID y asientos append-only; no se comprobó cobertura de todas las mutaciones | `useAuditLogs.ts`; backend audit; `sigd_audit.bitacora_auditoria`; `e2e-06-contexto-auditoria.test.ts` | **Parcial**; registrar cambios/versiones de tarifa TUPA |
| Errores RFC 7807: `backend/src/middleware/error-middleware.ts:10-41`, `backend/src/errors/error-mapper.ts:1-40` | API Problem Details; mapeadores visibles | `api/client.ts`; middleware; sin tabla; `error-mapper.test.ts` | **Implementada en código**; exigir errores TUPA sin éxito falso |
| Correlation ID: `backend/src/middleware/context-middleware.ts:4-14`, `frontend/src/api/client.ts:1-40` | Propagación petición/evento; rutas separadas pueden divergir | Cliente API; `sigd_audit.*`; `e2e-11-concurrencia-async-local-storage.test.ts` | **Parcial**; verificar continuidad en TUPA/S3/outbox |
| Persistencia/runner: `backend/src/db/migrate.ts:92-133` | SQL 01–07 ordenado, checksum; no se ejecutó contra BD | API; seis esquemas + `public.sigd_migraciones`; `migration.test.ts` | **Implementada en código**, estado de bases externas desconocido |
| Docker/servicios: `docker-compose.yml:3-97`, `docker-compose.demo.yml:4-78` | PostgreSQL, Redis, MinIO/S3 y API; demo no incluye MinIO | Config/env ejemplos; `database.ts`, storage, outbox; pruebas E2E usan contenedores | **Parcial**; disponibilidad y configuración real no inspeccionadas; demo no valida adjuntos S3 |

## 7. Arquitectura que debe conservarse

| Clase | Elemento con evidencia | Criterio para una futura extensión |
|---|---|---|
| A — invariante | Monorepo `frontend/`, `backend/`, SQL `01`–`07`; seis dominios montados en `backend/src/app.ts:180-250`; esquemas `sigd_audit/auth/org/doc/tra/rut` y runner con checksums `backend/src/db/migrate.ts:92-133` | Conservar estructura y archivos; añadir migraciones nuevas, no reescribir las ya aplicadas. |
| A — invariante | API `/api/v1`, autentificación JWT, errores, contexto, outbox y almacenamiento desacoplado | Mantener contratos externos o migrarlos mediante adaptador y pruebas. |
| B — extensible | `sigd_doc.tipo_tramite_tupa`, `requisito`, `formulario_version`, endpoint `/tramites/tipos` y alias `/tramites/tupa` | Agregar campos y versionado de tarifas/requisitos institucionalmente aprobados. |
| B — extensible | FSM/lecturas RutaDoc, CCD, calendario, componentes del wizard y ventanilla | Integrar por capas y preservar trazabilidad. |
| C — corregible | Consultas con columnas inexistentes, selección de UUID por primer resultado, diferencias de formato de expediente, middleware RBAC pendiente | Corregir dentro de servicios existentes o mediante adaptadores; probar el recorrido. |
| D — mock/fallback | `tupaPasco2026.ts`, `StepDocumentos.tsx:41-71`, `useTramiteWizard.ts:190`, `useBandejaExpedientes.ts:7-20`, `useExpedienteTimeline.ts:7-14`, `useWorkflowAcademico.ts:256`, `useCvdPublicVerification.ts:96,165-168`, `usePresignedUpload.ts:152-165`, `useTitulacionBackend.ts:5-68` | Retirar dependencia funcional al habilitar flujo real; conservar fixtures solo para pruebas/demos claramente aisladas. |
| E — decisión Geric | Expediente canónico (`sigd_doc` vs `sigd_tra`), API de catálogo, normalización código→UUID, cobertura de TUPA en Mesa/Ventanilla | Definir antes de distribuir tareas. |
| F — profesor/institución | TUPA Suiza aprobado, rubros admitidos, equivalencias, cobros, horario, calendario, texto legal, firma, política de datos | Aprobar fuente y responsables; no inferir de prototipo. |

## 8. Elementos corregibles sin cambiar arquitectura

1. Alinear consultas de radicación/consulta pública con DDL canónico mediante cambio interno o adaptador, con pruebas de integración de lectura/escritura.
2. Definir una respuesta de catálogo versionada que incluya código, UUID, denominación, requisitos, plazo, calificación, rubro, monto/unidad/UIT y vigencia, solo después de autorización institucional. `sigd_doc.requisito` ya existe, pero no hay monto/rubro/UIT/año tarifario en `tipo_tramite_tupa`.
3. Evitar selección de primer tipo o UUID fijo cuando no hay correspondencia exacta; devolver error claro y no emitir cargo.
4. Conectar bandeja, timeline, formulario y carga S3 a servicios reales preservando la estructura actual y las pruebas de fixtures.
5. Actualizar citas legales en docs/UI tras revisión de artículos concretos; la sustitución de una cita no demuestra por sí sola cumplimiento.

## 9. Contradicciones entre documentación y código

| Declaración | Evidencia que la limita o contradice |
|---|---|
| Informe pericial raíz: «conformidad plena», «cero fachadas/timers en producción», 1.043 pruebas aprobadas (`:1-8,435-545`) | `useBandejaExpedientes.ts:7-20`, `useExpedienteTimeline.ts:7-14`, `useWorkflowAcademico.ts:256`, `useCvdPublicVerification.ts:96,165-168` contienen mocks o retardo. No se reejecutó esa cifra histórica. |
| CP-GERIC-004: requisitos solo en texto libre (`:79-96`) | `04_sigd_doc.sql:130-139` contiene `sigd_doc.requisito`; el problema es poblar y conectar, no crear de cero. |
| README: corte 16:30 y 30 días como obligación general (`:101-113`) | `04_sigd_doc.sql:23-28` permite `plazo_dias` variable; fundamento legal del corte y feriados regionales requiere acuerdo. |
| README: reglamento de datos D.S. 003-2013-JUS y normas AGN para foliación (`:95-98,142,152`) | Fuentes oficiales de ANPD/AGN indican sustitución o materia distinta; ver §4. |
| README: Node 20 LTS (`:55`) | `frontend/package.json` exige Node `>=24.19.0 <25`; el entorno de inspección tiene Node 24.17.0. |

## 10. Cuatro bloqueos técnicos del TUPA: contrato esperado y real

| Bloqueo | Tipo o contrato esperado | Tipo o contrato real y evidencia concreta | Efecto observado por lectura |
|---|---|---|---|
| Columnas BD frente a radicación | `sigd_doc.tipo_tramite_tupa.tipo_tramite_id UUID` y `vigente BOOLEAN` (`backend/migraciones/04_sigd_doc.sql:16-29`); el endpoint usa ese contrato (`backend/src/domains/tramicore/tramites.controller.ts:67-80`). `sigd_tra.expediente` acepta las columnas de `backend/migraciones/05_sigd_tra.sql:90-106`. | `backend/src/domains/tramicore/radicacionVirtual.service.ts:122-124` consulta `id_tipo_tramite_tupa` y `activo`, columnas inexistentes. Su `INSERT` de `:174-180` usa `cut`, `id_persona`, `id_tipo_tramite_tupa` y otras columnas ausentes del DDL; `backend/src/domains/tramicore/consultaPublica.service.ts:164-165` también refiere una columna no declarada. | Incompatibilidad estática de lectura y escritura; error SQL probable. **No probado en ejecución.** |
| Identidad de expediente | Identificador canónico compartido o adaptador explícito entre DocuCore, TramiCore y RutaDoc; relación de tipo TUPA comprobable. | `sigd_doc.expediente.expediente_id UUID` (`backend/migraciones/04_sigd_doc.sql:86-105`); `sigd_tra.expediente.expediente_id UUID` es **otra tabla** y no contiene FK TUPA (`backend/migraciones/05_sigd_tra.sql:90-106`); `sigd_rut.movimiento_secuencia`, `movimiento_identidad`, `movimiento_tramite` y `estado_actual_expediente` usan `expediente_id BIGINT` (`backend/migraciones/06_sigd_rut.sql:74-91,313-314`). | UUID y BIGINT no son intercambiables; falta homologación de identidad y vínculo. **No probado en ejecución.** |
| Códigos `TUPA-02` y `TUPA-03` | `codigo VARCHAR(30)` con semántica única que se resuelva a `tipo_tramite_id UUID`, sin selección por posición. | El wizard declara `TUPA-02` como constancia y `TUPA-03` como título (`frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx:41-71`); el seed declara `TUPA-02` como título, UUID `...0002`, y `TUPA-03` como convalidación, UUID `...0003` (`backend/migraciones/04_sigd_doc.sql:261-267`). `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx:121-145` elige el primer tipo o UUID `...0001` si no encuentra coincidencia. | El mismo código `string` puede representar otro procedimiento y enviar un UUID incorrecto; requiere tabla de equivalencias aprobada. |
| Catálogo Pasco visible | Ficha Suiza 2026 aprobada/versionada, con código, denominación, importe, unidad y tipo UUID correspondientes. | `frontend/src/data/tupaPasco2026.ts:1-13` define datos Pasco; `frontend/src/pages/tramite/VentanillaPresencialPage.tsx:4,318-320,371-375` los muestra, incluido costo; `backend/src/domains/tramicore/ventanillaPresencial.service.ts:134` admite UUID fijo `...0001`. Fuente UI: catálogo local `string`/número; persistencia esperada: `tipo_tramite_id UUID` (`backend/migraciones/04_sigd_doc.sql:17`). | La pantalla muestra valores de otra institución; identidad y tarifa Suiza no acreditadas. |

Además hay tres fuentes de datos sin dueño/versionado común: `frontend/src/data/tupaPasco2026.ts`, `frontend/src/mocks/tramitesTupaMock.ts` y los seeds de `backend/migraciones/04_sigd_doc.sql:261-267`. Los tipos esperados son contratos propuestos para una futura homologación, **no decisiones institucionales aprobadas**.
## 11. Diagnóstico específico del TUPA Suiza 2026

La tabla `sigd_doc.tipo_tramite_tupa` modela código, denominación, descripción, unidad, plazo, silencio, base legal y `vigente`; `sigd_doc.requisito` y `formulario_version` ya modelan requisitos y formulario por tipo. Faltan monto, moneda, porcentaje UIT, unidad de cobro, rubro, año/intervalo tarifario y procedencia/aprobación del catálogo. Los tres UUID seed son `...0001` certificado, `...0002` título, `...0003` convalidación (`04_sigd_doc.sql:261-267`); la ruta frontend puede enviar cualquiera de ellos, el primer tipo devuelto o `...0001` según coincidencia/error (`StepConfirmacion.tsx:121-145`). No se comprobó un UUID real desde una sesión ejecutada.

CP-GERIC-004 documenta un PDF local Suiza 2026 con SHA-256, pero ese PDF no está en el checkout y sus importes no se verificaron de nuevo. Su comparación sugiere que certificados, titulación, convalidación, traslado y quizá prácticas/EFSRT son candidatos documentarios; el **total de titulación** es suma, no procedimiento unitario. Matrícula y conceptos académicos pueden requerir expediente o circuito de tesorería según decisión. Alquileres, venta de bienes y actividades productivas parecen rubros de ingreso, no se debe presumir que sean expedientes SIGD. Cada fila necesita clasificación aprobada por Secretaría Académica, Tesorería y Dirección; tampoco se debe inferir silencio/plazo o cobro por la etiqueta.

**Bloqueos antes de cargar TUPA:** documento Suiza autenticado/versionado; clasificación de filas; contrato código/UUID/importe/unidad; reparación de columnas inexistentes; expediente canónico y enlace RutaDoc; requisito/formulario por procedimiento; decisión de cobro; calendario y textos normativos validados. La existencia de FSM RutaDoc no demuestra que pueda recibir los expedientes creados hoy por TramiCore, dada la incompatibilidad UUID/BIGINT anterior.

## 12. Implicaciones por módulo

| Módulo | Implicación |
|---|---|
| IdentiCore | Identidad, consentimiento y casilla deben usar finalidad y canales aprobados; no equiparar casilla generada con notificación legal válida automáticamente. |
| OrganiCore | Responsable, área, permisos y calendario afectan plazos y administración del catálogo; exigir autorización servidor. |
| DocuCore | Requisitos y formulario ya tienen tablas; asociar versiones, adjuntos reales, integridad y firma según procedimiento. |
| TramiCore | Resolver columnas y UUID; radicar solo un tipo aprobado y producir CUT/cargo veraz. |
| RutaDoc | Acordar identidad de expediente, FSM, foliación y trazabilidad antes de derivar filas TUPA. |
| CoreLink | Auditar cambios de catálogo, eventos y errores; indicadores no deben contar datos demo como trámites reales. |
| Frontend | Un catálogo único, lenguaje claro, estados de carga/error, costos y plazos por ficha; quitar fallbacks silenciosos. |

## 13. Experiencia de usuario, riesgos y decisiones

**Automatizar:** cómputo de fecha legal, plazo aprobado, obligatoriedad de requisito, validación de UUID, comprobación de archivo y transiciones. **Explicar en lenguaje claro:** por qué falta un documento, cuándo inicia el plazo y cuál es la unidad exacta de cobro. **Ayuda contextual:** citas de Ley 27444, Ley 29733 y normas de firma, tras revisar artículos. **Advertencias obligatorias candidatas:** consentimiento, declaración jurada, importe y condiciones de notificación según texto aprobado. **Confirmación humana:** elección de procedimiento, aceptación de declaración y pago, decisión de derivación/archivo y equivalencias dudosas. La UI actual repite leyes en identificación, consulta, validador y confirmación (`StepIdentificacion.tsx:181`, `ConsultaPublicaPage.tsx:95,170`, `ValidadorPublicoCvdPage.tsx:330-332`, `StepConfirmacion.tsx:264`) y muestra `Timestamp legal` técnico al ciudadano (`MesaPartesVirtualPage.tsx:230-231`); simplificar sin ocultar fundamento.

| Riesgo | Prioridad | Decisión necesaria |
|---|---|---|
| Catálogo Pasco o UUID equivocado asociado a trámite Suiza | Crítica | Suspender homologación automática hasta aprobar correspondencias. |
| SQL con columnas inexistentes y tres identidades de expediente | Crítica | Elegir contrato canónico y estrategia de migración/adaptador. |
| Citas legales incorrectas o derogadas, feriados sin sustento | Alta | Validación jurídica/archivística y revisión de plazos. |
| Demo de S3, firma, bandeja o validador presentado como éxito real | Alta | Señalizar demo y probar recorrido productivo aislado. |
| Roles UI sin guard servidor en administración | Alta | Completar autorización antes de permitir edición de TUPA. |

**Geric debe decidir:** 1) contrato y dueño del catálogo; 2) expediente canónico y vínculo RutaDoc; 3) orden de corrección de rutas; 4) criterio de retirar mocks; 5) puerta de aceptación para cada recorrido. **Profesor/institución deben decidir:** alcance de filas TUPA, equivalencias, tasas/unidades/UIT y vigencia, autorización de cobros, titular que publica catálogo, jornada/feriados, textos de datos/notificación, archivo y firma, y si el prototipo puede mostrar una simulación de valor legal.

## 14. Criterios para futuras tareas y orden recomendado

1. Aprobar fuente Suiza 2026, su hash, resolución, vigencia, rubros y responsables; registrar equivalencias explícitas. No cargar tarifas inferidas.
2. Definir esquema y contrato único TUPA ↔ expediente ↔ RutaDoc con ejemplos de UUID, errores y versionado. Mantener archivos y arquitectura del profesor; usar adaptadores y migraciones nuevas.
3. Reparar lecturas/escrituras incompatibles y autorización servidor; demostrar un trámite de prueba sin cobro ni notificación externa.
4. Conectar requisitos, formularios y adjuntos S3 reales; hacer que fallos bloqueen el cargo.
5. Conectar bandeja, FSM, calendario y auditoría; probar idempotencia, reversión, trazabilidad y días inhábiles en base desechable.
6. Conectar firma, casilla y reportes solo con validación institucional específica.
7. Sustituir referencias legales erróneas, depurar textos UI y retirar fallbacks de producción. Ejecutar pruebas por recorrido y contraste con TUPA aprobado.

## 15. Evidencias, comandos y limitaciones

Se usaron `git rev-parse`, `git branch`, `git status --short --untracked-files=all`, `git worktree list --porcelain`, `git rev-list --left-right --count`, `git log --left-right`, `git fetch --all --prune`, `rg --files`, `rg -n` con todas las palabras solicitadas y lectura de archivos de código, SQL, docs, README, Docker y scripts. El barrido de términos dio **6.463 líneas coincidentes** en `docs`, `backend/docs` y `frontend/docs`; se agrupó por norma/regla para evitar reproducir textos extensos. Las fuentes oficiales enlazadas se consultaron el 10-10-2026. No se imprimieron secretos `.env`.

**Comprobación técnica:** no se ejecutaron typecheck, lint ni Vitest en el worktree porque no tiene `node_modules`; instalar dependencias alteraría el entorno de esta fase. Node local `v24.17.0` tampoco alcanza el mínimo frontend `24.19.0`. No se levantó Docker ni se tocó ninguna BD. Se comprobaron por lectura rutas, DDL, seeds, ejemplos de entorno y suites existentes. El estado de bases, S3 y Redis compartidos queda desconocido. Las conclusiones de SQL 42703 son estáticas, no trazas de una ejecución. Las cantidades de pruebas en informes previos no se aceptan como resultado presente. El PDF Suiza citado por CP-GERIC-004 no está versionado, por lo que su autenticidad, vigencia, tarifas y clasificación quedan pendientes de validación institucional. `git diff --check` no informó errores; dado que el informe está sin seguimiento, se comprobó además con `git diff --no-index --check` contra un archivo vacío. El estado final es únicamente `?? docs/cambios_prototipo/GERIC/CP-GERIC-005-diagnostico-normativo-y-reglas.md`.

## 16. Nivel de evidencia

| Nivel | Alcance de esta revisión |
|---|---|
| **Comprobado en código** | DDL, seeds, tipos, consultas, rutas y componentes citados con archivo y línea, incluidas las 21 reglas y los cuatro bloqueos del §10. Son observaciones estáticas; «implementada en código» no equivale a funcionamiento operativo. |
| **Comprobado en documentación** | README, documentos técnicos, CP-GERIC-001 a 004 y las referencias del anexo A; las declaraciones de conformidad anteriores son afirmaciones documentadas, no certificaciones aceptadas por esta revisión. |
| **Comprobado mediante fuente oficial** | Existencia y materia de los 22 instrumentos de §4.1, así como los cambios o derogaciones expresamente indicados allí. No se efectuó cotejo integral de cada artículo, modificatoria, disposición transitoria ni aplicabilidad institucional. |
| **No probado en ejecución** | Instalación, migraciones, typecheck, pruebas, servicios Docker, BD, Redis, S3, firma, notificación, radicación y recorrido de extremo a extremo. Por ello, un error SQL señalado es una incompatibilidad estática, no una traza observada. |
| **Pendiente de validación institucional** | Fuente, resolución y clasificación del TUPA Suiza 2026; equivalencias código/UUID, tarifas y unidades; calendario, textos de datos/notificación, archivo, conservación, firma y alcance jurídico de cada norma. Las cuatro referencias del §4.2 mantienen sus pendientes específicos. |

## 17. Condiciones antes de implementar

1. Obtener un **`git fetch --all --prune` remoto exitoso** y volver a contrastar esta revisión con `origin/B_GERIC` y `origin/main`; el intento de esta fase falló por resolución DNS y las referencias remotas locales pueden estar desactualizadas.
2. Instalar dependencias **mediante los lockfiles** de backend y frontend, con versiones de Node compatibles, en un entorno aislado.
3. Levantar **Docker aislado**, sin conectar bases, colas, S3 ni credenciales compartidas.
4. Ejecutar **migraciones desde cero** sobre una **base desechable** y comprobar el esquema efectivo frente a las rutas de radicación, consulta, catálogo y RutaDoc.
5. Ejecutar **typecheck** de backend y frontend, y resolver fallos antes de integrar procedimientos.
6. Ejecutar **pruebas backend y frontend** relevantes y un recorrido de prueba aislado que cubra catálogo, expediente, requisitos, adjuntos, trazabilidad y errores.
7. Obtener la **aprobación institucional de la homologación TUPA**: fuente Suiza autenticada, versión/vigencia, clasificación de procedimientos, equivalencias código/UUID, importe, unidad, UIT y responsable de publicación. Sin esa aprobación no se debe publicar ni cobrar una fila.
## Anexo A. Índice exhaustivo de menciones normativas

Generado del checkout base, excluyendo este informe, archivos `.env`, dependencias y binarios. Cada referencia es `ruta:líneas`; detecta denominaciones/números explícitos, no equivale a una interpretación legal.

### Ley 27444 y TUO 004-2019/006-2026

`INFORME_AUDITORIA_INTEGRAL_ARQUITECTURA_Y_NORMATIVA_SIGD.md:17,63,92,308,391,644`; `PLAN_CONMUTACION_Y_CERTIFICACION_SINCRONIZACION_FULLSTACK_100.md:48,78`; `README.md:15,82,83,102,146,148,233,257`; `backend/README.md:80,541,574`; `backend/docs/00_corelink/07_vistas_materializadas_mgd.sql:10`; `backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md:26,27,50,53,54,55,56,60,113,153`; `backend/docs/03_docucore/07_decisiones_y_preguntas_pendientes.md:65`; `backend/docs/04_tramicore/01_analisis_cut_acumulacion_foliado.md:18,23`; `backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql:4,645`; `backend/docs/04_tramicore/05_decisiones_levantamiento_tramicore.md:31,65`; `backend/docs/04_tramicore/05_esquema_sigd_tra_v6.3.sql:7,378`; `backend/docs/04_tramicore/historico/01_analisis_tramite_expediente_registro.md:200,201,202,213`; `backend/docs/README.md:198`; `backend/docs/levantamiento_de_observaciones/02_plan_levantamiento_observaciones_grupo_2_tramicore.md:17`; `backend/migraciones/01_sigd_audit.sql:6`; `backend/migraciones/02_sigd_auth.sql:6`; `backend/migraciones/03_sigd_org.sql:6`; `backend/migraciones/04_sigd_doc.sql:6,32`; `backend/migraciones/05_sigd_tra.sql:6,142,239,391`; `backend/src/domains/identicore/casilla.router.ts:146,351,353,407,409`; `backend/src/domains/organicore/calendario.service.ts:5,724`; `backend/src/domains/tramicore/horarioCorte.util.ts:4`; `backend/src/modules/firma/firma.routes.ts:59`; `frontend/README.md:23,203,285`; `frontend/docs/01_registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md:10`; `frontend/docs/01_registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md:10`; `frontend/docs/01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md:10,19,44,45,61,75`; `frontend/docs/02_administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md:75,112,113,128`; `frontend/docs/02_administracion-seguridad-auditoria/01_descripcion_general_administracion.md:8,16,62`; `frontend/docs/02_administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md:8`; `frontend/docs/02_administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md:8`; `frontend/docs/02_administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md:8`; `frontend/docs/02_administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md:8`; `frontend/docs/02_administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md:8,12,14`; `frontend/docs/03_flujo-validez-legal/01_descripcion_general_validez_legal.md:8,24,27`; `frontend/docs/03_flujo-validez-legal/02_flujos_trabajo_workflow_academico.md:8,109,111`; `frontend/docs/03_flujo-validez-legal/03_documentos_oficiales_firma_digital.md:8,27`; `frontend/docs/03_flujo-validez-legal/04_validez_legal_y_validador_cvd.md:8,14`; `frontend/docs/03_flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md:8`; `frontend/docs/03_flujo-validez-legal/06_componentes_interfaz_ui.md:8`; `frontend/docs/04_registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md:30,113,116`; `frontend/docs/04_registro-documentario/01_arquitectura_tecnica_registro_documentario.md:10`; `frontend/docs/04_registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md:10,86,149,159,162,176`; `frontend/docs/04_registro-documentario/03_componentes_ui_y_estados_formulario.md:10,52,122`; `frontend/docs/05_gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md:30,61,75,102,105,106`; `frontend/docs/05_gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md:10,16,66,89`; `frontend/docs/05_gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md:10,135`; `frontend/docs/05_gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md:10,20,215,217`; `frontend/docs/06_reportes-tableros-control/01_descripcion_general_reportes_dashboard.md:8,31`; `frontend/docs/06_reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md:8,14`; `frontend/docs/06_reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md:8`; `frontend/docs/06_reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md:8`; `frontend/docs/06_reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md:8`; `frontend/docs/06_reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md:8`; `frontend/docs/README.md:59,115,254`; `frontend/src/components/casilla/NotificacionDetailModal.tsx:390,474,525,528`; `frontend/src/components/expedientes/AcumulacionModal.tsx:69`; `frontend/src/components/registro/ConsentimientoLey29733Modal.tsx:49`; `frontend/src/components/registro/DeclaracionJuradaCheckbox.tsx:31`; `frontend/src/components/tramite/CargoDigitalModal.tsx:205,219`; `frontend/src/components/tramite/DynamicSchemaForm.tsx:14,105,537,555`; `frontend/src/components/tramite/HorarioCorteBanner.tsx:60`; `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx:11,264,448`; `frontend/src/components/tramite/WizardSteps/StepDeclaracionJurada.tsx:10,58,112,133`; `frontend/src/components/tramite/WizardSteps/StepIdentificacion.tsx:10,181`; `frontend/src/components/tramite/steps/Step1Identificacion.tsx:247`; `frontend/src/hooks/useCalendarioLaboral.ts:25,159`; `frontend/src/hooks/useTramiteWizard.ts:38,242`; `frontend/src/pages/MesaPartesVirtualPage.tsx:22`; `frontend/src/pages/administracion/CalendarioLaboralPage.tsx:44`; `frontend/src/pages/casilla/CasillaElectronicaPage.tsx:4,107,115`; `frontend/src/pages/flujos/WorkflowAcademicoPage.tsx:351`; `frontend/src/pages/tramite/ConsultaPublicaPage.tsx:95`; `frontend/src/pages/tramite/TramitePage.tsx:15,45`; `frontend/src/pages/validador/ValidadorPublicoCvdPage.tsx:332`; `frontend/src/services/casillaService.ts:193`; `frontend/src/types/casilla.ts:4,63`; `frontend/src/types/jsonSchema.ts:136`; `frontend/src/types/tramiteWizard.ts:36,170,257`; `frontend/src/types/tramiteWizardState.ts:13,124`; `frontend/src/utils/schemaFormParser.ts:15,33,38,337`; `frontend/src/utils/slaCalculator.ts:2,82,139`; `frontend/tests/integration/m1/casillaElectronica.test.tsx:80`; `frontend/tests/unit/components/TramiteWizard.test.tsx:488`; `frontend/tests/unit/utils/slaCalculator.test.ts:9`

### Ley 29733 y reglamentos 003-2013/016-2024

`INFORME_AUDITORIA_INTEGRAL_ARQUITECTURA_Y_NORMATIVA_SIGD.md:20,66,92,188,210,376,379,394,647`; `PLAN_CONMUTACION_Y_CERTIFICACION_SINCRONIZACION_FULLSTACK_100.md:86`; `README.md:67,94,95,142`; `backend/README.md:83,347,535,613,635`; `backend/docs/00_corelink/04_contratos_intermodulares_unificados.md:152`; `backend/docs/01_identicore/01_analisis_identidad_personas_seguridad.md:209`; `backend/docs/01_identicore/02_modelo_datos_identicore_v2.md:175`; `backend/docs/01_identicore/03_esquema_sigd_auth_v2.sql:2,192,209,323,353`; `backend/docs/01_identicore/04_validacion_identicore_v2.md:5,11,144,162,246`; `backend/docs/01_identicore/05_decisiones_levantamiento_identicore.md:5,30,32,34,143,160`; `backend/docs/04_tramicore/05_esquema_sigd_tra_v6.3.sql:25,332`; `backend/docs/README.md:44,89,182,201`; `backend/docs/levantamiento_de_observaciones/04_plan_levantamiento_observaciones_grupo_4_identicore.md:18,33,52,63,83,121`; `backend/migraciones/02_sigd_auth.sql:6,89,167`; `backend/src/domains/identicore/casilla.router.ts:2,146,351,353,407,409`; `backend/src/domains/tramicore/consultaPublica.service.ts:9,138`; `frontend/README.md:26,185,433,516,652,654`; `frontend/docs/01_registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md:47,82,113,132,137,165,173,205,217`; `frontend/docs/01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md:1,6,18,24,38,59`; `frontend/docs/README.md:46,86,90,93,257`; `frontend/src/components/auth/ConsentimientoLey29733Modal.tsx:3,4,8,11,12,18,22,25,30,55,56,78,83,85,115,131`; `frontend/src/components/registro/ConsentimientoLey29733Modal.tsx:3,8,45,53`; `frontend/src/components/registro/DeclaracionJuradaCheckbox.tsx:31`; `frontend/src/components/registro/PersonaJuridicaForm.tsx:9,51,59,73,390,396,406,408,414,424,429`; `frontend/src/components/registro/PersonaNaturalForm.tsx:9,46,54,68,314,320,330,332,338,348,353`; `frontend/src/components/tramite/WizardSteps/StepIdentificacion.tsx:181`; `frontend/src/pages/casilla/CasillaElectronicaPage.tsx:4,88`; `frontend/src/pages/tramite/ConsultaPublicaPage.tsx:95,170`; `frontend/src/schemas/consentimiento.schema.ts:3,5,6,7,15`; `frontend/src/schemas/registroCiudadano.schema.ts:70,72,172,174`; `frontend/src/services/casillaService.ts:193`; `frontend/src/types/casilla.ts:4`; `frontend/src/types/registroCiudadano.ts:24,46`; `frontend/tests/integration/m1/registroFormularios.test.tsx:12,13,72,107,139,212,218,242,246,247,248,254,255,298,396`; `frontend/tests/unit/components/ConsentimientoModal.test.tsx:7,9,11,12,17,29,36,41,50,65,84,94`; `frontend/tests/unit/schemas/registroCiudadano.test.ts:27,48,85,113,202,204`

### Ley 27269 y D.S. 052-2008/026-2016; transparencia 070-2013

`INFORME_AUDITORIA_INTEGRAL_ARQUITECTURA_Y_NORMATIVA_SIGD.md:19,65,92,305,358,646`; `README.md:90,126,135,187,291`; `backend/README.md:82,388`; `backend/docs/README.md:200`; `backend/migraciones/03_sigd_org.sql:6`; `backend/migraciones/04_sigd_doc.sql:6`; `backend/src/domains/docucore/validadorCvd.controller.ts:112`; `frontend/README.md:25,83,237,318,326,424`; `frontend/docs/03_flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md:47,76,107,109,124,157`; `frontend/docs/03_flujo-validez-legal/01_descripcion_general_validez_legal.md:30`; `frontend/docs/03_flujo-validez-legal/03_documentos_oficiales_firma_digital.md:14,37`; `frontend/docs/03_flujo-validez-legal/04_validez_legal_y_validador_cvd.md:14`; `frontend/docs/03_flujo-validez-legal/06_componentes_interfaz_ui.md:53`; `frontend/src/components/cvd/CvdIntegrityReport.tsx:32,121`; `frontend/src/components/firma/CvdStampBadge.tsx:39,95`; `frontend/src/components/firma/DocumentoCvdViewer.tsx:39`; `frontend/src/components/firma/RefirmaConnectorModal.tsx:159,160`; `frontend/src/hooks/useCvdPublicVerification.ts:147`; `frontend/src/pages/flujos/FlujoValidezLegalPage.tsx:40`; `frontend/src/pages/flujos/VisorCvdPage.tsx:8,33`; `frontend/src/pages/validador/ValidadorPublicoCvdPage.tsx:5,165,330,331`; `frontend/src/types/cvdVerificacion.ts:3`; `frontend/src/utils/cvdValidator.ts:5`; `frontend/tests/unit/components/documentoCvdViewer.test.tsx:22`; `frontend/tests/unit/components/refirmaGateway.test.tsx:51`

### D. Leg. 1412 y D.S. 029-2021-PCM

`backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md:57`; `frontend/docs/01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md:20`; `frontend/docs/03_flujo-validez-legal/01_descripcion_general_validez_legal.md:33`

### MGD: R.S.G.D. 001-2017; cita errónea al D.S. 026-2016

`INFORME_AUDITORIA_INTEGRAL_ARQUITECTURA_Y_NORMATIVA_SIGD.md:64,329`; `README.md:87,114`; `backend/docs/00_corelink/07_vistas_materializadas_mgd.sql:10`; `backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md:58`; `backend/docs/04_tramicore/01_analisis_cut_acumulacion_foliado.md:22`; `backend/docs/04_tramicore/02_diccionario_datos_tramicore_v2.md:146`; `backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql:4`; `backend/docs/04_tramicore/05_decisiones_levantamiento_tramicore.md:22,26,27,75`; `backend/docs/04_tramicore/05_esquema_sigd_tra_v6.3.sql:7`; `backend/docs/04_tramicore/08_coordinacion_contratos_tramicore.md:54`; `backend/docs/04_tramicore/historico/01_analisis_tramite_expediente_registro.md:205,206`; `backend/docs/levantamiento_de_observaciones/02_plan_levantamiento_observaciones_grupo_2_tramicore.md:56`; `backend/migraciones/01_sigd_audit.sql:6`; `backend/src/domains/tramicore/cut.service.ts:6`; `frontend/docs/03_flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md:76`; `frontend/docs/03_flujo-validez-legal/04_validez_legal_y_validador_cvd.md:20`

### AGN 001-2019, 006-2019 y R.J. 073-2023

`INFORME_AUDITORIA_INTEGRAL_ARQUITECTURA_Y_NORMATIVA_SIGD.md:67,396`; `README.md:97,98,152`; `backend/README.md:84,375`; `backend/docs/04_tramicore/01_analisis_cut_acumulacion_foliado.md:24`; `backend/docs/04_tramicore/02_diccionario_datos_tramicore_v2.md:148`; `backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql:5`; `backend/docs/04_tramicore/05_decisiones_levantamiento_tramicore.md:41`; `backend/docs/README.md:202`; `backend/migraciones/05_sigd_tra.sql:7,259`; `frontend/README.md:27`; `frontend/docs/05_gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md:32,71,104`; `frontend/docs/05_gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md:88`

### Ley 30512 y RVM 178-2018/277-2019

`INFORME_AUDITORIA_INTEGRAL_ARQUITECTURA_Y_NORMATIVA_SIGD.md:22,62,68,92,267,405,419,650`; `backend/migraciones/04_sigd_doc.sql:264,265,266`; `frontend/docs/03_flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md:27`; `frontend/docs/03_flujo-validez-legal/02_flujos_trabajo_workflow_academico.md:18`; `frontend/docs/03_flujo-validez-legal/03_documentos_oficiales_firma_digital.md:24`; `frontend/src/components/firma/DocumentoCvdViewer.tsx:97`; `frontend/src/components/flujos/PlantillaResolucionEditor.tsx:30`

### D. Leg. 713

`README.md:107`; `backend/src/domains/organicore/calendario.service.ts:6,187`; `backend/tests/unit/domains/organicore/calendario.spec.ts:61,171`; `frontend/docs/02_administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md:65`; `frontend/src/hooks/useCalendarioLaboral.ts:40`; `frontend/src/pages/administracion/CalendarioLaboralPage.tsx:148`; `frontend/src/utils/slaCalculator.ts:23`; `frontend/tests/unit/utils/slaCalculator.test.ts:26`

### Ley 29001

`backend/migraciones/03_sigd_org.sql:275,276`; `backend/src/domains/organicore/calendario.service.ts:7,192`; `backend/tests/unit/domains/organicore/calendario.spec.ts:62`

### Ley 30709

`backend/src/modules/reportes/kpi.service.ts:9`

### Código Penal art. 411

`README.md:146`; `frontend/docs/01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md:64`; `frontend/src/components/registro/DeclaracionJuradaCheckbox.tsx:35`


## Anexo B. Índice documental depurado

Se listan 162 archivos versionados de documentación y materiales fuente de referencia. Se excluyeron 49 artefactos generados o marcadores; véase §3.

### Cambios del prototipo (5)

- `docs/cambios_prototipo/GERIC/CP-GERIC-001-levantamiento-demo.md`
- `docs/cambios_prototipo/GERIC/CP-GERIC-002-seed-auth-demo.md`
- `docs/cambios_prototipo/GERIC/CP-GERIC-003-lockfile-frontend.md`
- `docs/cambios_prototipo/GERIC/CP-GERIC-004-auditoria-tupa-suiza.md`
- `docs/cambios_prototipo/GERIC/RESUMEN_PRUEBAS.md`

### Documentación backend (118)

- `backend/docs/00_corelink/01_convenciones_api_backend.md`
- `backend/docs/00_corelink/01_especificacion_middleware_rfc7807.md`
- `backend/docs/00_corelink/01_esquema_sigd_audit_v6.3.sql`
- `backend/docs/00_corelink/02_arquitectura_auditoria_contexto_asynclocalstorage.md`
- `backend/docs/00_corelink/02_catalogo_errores_backend.md`
- `backend/docs/00_corelink/03_plan_pruebas_integracion.md`
- `backend/docs/00_corelink/03_suite_pruebas_testcontainers_k6.md`
- `backend/docs/00_corelink/04_contratos_intermodulares_unificados.md`
- `backend/docs/00_corelink/04_contratos_y_decisiones_pendientes.md`
- `backend/docs/00_corelink/05_decisiones_levantamiento_corelink.md`
- `backend/docs/00_corelink/06_sigd_audit_esquema_ddl.sql`
- `backend/docs/00_corelink/07_evidencia_autorias_y_aprobaciones.md`
- `backend/docs/00_corelink/07_vistas_materializadas_mgd.sql`
- `backend/docs/00_corelink/08_runbook_evidencia_pruebas.md`
- `backend/docs/00_corelink/09_propuesta_contractual_rutadoc.md`
- `backend/docs/01_identicore/01_analisis_identidad_personas_seguridad.md`
- `backend/docs/01_identicore/01_analisis_usuarios_internos_externos.md`
- `backend/docs/01_identicore/02_diccionario_datos_identicore_v2.md`
- `backend/docs/01_identicore/02_diccionario_datos_usuarios.md`
- `backend/docs/01_identicore/02_modelo_datos_identicore_v2.md`
- `backend/docs/01_identicore/02_modelo_datos_usuarios_diagrama.drawio`
- `backend/docs/01_identicore/02_modelo_datos_usuarios.md`
- `backend/docs/01_identicore/03_esquema_sigd_auth_v2.sql`
- `backend/docs/01_identicore/03_usuarios.sql`
- `backend/docs/01_identicore/04_validacion_identicore_v2.md`
- `backend/docs/01_identicore/04_validacion_usuarios.md`
- `backend/docs/01_identicore/05_decisiones_levantamiento_identicore.md`
- `backend/docs/01_identicore/05_decisiones_y_preguntas_pendientes.md`
- `backend/docs/01_identicore/06_migracion_autoregistro_ubigeo.sql`
- `backend/docs/02_organicore/00_plan_trabajo_tecnico_organizacion.md`
- `backend/docs/02_organicore/01_analisis_areas_roles_permisos.md`
- `backend/docs/02_organicore/01_analisis_path_abac_encargaturas.md`
- `backend/docs/02_organicore/02_diccionario_datos_sigd_org.md`
- `backend/docs/02_organicore/02_modelo_datos_sigd_org.md`
- `backend/docs/02_organicore/03_catalogo_sedes_puestos_laborales.sql`
- `backend/docs/02_organicore/03_datos_prueba_organizacion.sql`
- `backend/docs/02_organicore/03_esquema_sigd_org_v2.sql`
- `backend/docs/02_organicore/03_esquema_sigd_org_v6.3.sql`
- `backend/docs/02_organicore/03_organizacion_roles_permisos.sql`
- `backend/docs/02_organicore/03_verificacion_organizacion.sql`
- `backend/docs/02_organicore/04_validacion_organicore_v2.md`
- `backend/docs/02_organicore/04_validacion_organizacion.md`
- `backend/docs/02_organicore/05_decisiones_arquitectura_sigd_org.md`
- `backend/docs/02_organicore/05_validacion_organicore_v2.sql`
- `backend/docs/02_organicore/06_notas_tecnicas_prevencion_ciclos.md`
- `backend/docs/02_organicore/07_politica_eliminaciones_logicas.md`
- `backend/docs/02_organicore/08_plan_ejecucion_controlado.md`
- `backend/docs/02_organicore/09_resumen_ejecutivo_organizacion.md`
- `backend/docs/02_organicore/10_plan_respaldo_contingencia_sigd_org_v2.md`
- `backend/docs/02_organicore/diagrama_er_sigd_org.dbml`
- `backend/docs/03_docucore/01_analisis_json_schema_storage_s3.md`
- `backend/docs/03_docucore/01_analisis_objetivo_actores_flujo.md`
- `backend/docs/03_docucore/02_reglas_requisitos_adjuntos.md`
- `backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md`
- `backend/docs/03_docucore/03_modelo_datos_docucore_v2.1_auditoria_corregido.md`
- `backend/docs/03_docucore/03_modelo_datos.md`
- `backend/docs/03_docucore/04_diccionario_datos_docucore_v2.md`
- `backend/docs/03_docucore/04_diccionario_datos.md`
- `backend/docs/03_docucore/04_esquema_sigd_doc_v6.3.sql`
- `backend/docs/03_docucore/05_documentos_formularios.sql`
- `backend/docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql`
- `backend/docs/03_docucore/05_esquema_sigd_docucore_v2.sql`
- `backend/docs/03_docucore/06_validacion_y_casos_prueba_v2.1_auditoria_corregido.md`
- `backend/docs/03_docucore/06_validacion_y_casos_prueba.md`
- `backend/docs/03_docucore/07_decisiones_y_preguntas_pendientes.md`
- `backend/docs/03_docucore/08_decisiones_firma_refirma.md`
- `backend/docs/03_docucore/diagrama_editable.drawio`
- `backend/docs/04_tramicore/01_analisis_cut_acumulacion_foliado.md`
- `backend/docs/04_tramicore/02_diccionario_datos_tramicore_v2.md`
- `backend/docs/04_tramicore/02_modelo_datos_gestion_documental_diagrama.drawio`
- `backend/docs/04_tramicore/02_modelo_datos_tramicore_v2.md`
- `backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql`
- `backend/docs/04_tramicore/04_datos_demo_tramicore.sql`
- `backend/docs/04_tramicore/04_validacion_tramicore_v2.md`
- `backend/docs/04_tramicore/05_decisiones_levantamiento_tramicore.md`
- `backend/docs/04_tramicore/05_esquema_sigd_tra_v6.3.sql`
- `backend/docs/04_tramicore/06_pruebas_laboratorio_tramicore.sql`
- `backend/docs/04_tramicore/07_lanzador_pruebas_tramicore.ps1`
- `backend/docs/04_tramicore/08_coordinacion_contratos_tramicore.md`
- `backend/docs/04_tramicore/historico/01_analisis_tramite_expediente_registro.md`
- `backend/docs/04_tramicore/historico/02_diccionario_datos_gestion_documental.md`
- `backend/docs/04_tramicore/historico/02_modelo_datos_gestion_documental.md`
- `backend/docs/04_tramicore/historico/03_tramite_expediente_registro.sql`
- `backend/docs/04_tramicore/historico/04_validacion_registro.md`
- `backend/docs/04_tramicore/historico/05_decisiones_y_preguntas_pendientes.md`
- `backend/docs/05_rutadoc/01_analisis_dominio_transiciones_rutadoc.md`
- `backend/docs/05_rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md`
- `backend/docs/05_rutadoc/01_diagrama_flujo_trazabilidad.mmd`
- `backend/docs/05_rutadoc/02_diagrama_modelo_datos_trazabilidad.mmd`
- `backend/docs/05_rutadoc/02_diccionario_datos_rutadoc_v2.md`
- `backend/docs/05_rutadoc/02_diccionario_datos_trazabilidad.md`
- `backend/docs/05_rutadoc/02_modelo_datos_rutadoc_v2.md`
- `backend/docs/05_rutadoc/02_modelo_datos_trazabilidad.md`
- `backend/docs/05_rutadoc/03_esquema_sigd_rut_particionado.sql`
- `backend/docs/05_rutadoc/03_trazabilidad_movimientos.sql`
- `backend/docs/05_rutadoc/04_validacion_rutadoc_v2.md`
- `backend/docs/05_rutadoc/04_validacion_trazabilidad.md`
- `backend/docs/05_rutadoc/05_decisiones_levantamiento_rutadoc.md`
- `backend/docs/05_rutadoc/05_decisiones_y_preguntas_pendientes.md`
- `backend/docs/05_rutadoc/06_esquema_sigd_rut_fsm_v6.3.sql`
- `backend/docs/05_rutadoc/07_lecturas_trazabilidad_sla_foliacion_ccd.md`
- `backend/docs/05_rutadoc/CONTRATOS_GERIC_CONFORMIDAD.md`
- `backend/docs/docucore/06_foliacion_firma_cvd.sql`
- `backend/docs/integracion/04_contratos_y_decisiones_pendientes.md`
- `backend/docs/levantamiento_de_observaciones/01_analisis_json_schema_storage_s3.md`
- `backend/docs/levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md`
- `backend/docs/levantamiento_de_observaciones/02_plan_levantamiento_observaciones_grupo_2_tramicore.md`
- `backend/docs/levantamiento_de_observaciones/03_plan_levantamiento_observaciones_grupo_3_organicore.md`
- `backend/docs/levantamiento_de_observaciones/04_plan_levantamiento_observaciones_grupo_4_identicore.md`
- `backend/docs/levantamiento_de_observaciones/05_plan_levantamiento_observaciones_grupo_5_docucore.md`
- `backend/docs/levantamiento_de_observaciones/06_plan_levantamiento_observaciones_grupo_6_corelink.md`
- `backend/docs/planes_trabajo/01_plan_trabajo_grupo_1_rutadoc.md`
- `backend/docs/planes_trabajo/02_plan_trabajo_grupo_2_tramicore.md`
- `backend/docs/planes_trabajo/03_plan_trabajo_grupo_3_organicore.md`
- `backend/docs/planes_trabajo/04_plan_trabajo_grupo_4_identicore.md`
- `backend/docs/planes_trabajo/05_plan_trabajo_grupo_5_docucore.md`
- `backend/docs/planes_trabajo/06_plan_trabajo_grupo_6_corelink.md`
- `backend/docs/README.md`

### Documentación frontend (39)

- `frontend/docs/01_registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md`
- `frontend/docs/01_registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md`
- `frontend/docs/01_registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md`
- `frontend/docs/01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md`
- `frontend/docs/02_administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md`
- `frontend/docs/02_administracion-seguridad-auditoria/01_descripcion_general_administracion.md`
- `frontend/docs/02_administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md`
- `frontend/docs/02_administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md`
- `frontend/docs/02_administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md`
- `frontend/docs/02_administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md`
- `frontend/docs/02_administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md`
- `frontend/docs/03_flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md`
- `frontend/docs/03_flujo-validez-legal/01_descripcion_general_validez_legal.md`
- `frontend/docs/03_flujo-validez-legal/02_flujos_trabajo_workflow_academico.md`
- `frontend/docs/03_flujo-validez-legal/03_documentos_oficiales_firma_digital.md`
- `frontend/docs/03_flujo-validez-legal/04_validez_legal_y_validador_cvd.md`
- `frontend/docs/03_flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md`
- `frontend/docs/03_flujo-validez-legal/06_componentes_interfaz_ui.md`
- `frontend/docs/03_flujo-validez-legal/diagrama_flujo_validez_legal.dbml`
- `frontend/docs/04_registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md`
- `frontend/docs/04_registro-documentario/01_arquitectura_tecnica_registro_documentario.md`
- `frontend/docs/04_registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md`
- `frontend/docs/04_registro-documentario/03_componentes_ui_y_estados_formulario.md`
- `frontend/docs/04_registro-documentario/documentacion/HORARIO LPAG/horario_lpag.md`
- `frontend/docs/04_registro-documentario/documentacion/TUPA/tupa.md`
- `frontend/docs/05_gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md`
- `frontend/docs/05_gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md`
- `frontend/docs/05_gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md`
- `frontend/docs/05_gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md`
- `frontend/docs/05_gestion-expedientes/04_entrega_individual_piero_bartra_ccd_foliacion.md`
- `frontend/docs/06_reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md`
- `frontend/docs/06_reportes-tableros-control/01_descripcion_general_reportes_dashboard.md`
- `frontend/docs/06_reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md`
- `frontend/docs/06_reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md`
- `frontend/docs/06_reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md`
- `frontend/docs/06_reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md`
- `frontend/docs/06_reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md`
- `frontend/docs/06_reportes-tableros-control/diagrama_metricas_dashboard.dbml`
- `frontend/docs/README.md`
