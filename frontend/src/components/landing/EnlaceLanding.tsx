<<<<<<< Updated upstream
import type { ReactNode } from "react";
=======
﻿import type { ReactNode } from "react";
>>>>>>> Stashed changes
import { Link } from "react-router-dom";

import type { EnlaceInstitucional } from "../../data/landingInstitucional";

interface EnlaceLandingProps {
  enlace: EnlaceInstitucional;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}

export default function EnlaceLanding({ enlace, className, children, onClick }: EnlaceLandingProps) {
  const contenido = children ?? enlace.etiqueta;

  if (enlace.href) {
    return (
      <a
        href={enlace.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {contenido}
      </a>
    );
  }

  if (enlace.to?.startsWith("#")) {
    return (
      <a href={enlace.to} className={className} onClick={onClick}>
        {contenido}
      </a>
    );
  }

  return (
    <Link to={enlace.to ?? "/"} className={className} onClick={onClick}>
      {contenido}
    </Link>
  );
}
