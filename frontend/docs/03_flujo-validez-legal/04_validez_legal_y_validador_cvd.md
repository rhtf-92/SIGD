| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-FLUJO-VALIDEZ-LEGAL-04 |
| **Módulo** | flujo-validez-legal / Flujo Interno de Trabajo y Validez Legal |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Adriano David Espinoza Ramírez, Isaí, Mayra |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 04. Validez Legal y Validador Público CVD

## 1. Fundamento Jurídico de la Eficacia Probatoria

El valor jurídico de los documentos emitidos por el IESTP "Suiza" radica en el cumplimiento estricto del principio de **validez por competencia y forma**, regulado por el TUO de la Ley N° 27444 y la Ley N° 27269. Para que un acto administrativo o certificación electrónica goce de plena oponibilidad ante instituciones de fiscalización (MINEDU, DREU, SUNEDU), juzgados, colegios profesionales y empleadores, el SIGD implementa cinco pilares de seguridad documental:

1. **Autenticidad de Origen:** Identificación fehaciente de la unidad orgánica y funcionario emisor mediante credenciales y certificados acreditados por la IOFE.
2. **Integridad del Contenido:** Sellado matemático con algoritmo SHA-256 que imposibilita la alteración retroactiva o parcial del texto resolutivo o notas académicas.
3. **Inalterabilidad y Trazabilidad:** Historial de derivación encadenado que audita los dictámenes de las áreas precedentes.
4. **Competencia Legal Exclusiva:** Solo el Director General y los funcionarios designados mediante acto administrativo vigente poseen privilegios en el sistema para suscribir documentos resolutivos.
5. **Copia Auténtica y Verificación Universal:** Cualquier reproducción en soporte físico (impresión) constituye una copia auténtica del documento electrónico original siempre que conserve visible su Código de Verificación Digital (CVD) y código QR institucional (Art. 30 D.S. N° 026-2016-PCM).

---

## 2. Libros Correlativos Anuales de Actos Administrativos

Para garantizar el orden cronológico estricto y prevenir la emisión extemporánea o superposición de numeración, el sistema administra libros correlativos anuales cerrados por año fiscal:

| Denominación del Libro | Nomenclatura Formal | Responsable de Custodia | Objeto Administrativo |
| :--- | :--- | :--- | :--- |
| **Libro Oficial de Resoluciones Directorales** | `RD N.° [0001-9999]-[AAAA]-DG-IESTP-SUIZA` | Secretaría de Dirección | Actos que confieren títulos, aprueban comisiones evaluadoras, resuelven traslados o sancionan faltas. |
| **Libro de Actas Consolidadas de Evaluación** | `ACT-[PROGRAMA]-[SEMESTRE]-[AAAA]-[001-999]` | Secretaría Académica | Consolidación de calificaciones semestrales por unidad didáctica y carrera técnica. |
| **Libro de Certificados Modulares y de Estudios** | `CER-[AAAA]-[000001-999999]` | Unidad de Registro y Matrícula | Certificados oficiales expedidos a estudiantes y egresados. |
| **Libro de Constancias Institucionales** | `CST-[TIPO]-[AAAA]-[000001-999999]` | Mesa de Partes / Secretaría Académica | Constancias de matrícula, egreso, tercio superior y no adeudo. |

*Regla de Invarianza Numérica:* La asignación del número correlativo se ejecuta de forma atómica en la base de datos PostgreSQL en el instante exacto en que la Dirección General estampa la firma digital definitiva, impidiendo "reservas" de números o huecos correlativos.

---

## 3. Especificación Técnica del Validador Público CVD

El **Código de Verificación Digital (CVD)** es un identificador alfanumérico único e irrepetible generado criptográficamente para cada documento oficial finalizado.

### Estructura del Código CVD
```text
CVD - [AÑO] - [TIPO_DOC] - [CORRELATIVO] - [HASH_CHECK]
Ejemplo: CVD-2026-RD-000412-892F
```
* `CVD`: Prefijo estándar institucional.
* `2026`: Año fiscal de emisión.
* `RD`: Sigla del tipo de documento (RD, ACT, CER, CST).
* `000412`: Número correlativo oficial a seis dígitos.
* `892F`: Suma de comprobación (checksum) derivada de los primeros 4 caracteres del hash SHA-256 del documento final firmado.

### URL Pública y Código QR Institucional
Cada documento firmado incluye en su pie de página:
* **URL de Verificación:** `https://tramite.institutosuiza.edu.pe/verificar`
* **Enlace Directo:** `https://tramite.institutosuiza.edu.pe/verificar?cvd=CVD-2026-RD-000412-892F`
* **Código QR Estampado:** Matriz bidimensional de alta densidad (200x200 px) codificando la URL directa con nivel de corrección de error M (15%).

---

## 4. Experiencia de Verificación Pública (Portal Web Abierto)

Cualquier administrado, funcionario de MINEDU, empleador o entidad bancaria puede verificar la autenticidad de un documento sin necesidad de contar con usuario o contraseña en el SIGD:

```text
┌────────────────────────────────────────────────────────────────────────┐
│   PORTAL PÚBLICO DE VERIFICACIÓN DE VALIDEZ LEGAL — IESTP "SUIZA"       │
├────────────────────────────────────────────────────────────────────────┤
│ Ingrese el Código de Verificación Digital (CVD):                       │
│ [ CVD-2026-RD-000412-892F                              ] [ VALIDAR ]   │
│                                                                        │
│ O suba el archivo PDF para validar su firma digital:                   │
│ [ Arrastre el documento PDF aquí o seleccione archivo ]                │
├────────────────────────────────────────────────────────────────────────┤
│                          RESULTADO DE VALIDACIÓN                       │
│                                                                        │
│  ESTADO: [ VÁLIDO — DOCUMENTO AUTÉNTICO E ÍNTEGRO ]                    │
│                                                                        │
│  • Documento: Resolución Directoral N.° 0412-2026-DG-IESTP-SUIZA       │
│  • Asunto: Confiere Título Profesional Técnico en Desarrollo de        │
│            Sistemas de Información al administrado Carlos Mendoza     │
│  • Fecha de Expedición: 05 de Septiembre de 2026, 11:42:15             │
│  • Titular Firmante: Lic. Julio César Mori Paredes (Director General)  │
│  • Entidad Certificadora: RENIEC / IOFE INDECOPI                       │
│  • Integridad Criptográfica: HASH SHA-256 Coincidente                  │
│  • Sello de Tiempo (TSA): Válido (Servicio Oficial de Tiempo)          │
│                                                                        │
│  [ DESCARGAR DOCUMENTO ORIGINAL AUTÉNTICO (PDF/A) ]                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Prevención de Alteraciones y Garantía de Inmutabilidad

1. **Almacenamiento WORM (Write Once, Read Many):** Los documentos PDF/A firmados se almacenan en buckets de MinIO/S3 con políticas de bloqueo de objetos (*Object Lock*) y retención legal inmutable.
2. **Registro en Log Forense:** Cada consulta pública del validador CVD registra fecha, hora, dirección IP y resultado en el módulo de auditoría del sistema para prevenir ataques de denegación de servicio o barrido de correlativos.
3. **Respuesta ante Documentos No Encontrados o Alterados:** Si un usuario somete un PDF adulterado en sus bytes, el sistema emite inmediatamente una alerta roja de advertencia: *"El documento ingresado no coincide con ningún registro institucional legítimo o su contenido ha sido alterado tras la emisión"*, orientando a las autoridades a iniciar las investigaciones legales pertinentes.
