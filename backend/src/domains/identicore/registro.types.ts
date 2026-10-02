export interface DatosRegistro {
  tipoDocumento: 'DNI' | 'RUC';
  numeroDocumento: string;
  correo: string;
  celular: string;
  direccion: string;
  ubigeoDistrito: string;
  nombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  tipoPersona: 'NATURAL' | 'JURIDICA';
  razonSocial?: string;
  nombreComercial?: string;
  documentoRepresentante?: string;
  nombreRepresentante?: string;
  partidaRegistral: string | null;
  aceptaNotificaciones: boolean;
  ipAddress: string | null;
}

export interface RegistroResult {
  idPersona: string;
  casillaId: string;
  mensaje: 'Registro exitoso';
}

export interface RepresentanteLegal {
  id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}