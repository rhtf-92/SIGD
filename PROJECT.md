# Project: SIGD Frontend Documentation Audit and Master Plan Re-Engineering

## Architecture

### 1. Architectural Style & Paradigm
- **Domain-Driven UI / Feature-Sliced Design (FSD)**: 6-layer unidirectional dependency model:
  `app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`.
- **Tech Stack**: React 19, TypeScript 5.9, Vite 6, Tailwind CSS 4, TanStack Query v5, Axios, Lucide React, PDF.js, Web Crypto API.
- **Server State**: Managed via TanStack React Query v5 with query key factories, 60s stale time, background refetch, and optimistic cache mutations.
- **Client State**: Zustand / React Context for auth session, active RBAC role, notifications, and UI theme.
- **HTTP Client**: Axios instance with bidirectional interceptors:
  - Request: Injects Bearer JWT and `X-Correlation-ID` (UUIDv4) into every request.
  - Response: Extracts and normalizes RFC 7807 (`ApiProblemDetails`) errors into typed UI alerts and notifications.
- **Decoupled Storage**: MinIO / S3 Presigned URL PUT upload with client-side SHA-256 computation and magic byte header inspection (`%PDF`, `PK\x03\x04`, `\xFF\xD8\xFF`, `\x89PNG`).
- **Institutional UI Kit & Design System**: IESTP "Suiza" institutional branding (`#003876` Navy, `#006EC7` Cobalt, `#C5A059` Gold, `#E6007E` Magenta), meeting WCAG 2.1 AA accessibility (contrast ratio ≥ 4.5:1, ARIA live regions, focus rings).

---

## Feature Inventory

| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Forensic Audit & Contribution Traceability | Detailed quantitative and qualitative diagnosis of all 6 folders in `frontend/DOCUMENTACION/`, evaluating authors (Jhonatan, Patty, Matias, Isack, Urquia, orphan folder), compliance scores (0%-75%), and severity matrix. | M1 | Survey (spec_miner_survey_1) | DONE |
| 2 | Regulatory & Normative Compliance Mapping | Rigorous gap analysis against TUO Ley N° 27444 (LPAG 16:30 cutoff, working days), MGD-PCM (CUT code format, AGN foliation), Ley N° 27269 (Refirma RENIEC, CVD), and Ley N° 29733 (Casilla Electrónica consent). | M1 | Survey (spec_miner_survey_1) | DONE |
| 3 | Core Frontend Architecture Blueprint | FSD 6-layer architecture, React 19 + TS 5.9 + Tailwind 4 specs, Axios bidirectional interceptors (X-Correlation-ID), and RFC 7807 `ApiProblemDetails` error handling pipeline. | M2 | Survey (spec_miner_survey_2, explorer_survey_3) | DONE |
| 4 | Decoupled MinIO/S3 Presigned URL Flow | SHA-256 local calculation, magic byte inspection, presigned URL request, direct PUT to MinIO/S3, and upload confirmation. | M2 | Survey (spec_miner_survey_2, explorer_survey_3) | DONE |
| 5 | Institutional UI Kit & Design System (WCAG 2.1 AA) | Color tokens (IESTP "Suiza"), typography, reusable atomic components (Button, InputField, SelectField, Modal, DataTable, StatusBadge, Timeline, SlaCountdown, FileUploader, PdfViewer) and accessibility rules. | M2 | Survey (explorer_survey_3) | DONE |
| 6 | Governance, RACI Matrix & 6-Sprint Schedule | Formal resolution of orphan contributions, RACI governance matrix for the frontend team, and 6-Sprint implementation roadmap with dependencies. | M2 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 7 | M1: Portal del Ciudadano & Mesa de Partes Virtual Screen Catalog | Wireframes, fields, validations (RENIEC DNI/RUC), cut-off time warning (16:30 hrs), file upload, and tracking screens. | M3 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 8 | M2: Ventanilla Presencial & Registro Documentario Screen Catalog | Wireframes, CUT generation, barcode/QR sticker generation, physical reception checklist, and derivation modal. | M3 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 9 | M3: Bandejas del Funcionario & Gestión de Expedientes Screen Catalog | Wireframes, 10-state FSM workflow (PENDIENTE, EN_PROCESO, OBSERVADO, ARCHIVADO, etc.), SLA countdown timer, and pass/derivation drawer. | M3 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 10 | M4: Flujos Académicos, Firma Digital & Validez Legal Screen Catalog | Wireframes, Refirma RENIEC integration flow, digital signature stamp positioning, audit trail timeline, and CVD validation. | M3 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 11 | M5: Administración, Seguridad RBAC & Auditoría Screen Catalog | Wireframes, user management, role/permission matrix, temporary delegation (encargaturas), and audit log viewer. | M3 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 12 | M6: Reportes, Indicadores de Gestión & Tableros de Control Screen Catalog | Wireframes, executive dashboard, operational KPIs, SLA bottleneck heatmaps, and multi-format report exporter (PDF/Excel). | M3 | Survey (spec_miner_survey_1, explorer_survey_3) | DONE |
| 13 | Document Quality, Mermaid Validation & Final Gate Review | Verification of markdown syntax, Mermaid diagram rendering validity, cross-document synchronization, and forensic integrity audit. | M4 | Survey (all) | DONE |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Forensic Audit Report Re-engineering | Write complete, authoritative `frontend/DOCUMENTACION/INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` incorporating all forensic audit findings, author contributions, risk matrix, legal compliance, and severity indicators. | Survey | DONE |
| M2 | Master Plan Core Architecture, UI Kit & Governance | Write foundational sections of `frontend/DOCUMENTACION/PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` (Architecture, FSD, TanStack Query, Axios RFC 7807, MinIO/S3 Presigned, UI Kit WCAG 2.1 AA, RACI, 6 Sprints). | M1 | DONE |
| M3 | Screen Catalogs, Wireframes & Component Trees | Complete Module Catalogs 1 to 6 in `frontend/DOCUMENTACION/PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` with complete Markdown/ASCII wireframes, field tables, validation rules, component trees, and Mermaid flow diagrams. | M2 | DONE |
| M4 | Final Integration, Dual-Track Verification & Gate Pass | Comprehensive cross-review, markdown & mermaid verification, challenger empirical checks, and forensic audit verification. | M3 | DONE |

---

## Interface Contracts

### 1. HTTP Client & Error Handling Contract
- **Base URL**: `/api/v1`
- **Headers**:
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `X-Correlation-ID: <UUIDv4>`
  - `Content-Type: application/json` (or `multipart/form-data` where applicable)
- **RFC 7807 Problem Details Schema**:
  ```typescript
  export interface ApiProblemDetails {
    type: string;          // URI identifying problem type
    title: string;         // Short human-readable summary
    status: number;        // HTTP status code (400, 401, 403, 404, 409, 422, 500)
    detail: string;        // Detailed explanation of specific occurrence
    instance: string;      // URI of resource instance
    code?: string;         // Internal business error code (e.g. ERR_LPAG_FUERA_HORARIO)
    invalidParams?: Array<{
      name: string;
      reason: string;
      value?: unknown;
    }>;
    timestamp: string;     // ISO 8601 UTC
    correlationId: string; // UUID matching X-Correlation-ID
  }
  ```

### 2. MinIO / S3 Presigned URL Upload Contract
1. Frontend calculates SHA-256 of file buffer locally using Web Crypto API.
2. Frontend validates magic bytes (header bytes for `%PDF`, `PK\x03\x04`, etc.).
3. Frontend calls `POST /api/v1/storage/presigned-url` with `{ fileName, fileSize, contentType, sha256Hex, category }`.
4. Backend returns `{ uploadUrl, fileKey, expiresAt, requiredHeaders }`.
5. Frontend executes `PUT <uploadUrl>` with binary body and `x-amz-checksum-sha256`.
6. Frontend notifies backend of upload completion via transaction creation endpoint.

---

## Code Layout

- Agent State & Metadata: `.agents/`
  - `.agents/orchestrator_2/`: Current orchestrator state (`BRIEFING.md`, `progress.md`, `DISPATCH.md`, `GATE_STATUS.md`, `plan.md`, `handoff.md`)
  - `.agents/<subagent_id>/`: Subagent working directories (`handoff.md`, `progress.md`, `report.md`)
- Master Documentation Targets:
  - `frontend/DOCUMENTACION/INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` (Target Document 1 - v3.0.0, 977 lines, 109.7 KB, 12 Mermaid diagrams, 47 routes audited - 100% Verified)
  - `frontend/DOCUMENTACION/PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` (Target Document 2 - v4.0.0, 3,164 lines, 211.2 KB, 8 Mermaid diagrams, 30 INVEST stories with Gherkin, 256 SP - 100% Verified)
- Verification & Test Track:
  - `TEST_INFRA.md` & `TEST_READY.md` (131 test cases across 5 tiers, 100% verified)

