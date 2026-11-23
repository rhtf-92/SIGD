import { Pool } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DocumentoStorageService } from '../core/storage/documento-storage.service.js';
import { a4GeneratorService } from '../domains/docucore/a4Generator.service.js';
import { CvdStampService } from '../domains/docucore/cvdStamp.service.js';
import type { ContenidoResolucion, OpcionesGeneracion } from '../domains/docucore/types.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@postgres:5432/sigd_prueba';
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const storage = new DocumentoStorageService();
  const baseStorageDir = process.env.STORAGE_LOCAL_DIR || '/app/.storage/sigd-expedientes';

  console.log('--- REGENERANDO DOCUMENTOS HISTÓRICOS Y DE PRUEBA ---');
  console.log('Directorio base de almacenamiento:', baseStorageDir);

  try {
    // 1. REGENERAR TODOS LOS CARGOS DE MESA DIGITAL / PRESENCIAL
    const resCargos = await client.query<{
      documento_adjunto_id: string;
      nombre_archivo: string;
      s3_key: string;
      s3_bucket: string;
      expediente_id: string;
      codigo_expediente: string;
      asunto: string;
      creado_en: Date;
      numero_documento: string;
      nombre_completo?: string;
      razon_social?: string;
    }>(`
      SELECT 
        d.documento_adjunto_id,
        d.nombre_archivo,
        d.s3_key,
        d.s3_bucket,
        e.expediente_id,
        e.codigo_expediente,
        COALESCE(t.asunto, ar.asunto, 'Trámite Documentario Institucional') as asunto,
        d.creado_en,
        p.id_documento as numero_documento,
        pn.nombre_completo,
        pj.razon_social
      FROM sigd_doc.documento_adjunto d
      JOIN sigd_tra.expediente e ON (d.expediente_tra_id = e.expediente_id)
      LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
      LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id
      LEFT JOIN sigd_auth.persona p ON e.solicitante_id = p.id_persona
      LEFT JOIN sigd_auth.persona_natural pn ON p.id_persona = pn.id_persona
      LEFT JOIN sigd_auth.persona_juridica pj ON p.id_persona = pj.id_persona
      WHERE d.nombre_archivo LIKE 'Cargo_%' OR d.s3_key LIKE '%/cargos/%'
      ORDER BY d.creado_en ASC;
    `);

    console.log(`Encontrados ${resCargos.rows.length} cargos para regenerar.`);

    for (const fila of resCargos.rows) {
      const nombreSolicitante = fila.razon_social
        ? fila.razon_social.toUpperCase()
        : fila.nombre_completo?.toUpperCase() || 'ARÉVALO BOLAÑOZ RICARDO';

      const docNum = fila.numero_documento || '05850689';
      const enmascarado = `${docNum.slice(0, 2)}***${docNum.slice(-3)}`;
      const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const urlConsulta = `${frontendBase}/consulta/${encodeURIComponent(fila.codigo_expediente)}?documento=${encodeURIComponent(docNum)}`;

      // Buscar contexto TUPA si existe
      let codigoTupa = 'TUPA-2026';
      let denominacionTupa = fila.asunto;
      let costoTupa = 100.00;

      try {
        const resTupa = await client.query<{ codigo_tupa: string; denominacion: string; costo: string }>(`
          SELECT rv.codigo_tupa, p.denominacion, rv.costo_unitario as costo
          FROM sigd_doc.expediente_tupa_vinculo etv
          JOIN sigd_doc.tupa_registro_version rv ON etv.registro_version_id = rv.registro_version_id
          JOIN sigd_doc.tupa_procedimiento p ON rv.procedimiento_id = p.procedimiento_id
          WHERE etv.expediente_id = $1
          LIMIT 1;
        `, [fila.expediente_id]);

        if (resTupa.rows[0]) {
          codigoTupa = resTupa.rows[0].codigo_tupa;
          denominacionTupa = resTupa.rows[0].denominacion;
          costoTupa = Number(resTupa.rows[0].costo) || 100.00;
        }
      } catch {
        // Fallback default
      }

      console.log(`Generando Cargo formal para CUT: ${fila.codigo_expediente} (${fila.nombre_archivo})...`);
      const nuevoBuffer = await storage.generarCargoPdf({
        cut: fila.codigo_expediente,
        fechaHora: fila.creado_en || new Date(),
        nombreSolicitante,
        documentoEnmascarado: enmascarado,
        asunto: fila.asunto || 'Trámite Documentario Institucional',
        folios: 1,
        operadorMesa: 'Mesa de Partes Digital',
        codigoTupa,
        denominacionTupa,
        costoTupa,
        urlConsulta,
      });

      const nuevoHash = crypto.createHash('sha256').update(nuevoBuffer).digest('hex');
      const tamanoBytes = nuevoBuffer.length;

      // Escribir en almacenamiento local
      const rutaFisica = path.join(baseStorageDir, fila.s3_key);
      fs.mkdirSync(path.dirname(rutaFisica), { recursive: true });
      fs.writeFileSync(rutaFisica, nuevoBuffer);
      console.log(` -> Guardado en: ${rutaFisica} (${tamanoBytes} bytes, SHA-256: ${nuevoHash.slice(0, 8)}...)`);

      // Actualizar en base de datos
      await client.query(`
        UPDATE sigd_doc.documento_adjunto
        SET sha256 = $1, tamano_bytes = $2
        WHERE documento_adjunto_id = $3::uuid;
      `, [nuevoHash, tamanoBytes, fila.documento_adjunto_id]);
    }

    // 2. REGENERAR TODAS LAS RESOLUCIONES DIRECTORALES
    const resResoluciones = await client.query<{
      documento_adjunto_id: string;
      nombre_archivo: string;
      s3_key: string;
      expediente_id: string;
      codigo_expediente: string;
      asunto: string;
      numero_documento: string;
      nombre_completo?: string;
      creado_en: Date;
    }>(`
      SELECT 
        d.documento_adjunto_id,
        d.nombre_archivo,
        d.s3_key,
        e.expediente_id,
        e.codigo_expediente,
        COALESCE(t.asunto, ar.asunto, 'Certificado Institucional') as asunto,
        p.id_documento as numero_documento,
        pn.nombre_completo,
        d.creado_en
      FROM sigd_doc.documento_adjunto d
      JOIN sigd_tra.expediente e ON (d.expediente_tra_id = e.expediente_id)
      LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
      LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id
      LEFT JOIN sigd_auth.persona p ON e.solicitante_id = p.id_persona
      LEFT JOIN sigd_auth.persona_natural pn ON p.id_persona = pn.id_persona
      WHERE d.nombre_archivo LIKE 'Resolucion_RD-%' OR d.s3_key LIKE 'resoluciones/%'
      ORDER BY d.creado_en ASC;
    `);

    console.log(`Encontradas ${resResoluciones.rows.length} resoluciones para regenerar.`);

    for (const resDoc of resResoluciones.rows) {
      const numResMatch = resDoc.nombre_archivo.match(/RD-\d{4}-\d+/);
      const numeroResolucion = numResMatch ? numResMatch[0] : 'RD-2026-000001';
      const solicitante = resDoc.nombre_completo?.toUpperCase() || 'ARÉVALO BOLAÑOZ RICARDO';
      const dni = resDoc.numero_documento || '05850689';

      const contenido: ContenidoResolucion = {
        bloques: [
          {
            tipo: 'parrafo',
            texto: 'Pucallpa, 23 de noviembre de 2026',
            alineacion: 'derecha',
            espacioDespues: 12,
          },
          {
            tipo: 'tabla',
            columnas: ['DATOS DEL EXPEDIENTE Y CERTIFICACIÓN', 'DETALLE REGISTRADO EN EL SIGD - IESTP "SUIZA"'],
            anchosRelativos: [1.15, 2.1],
            cuerpo: 9.5,
            espacioAntes: 2,
            espacioDespues: 10,
            filas: [
              ['Código Único de Trámite (CUT):', resDoc.codigo_expediente],
              ['Solicitante / Estudiante:', solicitante],
              ['Documento de Identidad:', `DNI N° ${dni}`],
              ['Procedimiento TUPA:', resDoc.asunto || 'Certificado Oficial'],
              ['Sede Institucional:', 'IESTP "Suiza" de Pucallpa · Av. Túpac Amaru Km. 4.200, Callería - Ucayali'],
            ],
          },
          {
            tipo: 'encabezado',
            texto: 'VISTO:',
            nivel: 2,
            espacioAntes: 8,
            espacioDespues: 4,
          },
          {
            tipo: 'parrafo',
            texto: `El Expediente Administrativo CUT N° ${resDoc.codigo_expediente}, promovido por don/doña ${solicitante}, identificado(a) con DNI N° ${dni}, solicitando la atención del procedimiento institucional "${resDoc.asunto}" ante el Instituto de Educación Superior Tecnológico Público "Suiza" de Pucallpa; el Informe y Dictamen Técnico favorable emitido por la Coordinación de área y la Subdirección Académica; y,`,
            alineacion: 'justificado',
            espacioDespues: 10,
          },
          {
            tipo: 'encabezado',
            texto: 'CONSIDERANDO:',
            nivel: 2,
            espacioAntes: 8,
            espacioDespues: 4,
          },
          {
            tipo: 'parrafo',
            texto: 'Que, el Instituto de Educación Superior Tecnológico Público "Suiza" de Pucallpa, institución pública de educación superior adscrita a la Dirección Regional de Educación de Ucayali (DREU) y revalidada mediante R.D. N° 0507-2006-ED, garantiza la formación tecnológica, evaluación académica y certificación oficial conforme a la Ley N° 30512, Ley de Institutos y Escuelas de Educación Superior y de la Carrera Pública de sus Docentes, y su Reglamento aprobado por D.S. N° 010-2017-MINEDU;',
            alineacion: 'justificado',
            espacioDespues: 6,
          },
          {
            tipo: 'parrafo',
            texto: `Que, don/doña ${solicitante} cumplió con presentar los requisitos documentales y el derecho de tramitación establecidos en el Texto Único de Procedimientos Administrativos (TUPA) del IESTP "Suiza" de Pucallpa; habiendo sido evaluado(a) satisfactoriamente por el Docente Especialista y contando con la conformidad de la Subdirección Académica;`,
            alineacion: 'justificado',
            espacioDespues: 6,
          },
          {
            tipo: 'parrafo',
            texto: 'Estando a lo informado por la Subdirección Académica y en uso de las atribuciones conferidas a la Dirección General del Instituto de Educación Superior Tecnológico Público "Suiza" de Pucallpa;',
            alineacion: 'justificado',
            espacioDespues: 12,
          },
          {
            tipo: 'encabezado',
            texto: 'SE RESUELVE:',
            nivel: 2,
            espacioAntes: 8,
            espacioDespues: 6,
          },
          {
            tipo: 'parrafo',
            texto: `Artículo Primero.- DECLARAR PROCEDENTE Y OTORGAR LA CERTIFICACIÓN OFICIAL solicitada por don/doña ${solicitante} (DNI N° ${dni}), recaída en el Expediente Administrativo N° ${resDoc.codigo_expediente}, correspondiente al procedimiento "${resDoc.asunto}" en el Instituto de Educación Superior Tecnológico Público "Suiza" de Pucallpa.`,
            alineacion: 'justificado',
            espacioDespues: 8,
          },
          {
            tipo: 'parrafo',
            texto: 'Artículo Segundo.- ENCARGAR a la Subdirección Académica, a la Coordinación correspondiente y a Secretaría Académica del IESTP "Suiza" de Pucallpa el registro del presente acto resolutivo y de la certificación otorgada en los libros y actas oficiales de la institución.',
            alineacion: 'justificado',
            espacioDespues: 8,
          },
          {
            tipo: 'parrafo',
            texto: 'Artículo Tercero.- NOTIFICAR la presente Resolución Directoral y Certificación Oficial al correo electrónico y Casilla Electrónica del administrado, conforme al TUO de la Ley N° 27444, Ley del Procedimiento Administrativo General.',
            alineacion: 'justificado',
            espacioDespues: 16,
          },
          {
            tipo: 'parrafo',
            texto: 'REGÍSTRESE, COMUNÍQUESE Y ARCHÍVESE.',
            alineacion: 'centro',
            espacioAntes: 10,
            espacioDespues: 14,
          },
          {
            tipo: 'firma',
            cargo: 'DIRECTOR GENERAL · IESTP "SUIZA" DE PUCALLPA',
            nombre: 'Carlos Alberto Sánchez',
            documento: 'DNI N° 99000005',
            alineacion: 'centro',
            espacioAntes: 18,
          },
        ],
      };

      const opciones: OpcionesGeneracion = {
        membrete: {
          institucion: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
          unidad: 'DIRECCIÓN GENERAL · PUCALLPA, REGIÓN UCAYALI',
          direccion: 'Av. Túpac Amaru Km. 4.200, Callería - Pucallpa, Ucayali · Revalidado R.D. N° 0507-2006-ED',
          tipoDocumento: 'RESOLUCIÓN DIRECTORAL INSTITUCIONAL',
          numeroDocumento: numeroResolucion,
          correlativo: `EXP: ${resDoc.codigo_expediente}`,
          sigla: 'IESTP "Suiza" Pucallpa - Dirección General',
        },
      };

      console.log(`Generando Resolución formal ${numeroResolucion} para CUT: ${resDoc.codigo_expediente}...`);
      const docA4 = await a4GeneratorService.generar(contenido, opciones);

      // Estampar CVD y QR oficial
      const cvd = `CVD-2026-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      const portalPublico = process.env.APP_URL || process.env.HOST_PUBLICO || 'http://localhost:5173';
      const cvdStampService = new CvdStampService(portalPublico);
      const pdfEstampado = await cvdStampService.estampar(Buffer.from(docA4.bytes), cvd);

      const nuevoHash = crypto.createHash('sha256').update(pdfEstampado).digest('hex');
      const tamanoBytes = pdfEstampado.length;

      // Escribir en almacenamiento local
      const rutaFisica = path.join(baseStorageDir, resDoc.s3_key);
      fs.mkdirSync(path.dirname(rutaFisica), { recursive: true });
      fs.writeFileSync(rutaFisica, pdfEstampado);
      console.log(` -> Guardado en: ${rutaFisica} (${tamanoBytes} bytes, SHA-256: ${nuevoHash.slice(0, 8)}...)`);

      // Si existe versión firmados/, también actualizarla
      const rutaFirmados = path.join(baseStorageDir, resDoc.s3_key.replace('resoluciones/', 'firmados/'));
      try {
        fs.mkdirSync(path.dirname(rutaFirmados), { recursive: true });
        fs.writeFileSync(rutaFirmados, pdfEstampado);
      } catch {
        // Ignorar
      }

      // Actualizar en base de datos
      await client.query(`
        UPDATE sigd_doc.documento_adjunto
        SET sha256 = $1, tamano_bytes = $2
        WHERE documento_adjunto_id = $3::uuid;
      `, [nuevoHash, tamanoBytes, resDoc.documento_adjunto_id]);
    }

    console.log('✅ REGENERACIÓN COMPLETA EXITOSA.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error durante la regeneración:', err);
  process.exit(1);
});
