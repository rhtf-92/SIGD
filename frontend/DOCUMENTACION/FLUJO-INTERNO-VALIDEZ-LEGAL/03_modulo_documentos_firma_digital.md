# 03. Módulo de Creación de Documentos y Firma Digital

## 1. Introducción

Una vez que el flujo de trabajo aprueba el trámite (Paso 4), el sistema debe generar el documento oficial pertinente y otorgarle validez legal mediante **firma digital**, sin necesidad de imprimirlo. Este módulo se encarga de la creación de los documentos a partir de plantillas y de su firma electrónica conforme a la normativa peruana.

## 2. Especificidad IESTP: Integración con Firma Digital en el Perú

La normativa peruana exige que la firma electrónica para documentos oficiales se realice con un proveedor y componente acreditado:

* **Refirma de RENIEC:** permite firmar documentos usando la firma digital del DNI electrónico (DNIe), validada frente al Registro Nacional de Identificación y Estado Civil.
* **Componentes acreditados por INDECOPI / INAIGEM u otras entidades de acreditación:** proveedores de servicios de confianza reconocidos que emiten certificados digitales y prestan servicios de sellado de tiempo.

En el instituto público, la integración es **obligatoria** para dar validez jurídica a documentos como:

* Actas de Notas.
* Certificados de Estudios.
* Resoluciones Directorales.

El frontend no implementa la criptografía; se integra con el servicio/proveedor externo mediante APIs y componentes seguros (p. ej. `JsCadena`, `FirmaEC`, `Refirma` o las librerías del proveedor) para incorporar la firma al documento digital (PDF).

## 3. Firma Digital vs. Firma Electrónica

| Concepto | Descripción |
|----------|-------------|
| Firma electrónica | Término general: datos usados para vincular a la persona con el documento. |
| Firma digital | Tipo de firma electrónica basada en criptografía de clave pública que garantiza **autenticidad**, **integridad** y **no repudio**. |
| Sello de tiempo | Evidencia de que el documento se firmó en una fecha/hora determinada, emitida por una autoridad de confianza. |

La validez legal en el Perú se sustenta en la Ley N.° 27269, su Reglamento (D.S. N.° 052-2008-PCM) y las normas complementarias sobre servicios de confianza.

## 4. Flujo de Firma del Documento

```text
[Documento generado a partir de plantilla]
        │
        ▼
[1] Vista previa y edición de datos del documento
        │
        ▼
[2] Selección del documento y del firmante autorizado
        │
        ▼
[3] Invocación del componente de firma digital (Refirma / proveedor acreditado)
        │  • Autenticación del firmante (DNIe, certificado)
        │  • Cálculo del hash y firma criptográfica
        │  • Sello de tiempo
        ▼
[4] Incorporación de la firma al PDF (visa de firma, metadatos)
        │
        ▼
[5] Verificación de integridad y validez de la firma
        │
        ▼
[6] Almacenamiento y descarga del documento firmado
```

## 5. Documentos que se firman digitalmente

### Actas de Notas
* Resultado oficial de las evaluaciones de un periodo académico.
* Firmadas por el docente y/o Secretaría Académica y validadas por Dirección.

### Certificados de Estudios
* Acreditan los estudios, cursos, créditos y calificaciones del estudiante.
* Requieren firma de la Secretaría Académica y de la Dirección General.

### Resoluciones Directorales
* Actos administrativos del instituto (títulos, ingresos, promociones, sanciones, acuerdos).
* Requieren la firma de la Dirección General y numeración oficial.

## 6. Funcionalidades del Frontend

* **Editor/previsualización de documentos:** muestra el documento generado con datos concatenados del trámite.
* **Selector de plantillas:** elige la plantilla oficial según el tipo de documento.
* **Lista de firmantes pendientes:** indica qué autoridad debe firmar cada documento.
* **Botón "Firmar Digitalmente":** dispara la integración con el componente externo (Refirma/proveedor).
* **Verificador de firma:** permite comprobar la validez de una firma en un documento cargado.
* **Historial de versiones:** control de versiones del documento antes y después de firmar.
* **Descarga y almacenamiento seguro:** guarda el PDF firmado y permite su descarga para el interesado.

## 7. Requisitos para la Integración

* Tener DNI electrónico (DNIe) y certificado digital del firmante, cuando se use Refirma.
* Suscripción/contrato con el proveedor acreditado y obtención de credenciales de API.
* Configuración de las URLs y credenciales en las variables de entorno del frontend (sin exponer secretos).
* Validación legal de las plantillas y textos oficiales con el área jurídica del instituto.
* Cumplimiento de la política de firma definida por la institución (quién, cómo y cuándo firma).
