import type {
  ReportExportConfig,
  ReportExportResult,
} from "@/types/reportExportConfig";

function normalizeText(value: string): string {
  return value.normalize("NFC");
}

function escapePdfText(value: string): string {
  return normalizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toFilterEntries(
  filters: ReportExportConfig["filters"],
): Array<[string, string]> {
  if (Array.isArray(filters)) {
    return filters.map((filter) => [filter.key, String(filter.value ?? "")]);
  }

  return Object.entries(filters ?? {}).map(([key, value]) => [key, String(value ?? "")]);
}

function resolveFileName(config: ReportExportConfig): string {
  const baseName = normalizeText(config.fileName ?? "reporte-sigd");
  return baseName.endsWith(".pdf") ? baseName : `${baseName}.pdf`;
}

function createPdfMarkup(config: ReportExportConfig): string {
  const title = normalizeText(config.title || "Reporte SIGD");
  const institutionName = normalizeText(
    config.institutionName || 'IESTP "Suiza"',
  );
  const generatedAt = normalizeText(
    config.generatedAt ? new Date(config.generatedAt).toLocaleString("es-PE") : new Date().toLocaleString("es-PE"),
  );
  const filterEntries = toFilterEntries(config.filters);
  const checksum = normalizeText(config.checksum ?? "");
  const lines = [
    institutionName,
    title,
    `Fecha de emisión: ${generatedAt}`,
    ...(filterEntries.length > 0
      ? filterEntries.map(([key, value]) => `${key}: ${value}`)
      : ["Sin filtros aplicados"]),
    ...(checksum ? [`SHA-256: ${checksum}`] : []),
  ];

  const contentStream = lines
    .map((line, index) => {
      const yPosition = 760 - index * 22;
      return `BT /F1 12 Tf 54 ${yPosition} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  let offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

async function computeSha256(value: string): Promise<string> {
  if (typeof crypto !== "undefined" && "subtle" in crypto) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return "sha256-unavailable";
}

export async function exportPdfReport(
  config: ReportExportConfig,
): Promise<ReportExportResult> {
  const asset = createPdfMarkup(config);
  const checksum = await computeSha256(asset);

  if (typeof window === "undefined" || typeof URL === "undefined") {
    return {
      downloadUrl: "",
      sha256Checksum: checksum,
      fileName: resolveFileName(config),
      ready: false,
    };
  }

  const blob = new Blob([asset], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  return {
    downloadUrl: url,
    sha256Checksum: checksum,
    fileName: resolveFileName(config),
    ready: true,
  };
}
