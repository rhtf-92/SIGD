# E2E Test Infra: SIGD Frontend Documentation & Architecture Blueprint

## Test Philosophy
- Opaque-box, requirement-driven. Derived strictly from ORIGINAL_REQUEST.md and PROJECT.md.
- Methodology: Category-Partition + BVA + Pairwise + Workload & Institutional Domain Validation.

## Feature Inventory & Verification Matrix
| # | Feature | Source (Requirement) | Tier 1 (Feature) | Tier 2 (Boundaries) | Tier 3 (Cross-Combo) |
|---|---------|---------------------|:----------------:|:-------------------:|:--------------------:|
| 1 | Forensic Audit & Traceability | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Legal Compliance (LPAG, MGD, 27269, 29733) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Core Frontend Architecture (FSD, React 19, TS 5.9) | ORIGINAL_REQUEST §R2.1 | 5 | 5 | ✓ |
| 4 | Decoupled S3/MinIO & Presigned Upload | ORIGINAL_REQUEST §R2.2 | 5 | 5 | ✓ |
| 5 | UI Kit & Design System (WCAG 2.1 AA) | ORIGINAL_REQUEST §R2.4 | 5 | 5 | ✓ |
| 6 | RACI Governance & 6 Sprints Schedule | ORIGINAL_REQUEST §R2.5 | 5 | 5 | ✓ |
| 7 | Screen Catalogs, Wireframes & Component Trees M1-M6 | ORIGINAL_REQUEST §R2.3 | 5 | 5 | ✓ |

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Ciudadano submits procedure after 16:30 hrs (LPAG Cutoff & RENIEC Validation) | F2, F3, F4, F7 (M1) | High |
| 2 | Ventanilla Presencial generates CUT barcode sticker and assigns physical folios | F1, F2, F5, F7 (M2) | High |
| 3 | Funcionario derives expediente across 10-state FSM with SLA countdown | F2, F3, F7 (M3) | High |
| 4 | Legal Representative applies Refirma RENIEC Digital Signature with timestamp | F2, F4, F7 (M4) | High |
| 5 | SuperAdmin delegates permissions via temporary encargatura with Resolution | F1, F3, F7 (M5) | High |
| 6 | Director General inspects SLA bottleneck heatmaps and exports Excel/PDF audit | F1, F5, F7 (M6) | Medium |

## Verification Criteria
1. Markdown structure & formatting validity (no broken syntax, unclosed code blocks, or broken tables).
2. Mermaid diagram syntactic correctness (all `graph`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram` blocks must be valid and parseable).
3. Exhaustive coverage of all 6 modules and contributors.
4. Technical fidelity: React 19, TypeScript 5.9, Tailwind 4, TanStack Query v5, Axios interceptors, RFC 7807, MinIO S3 SHA-256 presigned URLs.
5. Legal & institutional alignment: IESTP "Suiza", LPAG 27444, MGD-PCM, Ley 27269, Ley 29733.
