# INFORME DE AUDITORÍA FORENSE Y EVALUACIÓN DE CONTRIBUCIONES — BACKEND SIGD

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Fecha de Auditoría Forense:** 31 de agosto de 2026  
**Herramientas Empleadas:** Análisis profundo Git (Líneas reales `.md` y `.sql`), cruce pericial con Planes de Trabajo.

---

## 1. RESUMEN EJECUTIVO Y HALLAZGOS PERICIALES

La presente auditoría aplica filtros estrictos para descontar líneas de código autogeneradas, imágenes, binarios y librerías (`node_modules`), midiendo **únicamente el código y documentación escrita a mano** (`Markdown` y `SQL`). Además, la calificación se ha fundamentado en el **cumplimiento estricto del Rol Asignado** en los planes de trabajo iniciales (`backend/docs/planes_trabajo/`).

### Hallazgos Críticos:
1. **Falsos Positivos Detectados:** El análisis superficial de Git mostraba a integrantes con altos volúmenes de líneas que, tras la auditoría profunda, resultaron ser cargas masivas de librerías de Frontend (React) o simples renombramientos de imágenes.
2. **Desviaciones del Alcance:** Algunos miembros trabajaron interfaces Frontend en lugar de la arquitectura Backend que tenían asignada.
3. **Alto Rendimiento:** Los Grupos 3, 2 y 4 (gracias a aportes individuales extraordinarios) sostienen la viabilidad técnica del módulo Backend.

```mermaid
flowchart TB
    AuditRoot["Auditoría Forense Backend SIGD - Escala Vigesimal (0-20)"]

    subgraph G1["Grupo 1: RutaDoc"]
        G1_1["Geric: 20/20 (2,893 lin)"]
        G1_2["Jhasy: 19/20 (881 lin SQL/MD)"]
        G1_3["Jacobo: 10/20 (Incumplió Backend)"]
    end

    subgraph G2["Grupo 2: TramiCore"]
        G2_1["Ramírez: 17/20 (679 lin)"]
        G2_2["Riquelmer: 16/20 (540 lin)"]
        G2_3["Sandy: 15/20 (332 lin)"]
    end

    subgraph G3["Grupo 3: OrganiCore"]
        G3_1["Pool: 20/20 (3,890 lin)"]
        G3_2["Leonardo: 20/20 (3,658 lin)"]
        G3_3["Panaifo: 18/20 (883 lin)"]
    end

    subgraph G4["Grupo 4: IdentiCore"]
        G4_1["Jair: 20/20 (2,982 lin)"]
        G4_2["Segundo: 11/20 (Incumplió Backend)"]
        G4_3["Tapullima: 06/20 (60 lin)"]
    end

    subgraph G5["Grupo 5: DocuCore"]
        G5_1["Cristian: 18/20 (1,165 lin)"]
        G5_2["Piero: 17/20 (534 lin)"]
        G5_3["Valentín: 15/20 (304 lin)"]
        G5_4["Azareño: 08/20 (93 lin útiles)"]
    end

    subgraph G6["Grupo 6: CoreLink"]
        G6_1["Ricardo: 17/20 (713 lin)"]
        G6_2["Zevallos: 16/20 (433 lin)"]
        G6_3["Duque: 02/20 (Cero código, renombró JPGs)"]
        G6_4["Reátegui: 00/20 (Cero commits en Git)"]
    end

    AuditRoot --> G1
    AuditRoot --> G2
    AuditRoot --> G3
    AuditRoot --> G4
    AuditRoot --> G5
    AuditRoot --> G6
```

---

## 2. EVALUACIÓN DETALLADA Y CALIFICACIÓN TÉCNICA (0 - 20)

### 🥇 GRUPO 3 — OrganiCore (Equipo Destacado)
**Evaluación General:** Excelente. Los tres miembros demostraron alto profesionalismo, cumpliendo a cabalidad su rol sin desviarse del alcance backend.
* 🟢 **Leonardo** (`leonardo`) | Rol: Analista Funcional | **Nota: 20/20**  
  * *Peritaje:* 3,658 líneas Markdown genuinas. Análisis funcional impecable y sumamente detallado de áreas y roles RBAC.
* 🟢 **Pool Angelo** (`angel` / `Carranzapereyrapoolangelo-alt`) | Rol: Sublíder y Modelador | **Nota: 20/20**  
  * *Peritaje:* Lideró la carga técnica (más de 3,300 líneas MD y 536 SQL). Extraordinario nivel de consolidación.
* 🟢 **Geiner Panaifo** (`TangeHidalgoGeiner`) | Rol: Implementador SQL | **Nota: 18/20**  
  * *Peritaje:* Entregó código DDL limpio y casos de prueba perfectamente alineados.

---

### 🥈 GRUPO 1 — RutaDoc (Trazabilidad y Flujo)
* 🟢 **Geric** (`salasormenogericaldair01-cell`) | Rol: Arquitecto y Modelador | **Nota: 20/20**  
  * *Peritaje:* 2,893 líneas MD. Consolidó magistralmente la máquina de estados.
* 🟢 **Jhasy** (`svrjhass-design`) | Rol: Implementadora SQL | **Nota: 19/20**  
  * *Peritaje:* 214 líneas MD y 667 líneas SQL de excelente nivel técnico.
* 🟠 **Jacobo** (`cliderlex-sketch`) | Rol: Analista Funcional | **Nota: 10/20**  
  * *Peritaje:* **Incumplimiento de Rol.** Debía entregar análisis backend, pero subió interfaces React (`.tsx`) y una librería pesada (`node_modules`), ensuciando el repositorio. Se aprueba mínimamente por el esfuerzo.

---

### 🥈 GRUPO 4 — IdentiCore (Usuarios y Personas)
* 🟢 **Jair** (`AgustinJhair`) | Rol: Implementador SQL | **Nota: 20/20**  
  * *Peritaje:* 2,446 líneas MD y 536 SQL. Ante el bajo rendimiento de su grupo, asumió roles extras y rescató la entrega del equipo.
* 🟠 **Segundo** (`Sergio-Serruche`) | Rol: Sublíder y Modelador | **Nota: 11/20**  
  * *Peritaje:* **Desviación del Alcance.** Entregó archivos Word (`.docx`) y código React frontend, sin aportar al modelado SQL backend asignado.
* 🔴 **Tania Tapullima** (`tanialorenatapullimanavarro`) | Rol: Analista Funcional | **Nota: 06/20**  
  * *Peritaje:* Muy deficiente. Apenas 60 líneas de texto sin flujos funcionales completos.

---

### 🥉 GRUPO 2 — TramiCore (Trámite y Registro)
**Evaluación General:** Un grupo equilibrado y confiable.
* 🟢 **Elmer Ramírez** (`ReyNorD23`) | Rol: Sublíder y Modelador | **Nota: 17/20**  
* 🟢 **Leysglin Riquelmer** (`riquelmerfachin`) | Rol: Analista Funcional | **Nota: 16/20**  
* 🟢 **Sandy** (`sandymargarita08-cloud`) | Rol: Implementadora SQL | **Nota: 15/20**  
  * *Peritaje Conjunto:* Cumplieron estrictamente con lo solicitado, entregando el análisis y la estructura SQL del CUT con buena calidad.

---

### 🥉 GRUPO 5 — DocuCore (Documentos y Formularios)
* 🟢 **Christian Jhoel** (`rodriguezcarichristianjhoel-byte`) | Rol: Sublíder y Modelador | **Nota: 18/20**  
  * *Peritaje:* Elevada coordinación y consolidación técnica en 22 commits.
* 🟢 **Piero** (`Piero` / `PieroBartraMontalvo`) | Rol: Implementador SQL | **Nota: 17/20**  
  * *Peritaje:* Implementación SQL sólida (470 líneas probadas).
* 🟢 **Valentín** (`Valentino-lopez`) | Rol: Analista Funcional B | **Nota: 15/20**  
* 🔴 **Cristhiam Azareño** (`cristiamsaul2`) | Rol: Analista Funcional A | **Nota: 08/20**  
  * *Peritaje:* Su análisis funcional en texto fue ínfimo (93 líneas). Infló su rama con miles de líneas de binarios (imágenes).

---

### 🚨 GRUPO 6 — CoreLink (Integración y Calidad)
**Evaluación General:** Crítica. Dos miembros arrastraron al equipo ante el nulo aporte técnico de los demás.
* 🟢 **Ricardo Arévalo** (`arevalovillacortar-alt`) | Rol: Integrador y Líder | **Nota: 17/20**  
  * *Peritaje:* Redactó y coordinó efectivamente las integraciones (713 líneas MD).
* 🟢 **Zevallos** (`REDBLACK-OL`) | Rol: QA / Pruebas | **Nota: 16/20**  
  * *Peritaje:* Desarrolló los planes de pruebas y validaciones (433 líneas MD).
* 🔴 **Duque** (`ADERRTX`) | Rol: Especialista API (Catálogo de Errores) | **Nota: 02/20**  
  * *Peritaje:* **Inaceptable.** Tenía como responsabilidad redactar el RFC 7807, pero únicamente renombró 32 archivos `.jpeg` de logos institucionales. Aporte backend: cero.
* 🔴 **Reátegui** | Rol: Especialista en Auditoría | **Nota: 00/20**  
  * *Peritaje:* **Abandono.** Tras un cruce pericial estricto con los correos de Git, no existe ningún commit que certifique autoría o participación en el repositorio de este integrante.

---

## 3. SCRIPTS PARA AUDITORÍA DE TRANSPARENCIA

Cualquier docente puede replicar la exactitud de este filtrado ejecutando el siguiente comando en PowerShell desde la raíz del proyecto para ver las líneas puramente documentales y estructurales (MD/SQL) que escribieron los alumnos, aislando el "ruido":

```powershell
# Extrae únicamente las líneas de SQL y Markdown escritas por integrante
$backendAuthors = @( "salasormenogericaldair01-cell", "cliderlex-sketch", "svrjhass-design", "ReyNorD23", "riquelmerfachin", "sandymargarita08-cloud", "Carranzapereyrapoolangelo-alt", "leonardo", "TangeHidalgoGeiner", "Sergio-Serruche", "tanialorenatapullimanavarro", "AgustinJhair", "rodriguezcarichristianjhoel-byte", "cristiamsaul2", "Valentino-lopez", "Piero", "PieroBartraMontalvo", "arevalovillacortar-alt", "ADERRTX", "angel", "Renato Henyer Tarazona Flores", "REDBLACK-OL" )

$results = foreach ($a in $backendAuthors) {
    $stats = git log --all --no-merges --author="$a" --numstat
    $md = 0; $sql = 0; $junk = 0
    foreach ($line in $stats) {
        if ($line -match "^(\d+|-)\s+(\d+|-)\s+(.+)$") {
            $add = if ($matches[1] -eq "-") { 0 } else { [int]$matches[1] }
            $file = $matches[3]
            if ($file -match "\.(svg|png|jpg|jpeg|pdf|lock|json|html|js)$" -or $file -match "node_modules") { $junk += $add }
            elseif ($file -match "\.md$") { $md += $add }
            elseif ($file -match "\.sql$") { $sql += $add }
        }
    }
    [PSCustomObject]@{ Author = $a; LineasMD = $md; LineasSQL = $sql; LineasBasura_Binarios = $junk }
}
$results | Sort-Object LineasMD -Descending | Format-Table -AutoSize
```
