export interface DiapositivaPortada {
  id: string;
  src: string;
  titulo: string;
  descripcion: string;
}

export interface VideoInstitucional {
  id: string;
  src: string;
  categoria: string;
  titulo: string;
  descripcion: string;
}

/** Imágenes de la portada, en el orden en que fueron subidas. */
export const DIAPOSITIVAS_PORTADA: DiapositivaPortada[] = [
  {
    id: "instituto-01",
    src: "/images/carrusel/Gemini_Generated_Image_v7dco1v7dco1v7dc.jpg",
    titulo: "IESTP Suiza",
    descripcion: "Formación técnica de calidad en Pucallpa, Ucayali.",
  },
  {
    id: "instituto-02",
    src: "/images/carrusel/Gemini_Generated_Image_ko05nko05nko05nk.jpg",
    titulo: "Nuestra comunidad educativa",
    descripcion: "Estudiantes y docentes comprometidos con la excelencia.",
  },
  {
    id: "instituto-03",
    src: "/images/carrusel/Gemini_Generated_Image_ezv0b0ezv0b0ezv0.jpg",
    titulo: "Ambientes de aprendizaje",
    descripcion: "Talleres y laboratorios equipados para tu formación.",
  },
  {
    id: "instituto-04",
    src: "/images/carrusel/Gemini_Generated_Image_pugk1qpugk1qpugk.jpg",
    titulo: "Vida estudiantil",
    descripcion: "Actividades académicas y culturales durante todo el año.",
  },
  {
    id: "instituto-05",
    src: "/images/carrusel/Gemini_Generated_Image_g4go6yg4go6yg4go.jpg",
    titulo: "Comprometidos con tu futuro",
    descripcion: "Una institución que impulsa el desarrollo de la región.",
  },
];

/** Videos institucionales eliminados del sistema. */
export const VIDEOS_INSTITUCIONALES: VideoInstitucional[] = [];
