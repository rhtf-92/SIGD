import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
export interface RegistroEjecucion {
 codigo:string;orden:string;importe:string;moneda:string;entidad:string;referencia:string;
 fecha_operacion:Date;creada_en:Date;documento_enmascarado:string;demostracion?:boolean;
}
/** Records an already documented external execution; never initiates a transfer. */
export async function generarConstanciaRegistro(r:RegistroEjecucion):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();pdf.setTitle('Constancia de registro de devolución '+r.codigo);pdf.setAuthor('SIGD - IESTP Suiza');pdf.setCreationDate(new Date(r.creada_en));pdf.setModificationDate(new Date(r.creada_en));
 const page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);
 const fecha=(v:Date)=>new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(new Date(v));
 const lineas=['IESTP PUBLICO SUIZA - SIGD','CONSTANCIA DE REGISTRO DE DEVOLUCION','',
  'Solicitud: '+r.codigo,'Orden de pago: '+r.orden,'Titular: documento '+r.documento_enmascarado,
  'Importe registrado: '+r.moneda+' '+r.importe,'Entidad declarada: '+r.entidad,'Referencia de caja: '+r.referencia,
  'Fecha de operacion (Peru): '+fecha(r.fecha_operacion),'Registro de ejecucion (Peru): '+fecha(r.creada_en),'',
  r.demostracion?'DEMOSTRACION - SIN MOVIMIENTO DE DINERO REAL':'Este documento registra la entrega en efectivo asentada en caja.',
  'El recibo interno se conserva en el expediente financiero.',
  'No efectua ni confirma por si mismo una transferencia bancaria.',
  'Recibo interno: no sustituye una boleta o factura SUNAT.',
  'Sin firma digital institucional. Consulta autorizada en Mis pagos.'];
 let y=790;for(const linea of lineas){
  // Preserve unsupported source characters as Unicode escapes, without font errors.
  const texto=linea.replace(/[^\x20-\x7E\u00A0-\u00FF]/gu,c=>'\\u{'+c.codePointAt(0)!.toString(16)+'}');
  for(let i=0;i<Math.max(1,texto.length);i+=76){page.drawText(texto.slice(i,i+76),{x:38,y,size:10,font,color:rgb(.06,.15,.25)});y-=22;}
 }
 return pdf.save();
}
