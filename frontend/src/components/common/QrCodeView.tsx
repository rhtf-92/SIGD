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
  if (!value) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    value
  )}&margin=10`;

  return (
    <img
      src={qrImageUrl}
      alt={ariaLabel}
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      className={`inline-block select-none bg-white ${className}`}
      loading="lazy"
    />
  );
}