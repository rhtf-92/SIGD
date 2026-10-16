import { AppError } from '../../shared/domain/errors/index.js';

export function exigirVersionBorrador(estado: string, codigo: string): void {
  if (estado !== 'BORRADOR') {
    throw new AppError({
      status: 409,
      code: 'TUPA_VERSION_INMUTABLE',
      message: 'La versión TUPA publicada no se puede modificar.',
      detail: `La versión ${codigo} está ${estado}; solo se permiten cambios en BORRADOR.`,
    });
  }
}

export function exigirPdfParaPublicar(referenciaPdf: string | null): void {
  if (!referenciaPdf) {
    throw new AppError({
      status: 422,
      code: 'RESOLUTION_PDF_REQUIRED',
      message: 'Debe cargar el PDF de la resolución antes de publicar la versión.',
    });
  }
}
