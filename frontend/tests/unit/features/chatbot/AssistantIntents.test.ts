import { describe, expect, it } from 'vitest';
import { clasificarIntent } from '../../../../src/features/chatbot/intents';

describe('Asistente SIGD — Clasificador Determinista de Intents (15 Intents Canónicos)', () => {
  it('1. clasifica SALUDO con mensaje de bienvenida institucional', () => {
    const res = clasificarIntent('Hola, buenos días');
    expect(res.intent).toBe('SALUDO');
    expect(res.respuesta).toContain('IESTP "Suiza"');
    expect(res.esFueraDeAlcance).toBe(false);
  });

  it('2. clasifica PRESENTAR_TRAMITE hacia Mesa de Partes Digital', () => {
    const res = clasificarIntent('¿Cómo puedo presentar un trámite?');
    expect(res.intent).toBe('PRESENTAR_TRAMITE');
    expect(res.rutaSugerida).toBe('/mesa-partes');
  });

  it('3. clasifica CONSULTAR_CUT hacia Consulta Pública', () => {
    const res = clasificarIntent('Quiero consultar mi código CUT de trámite');
    expect(res.intent).toBe('CONSULTAR_CUT');
    expect(res.rutaSugerida).toBe('/consulta');
  });

  it('4. clasifica BUSCAR_TUPA hacia el Catálogo TUPA', () => {
    const res = clasificarIntent('Dónde veo el catálogo TUPA 2026');
    expect(res.intent).toBe('BUSCAR_TUPA');
    expect(res.rutaSugerida).toBe('/tupa');
  });

  it('5. clasifica REQUISITOS', () => {
    const res = clasificarIntent('¿Cuáles son los requisitos para un trámite?');
    expect(res.intent).toBe('REQUISITOS');
    expect(res.nodoSugerido).toBe('BUSCAR_TUPA');
  });

  it('6. clasifica COSTO / aranceles', () => {
    const res = clasificarIntent('¿Cuánto cuesta el trámite o cuál es el arancel?');
    expect(res.intent).toBe('COSTO');
    expect(res.respuesta).toContain('Catálogo TUPA');
  });

  it('7. clasifica PLAZO en días hábiles', () => {
    const res = clasificarIntent('¿Cuál es el plazo o cuántos días hábiles demora?');
    expect(res.intent).toBe('PLAZO');
    expect(res.respuesta).toContain('días hábiles');
  });

  it('8. clasifica ESTADO_TRAMITE', () => {
    const res = clasificarIntent('¿Qué significa el estado de mi trámite?');
    expect(res.intent).toBe('ESTADO_TRAMITE');
    expect(res.nodoSugerido).toBe('ESTADOS_TRAMITE');
  });

  it('9. clasifica OBSERVACION', () => {
    const res = clasificarIntent('Mi expediente fue observado en mesa de partes');
    expect(res.intent).toBe('OBSERVACION');
    expect(res.respuesta).toContain('observado');
  });

  it('10. clasifica SUBSANACION', () => {
    const res = clasificarIntent('¿Cómo realizo la subsanación de requisitos?');
    expect(res.intent).toBe('SUBSANACION');
    expect(res.rutaSugerida).toBe('/mesa-partes');
  });

  it('11. clasifica VALIDAR_CVD hacia Validador de Documentos', () => {
    const res = clasificarIntent('Quiero validar un documento con código CVD');
    expect(res.intent).toBe('VALIDAR_CVD');
    expect(res.rutaSugerida).toBe('/validador-cvd');
  });

  it('12. clasifica ACCESO_LOGIN hacia Iniciar Sesión', () => {
    const res = clasificarIntent('Olvidé mi clave para iniciar sesión');
    expect(res.intent).toBe('ACCESO_LOGIN');
    expect(res.rutaSugerida).toBe('/login');
  });

  it('13. clasifica AYUDA', () => {
    const res = clasificarIntent('Necesito ayuda y orientación sobre el SIGD');
    expect(res.intent).toBe('AYUDA');
    expect(res.nodoSugerido).toBe('ROOT');
  });

  it('14. clasifica DESPEDIDA', () => {
    const res = clasificarIntent('Muchas gracias, hasta luego');
    expect(res.intent).toBe('DESPEDIDA');
  });

  it('15. clasifica FUERA_DE_ALCANCE para temas ajenos al instituto', () => {
    const res1 = clasificarIntent('¿Quién va a ganar las elecciones de política?');
    expect(res1.intent).toBe('FUERA_DE_ALCANCE');
    expect(res1.esFueraDeAlcance).toBe(true);
    expect(res1.respuesta).toContain('únicamente con trámites, servicios y uso del Sistema de Gestión Documentaria');

    const res2 = clasificarIntent('Escribe código en javascript para una tarea');
    expect(res2.intent).toBe('FUERA_DE_ALCANCE');
    expect(res2.esFueraDeAlcance).toBe(true);
  });
});
