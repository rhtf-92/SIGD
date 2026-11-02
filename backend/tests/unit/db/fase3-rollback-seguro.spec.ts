import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.resolve(process.cwd(), 'migraciones/26_sigd_devoluciones_y_pagos_adicionales_rollback.sql'), 'utf8');
const rollback24 = fs.readFileSync(path.resolve(process.cwd(), 'migraciones/24_sigd_tupa_requisitos_documentales_rollback.sql'), 'utf8');
const rollback25 = fs.readFileSync(path.resolve(process.cwd(), 'migraciones/25_sigd_vinculacion_historica_rollback.sql'), 'utf8');

describe('Rollback 26: historia financiera preservada', () => {
  it('comprueba DEV y órdenes adicionales antes de cualquier DROP', () => {
    const guard = sql.indexOf('IF EXISTS (SELECT 1 FROM sigd_tra.solicitud_devolucion)');
    const additional = sql.indexOf("IF EXISTS (SELECT 1 FROM sigd_tra.orden_pago WHERE tipo_orden = 'ADICIONAL')");
    const firstDrop = sql.search(/\bDROP\s+(TABLE|INDEX|SEQUENCE|COLUMN)\b/i);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(additional).toBeGreaterThan(guard);
    expect(firstDrop).toBeGreaterThan(additional);
  });

  it('falla explícitamente con DEV o ADICIONAL y no usa CASCADE', () => {
    expect(sql).toMatch(/ROLLBACK_ABORTADO: existen solicitudes DEV o constancias CDEV/);
    expect(sql).toMatch(/ROLLBACK_ABORTADO: existen órdenes ADICIONALES/);
    expect(sql).not.toMatch(/DROP\s+TABLE[^;]*CASCADE/i);
  });
});

describe('Rollbacks TUPA anteriores: preservan datos y dependencias', () => {
  it('rollback 24 aborta si hay requisitos persistidos y no usa CASCADE', () => {
    expect(rollback24).toMatch(/to_regclass\('sigd_doc\.tupa_requisito_documental'\)[\s\S]*AND EXISTS \(SELECT 1 FROM sigd_doc\.tupa_requisito_documental/i);
    expect(rollback24).toMatch(/documento_adjunto[\s\S]*id_requisito IS NOT NULL/i);
    expect(rollback24).toMatch(/Rollback 24 abortado/i);
    expect(rollback24).not.toMatch(/DROP\s+TABLE[^;]*CASCADE/i);
  });

  it('rollback 25 aborta ante solicitudes o atribuciones de creador persistidas y no usa CASCADE', () => {
    expect(rollback25).toMatch(/to_regclass\('sigd_tra\.solicitud_vinculacion_expediente'\)[\s\S]*AND EXISTS \(SELECT 1 FROM sigd_tra\.solicitud_vinculacion_expediente/i);
    expect(rollback25).toMatch(/id_usuario_creador\s+IS NOT NULL/i);
    expect(rollback25).toMatch(/Rollback 25 abortado/i);
    expect(rollback25).not.toMatch(/DROP\s+TABLE[^;]*CASCADE/i);
  });

});
