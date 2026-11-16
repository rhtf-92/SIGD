/** Never infer that an absent/optional voucher means an officially free service. */
export function admisibilidadPublica(descripcion: string | null, demoVerificada = false,condicion?:'GRATUITO'|'SUJETO_PAGO'|'PENDIENTE_VALIDACION'): { habilitado: boolean; motivo: string; omisionPagoDemo?: boolean } {
  if (demoVerificada) return { habilitado: true, omisionPagoDemo: true,
    motivo: 'RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO. No adjunte comprobantes. Estado económico: NO VERIFICADO. El expediente no podrá avanzar hasta su verificación institucional.' };
  if(condicion==='GRATUITO')return {habilitado:true,motivo:'Gratuidad validada documentalmente en Tesorería. No requiere orden de pago.'};
  if(condicion==='SUJETO_PAGO')return {habilitado:true,motivo:'Primero registre su solicitud. La orden para pagar en efectivo se genera después del CUT.'};
  if(condicion==='PENDIENTE_VALIDACION')return {habilitado:false,motivo:'La condición financiera del procedimiento está pendiente de validación institucional.'};
  const texto = descripcion ?? '';
  const importe = texto.match(/Derecho de pago:\s*S\/\s*([\d,]+(?:\.\d{1,2})?)/i);
  const valor = importe ? Number(importe[1].replace(/,/g, '')) : null;
  if (valor !== null && valor > 0) return {
    habilitado: true,
    motivo: 'Presente su solicitud. La condición económica se atiende después del CUT.',
  };
  if ((valor === 0 || /Derecho de pago:\s*(gratuito|sin costo)\b/i.test(texto)) && /Fuente verificada:/i.test(texto)) {
    return { habilitado: true, motivo: 'Gratuidad documentada en el catálogo institucional.' };
  }
  return { habilitado: true, motivo: 'Puede presentar su solicitud; su recepción no acredita gratuidad ni pago.' };
}
