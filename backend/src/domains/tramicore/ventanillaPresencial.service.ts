export interface DatosRecepcionFisica {
  idOperadorVentanilla: number;
  datosRemitente: string;
  asunto: string;
  foliosTotales: number;
}

export class VentanillaPresencialService {
  
  public static async registrarExpediente(datos: DatosRecepcionFisica, dbClient: any): Promise<string> {
    try {
      const canalEntrada = 'VENTANILLA_PRESENCIAL';
      
      const anioActual = new Date().getFullYear();
      const cutGenerado = `CUT-${anioActual}-${Math.floor(Math.random() * 9000) + 1000}`;

      const queryExpediente = `
        INSERT INTO sigd_tra.expediente (
          cut, 
          canal_recepcion, 
          id_operador_ventanilla,
          datos_remitente,
          asunto,
          folios,
          estado_tramite, 
          fecha_radicacion
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'RECEPCIONADO', NOW()
        ) RETURNING id_expediente;
      `;
      
      const valores = [
        cutGenerado, 
        canalEntrada, 
        datos.idOperadorVentanilla,
        datos.datosRemitente,
        datos.asunto,
        datos.foliosTotales
      ];

      await dbClient.query(queryExpediente, valores);

      return cutGenerado;

    } catch (error: any) {
      throw new Error(`Error crítico en registro de ventanilla: ${error.message}`);
    }
  }
}