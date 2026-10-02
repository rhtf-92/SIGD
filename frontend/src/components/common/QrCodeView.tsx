import { QRCodeSVG } from "qrcode.react";

interface QrCodeViewProps {
  value: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export default function QrCodeView({
  value,
  size = 200,
  className = "",
  ariaLabel = "Código QR de verificación digital",
}: QrCodeViewProps) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      includeMargin
      role="img"
      aria-label={ariaLabel}
      className={`inline-block select-none bg-white ${className}`}
    />
  );
}
