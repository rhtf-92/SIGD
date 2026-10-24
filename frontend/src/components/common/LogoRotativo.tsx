import { useEffect, useState } from "react";

const LOGOS = [
  new URL("../../assets/LOGOS ACTUALES/EDITADO 01 .jpg", import.meta.url).href,
  new URL("../../assets/LOGOS ACTUALES/EDITADO 02.jpg", import.meta.url).href,
  new URL("../../assets/LOGOS ACTUALES/EDITADO 03.jpg", import.meta.url).href,
  new URL("../../assets/LOGOS ACTUALES/EDITADO 04.jpg", import.meta.url).href,
  new URL("../../assets/LOGOS ACTUALES/LOGO PRUEBA .jpg", import.meta.url).href,
];

interface LogoRotativoProps {
  className?: string;
  intervalo?: number;
  alt?: string;
}

export default function LogoRotativo({ className = "", intervalo = 4000, alt = "Logo SIGD" }: LogoRotativoProps) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndice((i) => (i + 1) % LOGOS.length);
    }, intervalo);
    return () => window.clearInterval(id);
  }, [intervalo]);

  return <img src={LOGOS[indice]} alt={alt} className={className} loading="lazy" />;
}
