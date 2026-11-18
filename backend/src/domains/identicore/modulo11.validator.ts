const COEFICIENTES_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
const FORMATO_RUC = /^(10|15|17|20)[0-9]{9}$/;
const FORMATO_DNI = /^[0-9]{8}$/;

export type ResultadoValidacionDocumento =
  | { valido: true; tipo: 'DNI' | 'RUC' }
  | {
      valido: false;
      tipo: 'DNI' | 'RUC';
      codigo: 'DNI_FORMATO_INVALIDO' | 'RUC_FORMATO_INVALIDO' | 'RUC_DIGITO_VERIFICADOR_INVALIDO';
    };

export function calcularDigitoVerificadorRuc(base: string): number | null {
  if (!/^[0-9]{10}$/.test(base)) return null;

  const suma = Array.from(base, (digito, indice) =>
    Number(digito) * COEFICIENTES_RUC[indice],
  ).reduce((total, producto) => total + producto, 0);
  const residuo = suma % 11;
  const calculado = 11 - residuo;

  return calculado === 11 ? 0 : calculado === 10 ? 1 : calculado;
}

export function validarRuc(ruc: string): ResultadoValidacionDocumento {
  if (!FORMATO_RUC.test(ruc)) {
    return { valido: false, tipo: 'RUC', codigo: 'RUC_FORMATO_INVALIDO' };
  }

  const esperado = calcularDigitoVerificadorRuc(ruc.slice(0, 10));
  if (esperado !== Number(ruc[10])) {
    return { valido: false, tipo: 'RUC', codigo: 'RUC_DIGITO_VERIFICADOR_INVALIDO' };
  }

  return { valido: true, tipo: 'RUC' };
}

export function validarDni(dni: string): ResultadoValidacionDocumento {
  return FORMATO_DNI.test(dni)
    ? { valido: true, tipo: 'DNI' }
    : { valido: false, tipo: 'DNI', codigo: 'DNI_FORMATO_INVALIDO' };
}

export function validarDocumento(
  tipo: 'DNI' | 'RUC',
  numero: string,
): ResultadoValidacionDocumento {
  return tipo === 'DNI' ? validarDni(numero) : validarRuc(numero);
}