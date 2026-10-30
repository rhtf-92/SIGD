/**
 * ==============================================================================
 * Pruebas unitarias del Motor del Asistente Virtual (AsistenteCore)
 * SIGD - IESTP "Suiza"
 * ==============================================================================
 * Cubre:
 * - Normalización de texto (tildes, puntuación).
 * - Detección de procedimientos del TUPA por código y sinónimo.
 * - Coincidencia de intenciones del FAQ con confianza.
 * - Respuesta de "no encontrado" cuando no hay coincidencia.
 * - Escalamiento del motor compuesto al motor secundario (LLM enchufable).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  MotorCompuesto,
  MotorFAQ,
  detectarProcedimiento,
  normalizarTexto,
} from '../../../../src/domains/asistente/asistente.motor.js';
import type { AsistenteMotor, ResultadoAsistente } from '../../../../src/domains/asistente/asistente.types.js';

describe('AsistenteCore - normalización', () => {
  it('normaliza minúsculas, tildes y puntuación', () => {
    expect(normalizarTexto('¡Matrícula! 2026')).toBe('matricula 2026');
  });
});

describe('AsistenteCore - detección de procedimientos', () => {
  it('detecta por código ACA-05', () => {
    expect(detectarProcedimiento('Requisitos del ACA-05')?.codigo).toBe('ACA-05');
  });

  it('detecta por sinónimo "certificado de estudios"', () => {
    expect(detectarProcedimiento('¿Qué necesito para el certificado de estudios?')?.codigo).toBe('ACA-06');
  });

  it('retorna null si no hay procedimiento', () => {
    expect(detectarProcedimiento('¿Cuál es el horario de atención?')).toBeNull();
  });
});

describe('AsistenteCore - MotorFAQ', () => {
  const motor = new MotorFAQ();

  it('atiende un saludo con intención saludo', async () => {
    const resultado = await motor.responder('¡Hola! Buenas tardes');
    expect(resultado.intencion).toBe('saludo');
    expect(resultado.confianza).toBeGreaterThan(0);
    expect(resultado.motor).toBe('faq');
    expect(resultado.fuentes.length).toBeGreaterThan(0);
  });

  it('responde el plazo legal de 30 días hábiles', async () => {
    const resultado = await motor.responder('¿Cuánto tarda mi trámite?');
    expect(resultado.intencion).toBe('plazo_sla');
    expect(resultado.respuesta).toContain('30 días hábiles');
  });

  it('explica qué es la web y devuelve enlaces internos', async () => {
    const resultado = await motor.responder('¿Qué es esta web y para qué sirve?');
    expect(resultado.intencion).toBe('que_es_sigd');
    expect(resultado.enlaces?.some((enlace) => enlace.ruta === '/tramite')).toBe(true);
  });

  it('reconoce la sugerencia "¿Cómo radico un trámite?"', async () => {
    const resultado = await motor.responder('¿Cómo radico un trámite?');
    expect(resultado.intencion).toBe('radicar_tramite');
    expect(resultado.enlaces?.some((enlace) => enlace.ruta === '/tramite')).toBe(true);
  });

  it('indica cómo llegar a la sede principal', async () => {
    const resultado = await motor.responder('¿Cómo llego al instituto?');
    expect(resultado.intencion).toBe('como_llegar_sede');
    expect(resultado.respuesta).toContain('Av. Centenario Km 3.5');
  });

  it('responde requisitos de un procedimiento detectado', async () => {
    const resultado = await motor.responder('¿Cuáles son los requisitos de la expedición de título?');
    expect(resultado.intencion).toBe('requisitos_tramite');
    expect(resultado.respuesta).toContain('ACA-05');
    expect(resultado.respuesta).toContain('Requisitos');
  });

  it('cita la fuente del TUPA en la respuesta de requisitos', async () => {
    const resultado = await motor.responder('¿Cuánto cuesta el certificado de estudios?');
    expect(resultado.fuentes).toContain('TUPA IESTP "Suiza" 2026');
  });

  it('explica el costo de la carrera y aclara que la pensión no está en el TUPA', async () => {
    const resultado = await motor.responder(
      'Cuanto me costoria pagar desde que ingreso al primer ciclo hasta que me titule como tecnico en DSI',
    );
    expect(resultado.intencion).toBe('costo_carrera');
    expect(resultado.respuesta).toContain('pensión');
    expect(resultado.respuesta).toContain('S/. 200.00');
    expect(resultado.respuesta).toContain('S/. 105.00');
    expect(resultado.respuesta).toContain('S/. 1,382.50');
  });

  it('responde por la pensión mensual sin inventar un monto', async () => {
    const resultado = await motor.responder('¿Cuánto cuesta la pensión mensual de DSI?');
    expect(resultado.intencion).toBe('costo_carrera');
    expect(resultado.respuesta).toContain('no registra una pensión');
  });

  it('devuelve no_encontrado cuando no hay coincidencia', async () => {
    const resultado = await motor.responder('qwerty asdf zxcv');
    expect(resultado.intencion).toBe('no_encontrado');
    expect(resultado.confianza).toBe(0);
    expect(resultado.sugerencias.length).toBeGreaterThan(0);
  });

  it('maneja un mensaje vacío de forma segura', async () => {
    const resultado = await motor.responder('');
    expect(resultado.intencion).toBe('no_encontrado');
  });
});

describe('AsistenteCore - MotorCompuesto', () => {
  const motorSecundario: AsistenteMotor = {
    nombre: 'llm-fake',
    responder: vi.fn(async (): Promise<ResultadoAsistente> => ({
      respuesta: 'Respuesta del motor secundario.',
      intencion: 'secundario',
      confianza: 0.8,
      fuentes: ['RAG'],
      sugerencias: [],
      motor: 'llm-fake',
    })),
  };

  it('usa el secundario cuando la confianza del FAQ es insuficiente', async () => {
    const compuesto = new MotorCompuesto(new MotorFAQ(), motorSecundario, 0.6);
    const resultado = await compuesto.responder('qwerty asdf zxcv');
    expect(resultado.motor).toBe('llm-fake');
    expect(motorSecundario.responder).toHaveBeenCalled();
  });

  it('no usa el secundario cuando el FAQ responde con confianza alta', async () => {
    const compuesto = new MotorCompuesto(new MotorFAQ(), motorSecundario, 0.6);
    const resultado = await compuesto.responder('¿Cuánto tarda mi trámite?');
    expect(resultado.motor).toBe('faq');
    expect(motorSecundario.responder).not.toHaveBeenCalled();
  });

  it('degrada al FAQ y registra el error si el secundario falla', async () => {
    const alFallar = vi.fn();
    const fallido: AsistenteMotor = {
      nombre: 'llm-roto',
      responder: vi.fn(async () => {
        throw new Error('proveedor no disponible');
      }),
    };
    const compuesto = new MotorCompuesto(new MotorFAQ(), fallido, 0.6, alFallar);
    const resultado = await compuesto.responder('qwerty asdf zxcv');
    expect(resultado.motor).toBe('faq');
    expect(resultado.intencion).toBe('no_encontrado');
    expect(alFallar).toHaveBeenCalledWith(expect.any(Error));
  });
});
