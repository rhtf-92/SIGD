| Metadato | Detalle Institucional |
| :--- | :--- |
| **Código Documental** | SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-06 |
| **Módulo** | administracion-seguridad-auditoria / Administración, Seguridad y Auditoría |
| **Versión** | 1.0.0-PROD |
| **Fecha de Aprobación** | 2026-09-05 |
| **Autores Reconocidos** | Jhonatan Nijar Gonzales De Souza, Angel Vásquez |
| **Estado de Homologación** | Aprobado — Alineado a LPAG Ley N° 27444 y React 19 |

# 06. Calendario Laboral, Jornada Hábil y Cómputo de Plazos LPAG

## 1. Fundamentación Jurídica (TUO Ley N° 27444)

El cómputo de los plazos administrativos es una materia de orden público que garantiza la seguridad jurídica y el debido procedimiento administrativo (Arts. 142 al 152 del TUO de la Ley N° 27444, aprobado por D.S. N° 004-2019-JUS). En el IESTP "Suiza", el vencimiento indebido de un plazo puede acarrear la caducidad del procedimiento, la aplicación no deseada del Silencio Administrativo Negativo o Positivo, o responsabilidades disciplinarias para los funcionarios públicos.

Por ello, el SIGD implementa un motor paramétrico de calendario laboral, articulado directamente en el frontend a través del componente `frontend/src/pages/administracion/CalendarioLaboralPage.tsx`, el cual permite configurar y auditar las reglas de cómputo temporal del instituto.

---

## 2. Parámetros de la Jornada Laboral Institucional

Conforme a la normativa institucional y los convenios laborales del sector educación técnica pública:

1. **Días Hábiles Ordinarios:** De lunes a viernes. Los días sábado y domingo se encuentran deshabilitados como días inhábiles por mandato legal expreso.
2. **Horario Oficial de Operación:** De **08:00 a 17:00 horas**.
3. **Zona Horaria del Sistema:** `America/Lima` (UTC-05:00), sincronizada automáticamente mediante protocolo NTP con la hora oficial del Estado Peruano suministrada por el Instituto Nacional de Calidad (INACAL).
4. **Hora de Corte de Recepción Diaria (16:30 hrs):**
   - Los documentos ingresados por Mesa de Partes (Presencial o Virtual) entre las **08:00 y las 16:30 horas** inician el cómputo de su plazo el mismo día hábil.
   - Todo documento o subsanación ingresado **después de las 16:30 horas** de un día hábil (o en día inhábil) se considera formalmente recibido a las **08:00 horas del primer día hábil siguiente**, fecha en la cual comenzará a computarse el plazo normativo.

---

## 3. Interfaces de Datos en TypeScript (`CalendarioLaboralPage.tsx`)

El componente de interfaz gestiona la parametrización mediante las siguientes estructuras tipadas:

```typescript
export interface DiaLaboral {
  nombre: "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo";
  activo: boolean;
}

export interface Feriado {
  id: number;
  fecha: string; // Formato ISO: 'YYYY-MM-DD'
  nombre: string; // Denominación oficial del feriado o día no laborable
}

export interface ConfiguracionJornada {
  horaInicio: string; // '08:00'
  horaFin: string; // '17:00'
  horaCorteRecepcion: string; // '16:30'
  zonaHoraria: string; // 'America/Lima'
  diasLaborales: DiaLaboral[];
  feriados: Feriado[];
}
```

---

## 4. Catálogo Oficial de Feriados y Días No Laborables

El sistema precarga y permite actualizar dinámicamente dos tipos de días inhábiles:

### 4.1. Feriados Nacionales de Ley (D. Leg. N° 713)
* `01 de Enero`: Año Nuevo.
* `Jueves y Viernes Santo`: Movibles según calendario litúrgico.
* `01 de Mayo`: Día del Trabajo.
* `07 de Junio`: Batalla de Arica y Día de la Bandera.
* `29 de Junio`: San Pedro y San Pablo.
* `23 de Julio`: Día de la Fuerza Aérea del Perú.
* `28 y 29 de Julio`: Fiestas Patrias de la República del Perú.
* `06 de Agosto`: Batalla de Junín.
* `30 de Agosto`: Santa Rosa de Lima.
* `08 de Octubre`: Combate de Angamos.
* `01 de Noviembre`: Día de Todos los Santos.
* `08 de Diciembre`: Inmaculada Concepción.
* `09 de Diciembre`: Batalla de Ayacucho.
* `25 de Diciembre`: Navidad del Señor.

### 4.2. Feriados Regionales y Tradicionales de Ucayali y Coronel Portillo
* `24 de Junio`: **Fiesta Patronal de San Juan Bautista** (Feriado no laborable regional por excelencia en la Amazonía peruana).
* `13 de Octubre`: **Aniversario de la Provincia de Coronel Portillo (Pucallpa)**.
* **Días No Laborables Compensables:** Decretos Supremos expedidos anualmente por la Presidencia del Consejo de Ministros (PCM) para el fomento del turismo interno.

---

## 5. Algoritmo de Cálculo de Vencimiento de Plazos (SLA)

El motor de workflow computa la fecha y hora límite procesal aplicando la siguiente lógica matemática:

```text
Función CalcularVencimiento(FechaIngreso, DiasPlazoSLA):
  1. Si Hora(FechaIngreso) >= 16:30 O EsDiaInhabil(FechaIngreso):
       FechaActual = SiguienteDiaHabil(FechaIngreso) a las 08:00 hrs
     Sino:
       FechaActual = FechaIngreso

  2. DiasContados = 0
  3. Mientras DiasContados < DiasPlazoSLA:
       FechaActual = SumarUnDia(FechaActual)
       Si EsDiaHabil(FechaActual) Y NO EsFeriado(FechaActual):
         DiasContados = DiasContados + 1

  4. FechaVencimiento = EstablecerHora(FechaActual, 17:00 hrs)
  5. Retornar FechaVencimiento
```

### Garantías contra Errores de Borde
* **Cruce de Fines de Semana:** Los días sábado y domingo se omiten automáticamente sin restar días del plazo.
* **Feriados Consecutivos (Puentes):** Si una festividad coincide con jueves y viernes (como Semana Santa o Fiestas Patrias), el plazo se traslada de forma limpia al lunes hábil siguiente.
* **Años Bisiestos y Husos Horarios:** El cálculo delega el manejo cronológico a librerías estándar compatibles con zona horaria IANA `America/Lima`, previniendo desfases por cambios de reloj.
