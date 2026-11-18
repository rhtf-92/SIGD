import type { DniHardwareAdapter } from './dnieAdapter.types';
import { MockDniProvider, type ConfiguracionMockDnie } from './MockDniProvider';
import { LocalBridgeDniProvider } from './LocalBridgeDniProvider';

let adaptadorActivo: DniHardwareAdapter | null = null;

export function obtenerAdaptadorDnie(): DniHardwareAdapter {
  if (adaptadorActivo) {
    return adaptadorActivo;
  }

  const esProd = typeof window !== 'undefined' && (import.meta as any).env?.PROD;
  if (esProd) {
    adaptadorActivo = new LocalBridgeDniProvider();
  } else {
    adaptadorActivo = new MockDniProvider();
  }

  return adaptadorActivo;
}

export function establecerAdaptadorDnie(adaptador: DniHardwareAdapter | null): void {
  adaptadorActivo = adaptador;
}

export function configurarMockDnie(config: ConfiguracionMockDnie): MockDniProvider {
  const mock = new MockDniProvider(config);
  adaptadorActivo = mock;
  return mock;
}
