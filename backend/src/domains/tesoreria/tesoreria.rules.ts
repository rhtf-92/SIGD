import { AppError } from '../../shared/domain/errors/index.js';

export function fallo(code: string, message: string, status = 422): never {
  throw new AppError({ status, code, message });
}
/** Money enters/leaves the API as decimal strings, never IEEE-754 numbers. */
export function centimos(importe: string): bigint {
  if (!/^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(importe)) return fallo('IMPORTE_INVALIDO', 'Use un importe decimal con dos cifras, por ejemplo 80.00.');
  return BigInt(importe.replace('.', ''));
}
export function decimal(importe: bigint): string {
  if (importe < 0n) return fallo('SALDO_INVALIDO', 'El saldo financiero no puede ser negativo.');
  return `${importe / 100n}.${String(importe % 100n).padStart(2, '0')}`;
}
export const permisosM10 = [
  'TESORERIA_LEER','TESORERIA_TARIFA_PROPONER','TESORERIA_TARIFA_VALIDAR','TESORERIA_PAGO_REGISTRAR',
  'TESORERIA_PAGO_VERIFICAR','TESORERIA_DEVOLUCION_EVALUAR','TESORERIA_DEVOLUCION_APROBAR','TESORERIA_DEVOLUCION_EJECUTAR','TESORERIA_REPORTES',
] as const;

/**
 * Facultades derivadas de la identidad RBAC ya validada en backend.
 * El administrador supervisa M10 en modo lectura; las mutaciones siguen
 * dependiendo de permisos vigentes asignados al único rol operativo TESORERO.
 */
export function permisosM10ParaRoles(
  roles: readonly string[],
  permisosVigentes: readonly string[],
  administradorGlobal = false,
): string[] {
  const result = new Set<string>();
  if (administradorGlobal || roles.includes('ADMINISTRADOR') || roles.includes('SUPER_ADMIN')) {
    result.add('TESORERIA_LEER');
    result.add('TESORERIA_REPORTES');
  }
  if (roles.includes('TESORERO')) {
    for (const permiso of permisosM10) {
      if (permisosVigentes.includes(permiso)) result.add(permiso);
    }
  }
  return [...result];
}
const pasos: Record<string, readonly string[]> = {
  SOLICITADA: ['EN_EVALUACION'], EN_EVALUACION: ['OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA'],
  OBSERVADA: ['EN_EVALUACION'], PENDIENTE_APROBACION: ['APROBADA','RECHAZADA'],
  APROBADA: ['EN_PROCESO_DEVOLUCION'], EN_PROCESO_DEVOLUCION: ['DEVUELTA'], DEVUELTA: ['CERRADA'],
};
export function permisoTransicion(actual: string, siguiente: string): string {
  if (!pasos[actual]?.includes(siguiente)) return fallo('TRANSICION_INVALIDA', 'La solicitud no admite esa transición.');
  if (['SOLICITADA','EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION'].includes(actual)
      && ['EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA'].includes(siguiente)) return 'TRAMICORE_DEVOLUCION_EVALUAR';
  if (['APROBADA','EN_PROCESO_DEVOLUCION','DEVUELTA'].includes(actual)) return 'TESORERIA_DEVOLUCION_EJECUTAR';
  return fallo('TRANSICION_INVALIDA', 'Esta transicion se resuelve en Mesa de Partes o se ejecuta en Tesoreria segun su estado.');
}
export function validarSaldo(importe: string, total: string, reservado: string): void {
  if (centimos(importe) <= 0n || centimos(importe) > centimos(total) - centimos(reservado)) fallo('DEVOLUCION_SUPERA_SALDO', 'La devolución supera el saldo disponible.');
}

export function condicionFinanciera(tarifas: readonly {importe:string}[]): 'GRATUITO'|'SUJETO_PAGO'|'PENDIENTE_VALIDACION' {
  if(tarifas.length!==1)return 'PENDIENTE_VALIDACION';
  return centimos(tarifas[0].importe)===0n?'GRATUITO':'SUJETO_PAGO';
}
/** Only server-generated append-only entries use this structured envelope. */
export function anexoHistorial(accion:string,motivo:string):{texto:string;documentoId:string}|null{
  if(!['PAGO_SUBSANADO','DEVOLUCION_SUBSANADA'].includes(accion))return null;
  try{const d:unknown=JSON.parse(motivo);if(d&&typeof d==='object'&&'version' in d&&d.version===1&&'texto' in d&&typeof d.texto==='string'&&'documentoId' in d&&typeof d.documentoId==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(d.documentoId))return {texto:d.texto,documentoId:d.documentoId};}catch{/* Historical free-text reasons remain unchanged. */}
  return null;
}
