import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  AsistenteLLM,
  cargarDocumentosRag,
  crearAsistenteLLMDesdeEntorno,
  seleccionarFragmentos,
  type DocumentoRag,
} from '../../../../src/domains/asistente/asistente.llm.js';

const DOCUMENTOS: readonly DocumentoRag[] = [
  {
    ruta: 'TUPA.md',
    titulo: 'TUPA 2026',
    contenido: 'La matrícula cuesta S/. 200.00 y la expedición de título S/. 105.00.',
  },
  {
    ruta: 'SEDE.md',
    titulo: 'Sede principal',
    contenido: 'La sede principal queda en Av. Centenario Km 3.5, Pucallpa.',
  },
];

function fetchConRespuesta(contenido: string, estado = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: contenido } }] }), {
      status: estado,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function fetchGemini(contenido: string, estado = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: contenido }] } }] }), {
      status: estado,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('AsistenteCore - RAG', () => {
  it('carga documentos Markdown desde un directorio', () => {
    const directorio = mkdtempSync(path.join(tmpdir(), 'sigd-rag-'));
    try {
      writeFileSync(path.join(directorio, 'prueba.md'), '# Prueba\n\nLa matrícula cuesta S/. 200.00.', 'utf8');
      const documentos = cargarDocumentosRag([directorio]);
      expect(documentos).toHaveLength(1);
      expect(documentos[0]?.titulo).toBe('Prueba');
      expect(documentos[0]?.ruta.endsWith('prueba.md')).toBe(true);
    } finally {
      rmSync(directorio, { recursive: true, force: true });
    }
  });

  it('selecciona primero el documento relacionado con la consulta', () => {
    const seleccionados = seleccionarFragmentos('¿Dónde queda la sede?', DOCUMENTOS);
    expect(seleccionados[0]?.ruta).toBe('SEDE.md');
  });

  it('devuelve vacío cuando la consulta no tiene términos útiles', () => {
    expect(seleccionarFragmentos('de la el', DOCUMENTOS)).toEqual([]);
  });
});

describe('AsistenteCore - AsistenteLLM', () => {
  it('no se crea sin API key', () => {
    expect(crearAsistenteLLMDesdeEntorno({})).toBeNull();
  });

  it('respeta ASISTENTE_MOTOR=faq aunque exista API key', () => {
    expect(
      crearAsistenteLLMDesdeEntorno({ ASISTENTE_MOTOR: 'faq', OPENAI_API_KEY: 'clave-prueba' }),
    ).toBeNull();
  });

  it('se crea en modo híbrido con API key', () => {
    expect(
      crearAsistenteLLMDesdeEntorno({ ASISTENTE_MOTOR: 'hibrido', OPENAI_API_KEY: 'clave-prueba' }),
    ).toBeInstanceOf(AsistenteLLM);
  });

  it('se crea con el proveedor Gemini', () => {
    expect(
      crearAsistenteLLMDesdeEntorno({
        ASISTENTE_MOTOR: 'hibrido',
        ASISTENTE_LLM_PROVEEDOR: 'gemini',
        GEMINI_API_KEY: 'clave-prueba',
        ASISTENTE_LLM_MODELO: 'gemini-3.5-flash',
      }),
    ).toBeInstanceOf(AsistenteLLM);
  });

  it('responde con el contexto documental y devuelve las fuentes', async () => {
    let cuerpo: { model?: string; messages?: Array<{ role: string; content: string }> } | undefined;
    const fetchFalso = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'La matrícula cuesta S/. 200.00 [TUPA.md].' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      modelo: 'modelo-prueba',
      documentos: DOCUMENTOS,
      incluirConocimiento: false,
      fetchImpl: fetchFalso,
    });

    const resultado = await asistente.responder('¿Cuánto cuesta la matrícula?');

    expect(resultado.intencion).toBe('llm_rag');
    expect(resultado.respuesta).toContain('S/. 200.00');
    expect(resultado.fuentes).toContain('TUPA.md');
    expect(resultado.motor).toBe('llm-rag');
    expect(cuerpo?.model).toBe('modelo-prueba');
    expect(JSON.stringify(cuerpo?.messages)).toContain('La matrícula cuesta S/. 200.00');
  });

  it('responde con Gemini usando el endpoint nativo y el contexto RAG', async () => {
    let urlLlamada = '';
    let cuerpo: {
      system_instruction?: { parts?: Array<{ text?: string }> };
      contents?: Array<{ parts?: Array<{ text?: string }> }>;
    } | undefined;
    const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      urlLlamada = String(url);
      cuerpo = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Respuesta Gemini [TUPA.md].' }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      proveedor: 'gemini',
      modelo: 'gemini-3.5-flash',
      documentos: DOCUMENTOS,
      incluirConocimiento: false,
      fetchImpl: fetchFalso,
    });

    const resultado = await asistente.responder('¿Cuánto cuesta la matrícula?');

    expect(resultado.respuesta).toContain('Respuesta Gemini');
    expect(resultado.fuentes).toContain('TUPA.md');
    expect(urlLlamada).toContain('/models/gemini-3.5-flash:generateContent');
    expect(cuerpo?.system_instruction?.parts?.[0]?.text).toContain('secretaria virtual');
    expect(JSON.stringify(cuerpo?.contents)).toContain('La matrícula cuesta S/. 200.00');
  });

  it('reintenta la respuesta Gemini con más tokens cuando el proveedor la trunca', async () => {
    const limites: number[] = [];
    let llamadas = 0;
    const fetchFalso = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      llamadas += 1;
      const cuerpo = JSON.parse(String(init?.body)) as {
        generationConfig: { maxOutputTokens: number };
      };
      limites.push(cuerpo.generationConfig.maxOutputTokens);
      const respuesta = llamadas === 1
        ? { text: 'Respuesta incompleta', finishReason: 'MAX_TOKENS' }
        : { text: 'Respuesta completa.', finishReason: 'STOP' };
      return new Response(
        JSON.stringify({
          candidates: [{
            content: { parts: [{ text: respuesta.text }] },
            finishReason: respuesta.finishReason,
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      proveedor: 'gemini',
      documentos: DOCUMENTOS,
      incluirConocimiento: false,
      fetchImpl: fetchFalso,
    });

    const resultado = await asistente.responder('¿Cuánto cuesta la matrícula?');

    expect(resultado.respuesta).toBe('Respuesta completa.');
    expect(limites).toEqual([1400, 2800]);
  });

  it('no devuelve una respuesta Gemini si vuelve a truncarse después del reintento', async () => {
    const fetchFalso = vi.fn(async () => new Response(
      JSON.stringify({
        candidates: [{
          content: { parts: [{ text: 'Respuesta incompleta' }] },
          finishReason: 'MAX_TOKENS',
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as unknown as typeof fetch;
    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      proveedor: 'gemini',
      documentos: DOCUMENTOS,
      incluirConocimiento: false,
      fetchImpl: fetchFalso,
    });

    await expect(asistente.responder('¿Cuánto cuesta la matrícula?')).rejects.toThrow(
      'volvió a truncar la respuesta',
    );
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('consulta la API para preguntas generales aunque no encuentre contexto documental', async () => {
    let cuerpo: { contents?: Array<{ parts?: Array<{ text?: string }> }> } | undefined;
    const fetchFalso = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'La fotosíntesis transforma luz en energía química.' }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      proveedor: 'gemini',
      documentos: [],
      incluirConocimiento: false,
      fetchImpl: fetchFalso,
    });

    const resultado = await asistente.responder('¿Cómo funciona la fotosíntesis?');

    expect(resultado.respuesta).toContain('fotosíntesis');
    expect(resultado.fuentes).toEqual([]);
    expect(resultado.confianza).toBe(0.55);
    expect(JSON.stringify(cuerpo?.contents)).toContain(
      'No se encontraron fragmentos pertinentes en la documentación del proyecto.',
    );
  });

  it('envía la clave Gemini en una cabecera y usa el modelo estable configurado', async () => {
    let urlLlamada = '';
    let cabeceras: RequestInit['headers'];
    const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      urlLlamada = String(url);
      cabeceras = init?.headers;
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Respuesta.' }] } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      proveedor: 'gemini',
      documentos: DOCUMENTOS,
      fetchImpl: fetchFalso,
    });

    await asistente.responder('¿Cuánto cuesta la matrícula?');

    expect(urlLlamada).toContain('/models/gemini-3.6-flash:generateContent');
    expect(urlLlamada).not.toContain('clave-prueba');
    expect(JSON.stringify(cabeceras)).toContain('"x-goog-api-key":"clave-prueba"');
  });

  it('propaga los errores HTTP del proveedor', async () => {
    const asistente = new AsistenteLLM({
      apiKey: 'clave-prueba',
      documentos: DOCUMENTOS,
      incluirConocimiento: false,
      fetchImpl: fetchConRespuesta('error', 500),
    });

    await expect(asistente.responder('¿Cuánto cuesta la matrícula?')).rejects.toThrow('LLM HTTP 500');
  });
});
