import QrCodeView from "./QrCodeView";

interface QrCodeGeneratorProps {
  value: string;
  /** Tamaño en px. Por norma institucional el QR de estampa CVD es 200x200. */
  size?: number;
  className?: string;
  ariaLabel?: string;
  /** Nivel de corrección de errores QR. Fijado en M (15% redundancia) por T-FE-DOC-13. */
  errorCorrectionLevel?: "M";
}

/**
 * T-FE-DOC-13 — Generador de código QR de alta resolución (ENT-M04-04, Mayra).
 *
 * Envuelve el render vectorial SVG (`QrCodeView`, 25x25 módulos versión 2)
 * con corrección de errores nivel M (15% de redundancia): legible aun con
 * papel arrugado, tinta tenue o impresión térmica de baja calidad.
 * Salida 100% vectorial (sin canvas rasterizado) para impresión A4 nítida.
 */
export default function QrCodeGenerator({
  value,
  size = 200,
  className = "",
  ariaLabel = "Código QR de verificación digital",
  errorCorrectionLevel = "M",
}: QrCodeGeneratorProps) {
  return (
    <span
      data-testid="qr-code-generator"
      data-error-correction={errorCorrectionLevel}
      className={`inline-block ${className}`}
    >
      <QrCodeView value={value} size={size} ariaLabel={ariaLabel} />
    </span>
  );
}

export { QrCodeView };
