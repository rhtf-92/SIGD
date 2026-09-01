# 01. Descripción General y Objetivos — Flujo Interno y Validez Legal

## 1. Descripción General

Los trámites de los institutos públicos de educación superior tecnológica (IESTP) culminan en documentos oficiales —Actas, Certificados de Estudios, Resoluciones Directorales y otros— que requieren validez legal para ser oponibles ante estudiantes, egresados, entidades públicas, banca y organismos de fiscalización.

Esta etapa del SIGD (Sistema Integral de Gestión Documentaria del Instituto Suiza) comprende dos módulos complementarios:

1. **Módulo de Flujos de Trabajo (Workflow Académico-Administrativo):** automatiza el recorrido de cada trámite a través de las oficinas y responsables, garantizando que ningún paso se omita y que cada instancia valide la información antes de pasar a la siguiente.
2. **Módulo de Creación de Documentos y Firma Digital:** genera los documentos oficiales y les otorga validez legal mediante firma digital, sin necesidad de imprimir.

Ambos módulos aseguran el control del principio de **debido proceso** documentario: trazabilidad, orden, autorización escalonada y respaldo criptográfico de la autenticidad e integridad de los documentos.

## 2. Objetivo General

Implementar en el frontend del SIGD la interfaz que permita modelar, ejecutar y dar seguimiento a los flujos internos de los trámites académico-administrativos del instituto, y que permita crear, firmar digitalmente y custodiar los documentos oficiales con plena validez legal.

## 3. Objetivos Específicos

* Modelar los flujos de trabajo internos de cada tipo de trámite (Solicitud de Título, Certificados, Resoluciones, Constancias, entre otros)[cite: 1, 2].
* Definir el orden de las instancias o etapas (Secretaría Académica, Administración, Dirección General) y los responsables autorizados en cada una[cite: 1, 2].
* Permitir iniciar, derivar, aprobar, observar y rechazar trámites desde una pantalla de bandeja de trabajo[cite: 1, 2].
* Registrar automáticamente la trazabilidad (quién, cuándo y qué acción se realizó en cada etapa)[cite: 1, 2].
* Generar los documentos oficiales (Actas de Notas, Certificados de Estudios, Resoluciones Directorales) a partir de plantillas[cite: 1, 2].
* Integrar la firma digital electrónica conforme a la normativa peruana vigente, mediante componentes acreditados (p. ej. Refirma de RENIEC u otros acreditados por INDECOPI)[cite: 1, 2].
* Permitir verificar la validez de la firma digital y descargar/almacenar el documento firmado[cite: 1, 2].
* Eliminar la necesidad de imprimir para dar validez a los documentos oficiales[cite: 1, 2].
* Mantener un registro (historial y auditoría) de firmas, versiones y aprobaciones[cite: 1, 2].

## 4. Alcance

Esta documentación cubre la especificación de negocio, los flujos, los modelos de datos, la arquitectura de integración con la firma digital y los componentes de interfaz (UI) del frontend. No sustituye la definición técnica del backend ni la normativa legal vigente; los aspectos regulatorios deben validarse con el área jurídica del instituto y con el proveedor del componente de firma.
