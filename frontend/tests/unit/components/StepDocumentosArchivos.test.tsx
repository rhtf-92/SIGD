import { useReducer } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StepDocumentos } from '@/components/tramite/WizardSteps/StepDocumentos';
import { wizardReducer } from '@/hooks/useTramiteWizardReducer';
import { INITIAL_WIZARD_STATE, type ArchivoTramite } from '@/types/tramiteWizardState';
import { useAuthStore } from '@/stores/authStore';
import { consultarDocumentacion } from '@/services/documentacionTramiteService';
import { apiClient } from '@/api/client';
import { CATALOGO_TUPA_MESA_PARTES } from '@/data/catalogoTupaMesaPartes';

const subidas = vi.hoisted(() => ({ upload: vi.fn(), cancel: vi.fn() }));
vi.mock('@/hooks/usePresignedUpload', () => ({ usePresignedUpload: () => ({ ...subidas, status:'idle',progress:0,error:null }) }));
vi.mock('@/components/tramite/OrdenPagoTramite', () => ({ default: () => null }));
vi.mock('@/components/tramite/OrdenPagoPublica', () => ({ default: () => null }));
vi.mock('@/services/radicacionPublicaService', () => ({ publicAvailability: async () => [], resetPublicSubmission: vi.fn() }));
vi.mock('@/services/documentacionTramiteService', async original => ({ ...await original<typeof import('@/services/documentacionTramiteService')>(), consultarDocumentacion:vi.fn() }));

const id='11111111-1111-4111-8111-111111111111',otro='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333';
const anterior: ArchivoTramite={nombre:'anterior.pdf',peso:100,hashSha256:'a'.repeat(64),storageUrl:'expedientes/2026/11111111-1111-4111-8111-111111111111.pdf',clasificacion:'EXPEDIENTE'};
function detalle(procedimiento:string, obligatorio=false): import('@/types/documentacionTramite').DocumentacionTramite {
  return {id:procedimiento,codigo:'PRUEBA',denominacion:'Fixture documental',condicionFinanciera:'GRATUITO',tarifa:null,anexos:[],nota:'Fixture',requisitos:[{id:rid,codigo:'FUT',nombre:'FUT fixture',obligatorio,clasificacion:'EXPEDIENTE',tipos:[{id:rid,codigo:'FUT',nombre:'FUT',condicion:null}]}]};
}
function Harness({ archivos=[] }: { archivos?:ArchivoTramite[] }) {
  const [state,dispatch]=useReducer(wizardReducer,{...INITIAL_WIZARD_STATE,documentos:{...INITIAL_WIZARD_STATE.documentos,tipoTramiteId:id,asunto:'Solicitud de ensayo de archivos',numeroFolios:2,archivos}});
  return <><StepDocumentos data={state.documentos} dispatch={dispatch} onNext={vi.fn()} onBack={vi.fn()}/><output data-testid="datos">{JSON.stringify(state.documentos)}</output></>;
}
const estado=()=>JSON.parse(screen.getByTestId('datos').textContent!);
async function cargar(nombre='nuevo.pdf') {
  await screen.findByLabelText('Clasificación del nuevo archivo');
  fireEvent.change(document.querySelector('input[id$="-file-upload"]')!,{target:{files:[new File(['%PDF-1.7'],nombre,{type:'application/pdf'})]}});
}
beforeEach(()=>{
  useAuthStore.setState({isAuthenticated:true});subidas.upload.mockReset();
  let numero=0;
  subidas.upload.mockImplementation(async(file:File)=>({file,sha256:(++numero===1?'b':'c').repeat(64),s3Key:`expedientes/2026/22222222-2222-4222-8222-22222222222${numero}.pdf`}));
  vi.spyOn(apiClient,'get').mockResolvedValue({data:[id,otro].map((id,i)=>({id,codigo:'SUZ26-00'+(i+1),denominacion:'Fixture '+i,vigente:true,unidad_organica:null}))});
  vi.mocked(consultarDocumentacion).mockImplementation(async id=>detalle(id));
});
afterEach(()=>{vi.restoreAllMocks();useAuthStore.setState({isAuthenticated:false});});
describe('Carga, sustitución y aislamiento de adjuntos',()=>{
  it('ofrece exactamente los 72 registros persistidos, en orden original y sin la tarjeta de catálogo',async()=>{
    const tipos = CATALOGO_TUPA_MESA_PARTES.map((p, i) => ({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      codigo: p.codigoVisible,
      codigoVisible: p.codigoVisible,
      numeroVisible: p.numeroVisible,
      codigoInterno: p.codigoInterno,
      denominacion: p.nombre,
      costoFuente: p.costoFuente,
      vigente: true,
      unidad_organica: null,
    }));
    vi.mocked(apiClient.get).mockResolvedValue({data:[...tipos].reverse()});
    render(<Harness/>);
    await waitFor(()=>expect(document.querySelectorAll('select[name="tipoTramiteId"] option:not([disabled])')).toHaveLength(72));
    const options=Array.from(document.querySelectorAll<HTMLOptionElement>('select[name="tipoTramiteId"] option')).filter(o=>o.value&&!o.disabled);
    expect(options.map(o=>o.value)).toEqual(tipos.map(t=>t.id));
    expect(options.map(o=>o.textContent?.trim())).toEqual(CATALOGO_TUPA_MESA_PARTES.map(p=>`${p.codigoVisible} — ${p.nombre} — ${p.costoFuente}`));
    expect(screen.queryByRole('heading',{name:'Catálogo TUPA 2026'})).not.toBeInTheDocument();
  });
  it('elimina solo la asociación local y vuelve a bloquear el avance',async()=>{
    render(<Harness archivos={[anterior]}/>);await screen.findByLabelText('Clasificación del nuevo archivo');
    fireEvent.click(screen.getByRole('button',{name:'Eliminar'}));
    expect(estado().archivos).toEqual([]);expect(subidas.upload).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:/^Siguiente/})).toBeDisabled();
  });
  it('sustituye después del éxito y no conserva dos referencias',async()=>{
    render(<Harness archivos={[anterior]}/>);await screen.findByLabelText('Clasificación del nuevo archivo');
    fireEvent.change(screen.getByLabelText('Sustituir anterior.pdf'),{target:{files:[new File(['%PDF-1.7'],'nuevo.pdf',{type:'application/pdf'})]}});
    await waitFor(()=>expect(estado().archivos[0].nombre).toBe('nuevo.pdf'));expect(estado().archivos).toHaveLength(1);expect(estado().archivos[0].storageUrl).not.toBe(anterior.storageUrl);
  });
  it('conserva el documento anterior si falla la sustitución',async()=>{
    subidas.upload.mockRejectedValue(new Error('MinIO no disponible'));render(<Harness archivos={[anterior]}/>);await screen.findByLabelText('Clasificación del nuevo archivo');
    fireEvent.change(screen.getByLabelText('Sustituir anterior.pdf'),{target:{files:[new File(['%PDF'],'nuevo.pdf',{type:'application/pdf'})]}});
    await screen.findByText(/MinIO no disponible/);expect(estado().archivos).toEqual([anterior]);
  });
  it('permite más de un archivo con clasificación EXPEDIENTE',async()=>{
    render(<Harness/>);await cargar('uno.pdf');await waitFor(()=>expect(estado().archivos).toHaveLength(1));
    await cargar('dos.pdf');await waitFor(()=>expect(estado().archivos).toHaveLength(2));expect(screen.getByRole('button',{name:/^Siguiente/})).toBeEnabled();
  });
  it('no mezcla una carga tardía con otro procedimiento',async()=>{
    let terminar!: (value:unknown)=>void;
    subidas.upload.mockReturnValue(new Promise(resolve=>{terminar=resolve;}));render(<Harness/>);await cargar();
    fireEvent.change(screen.getByLabelText(/Procedimiento Institucional/),{target:{value:otro}});
    await act(async()=>{terminar({sha256:'b'.repeat(64),s3Key:anterior.storageUrl});});
    expect(estado().tipoTramiteId).toBe(otro);expect(estado().archivos).toEqual([]);
  });
  it('un requisito obligatorio se acredita con su carga individual',async()=>{
    vi.mocked(consultarDocumentacion).mockImplementation(async id=>detalle(id,true));render(<Harness/>);
    const input=await screen.findByLabelText('Adjuntar PDF: FUT fixture');expect(screen.getByRole('button',{name:/^Siguiente/})).toBeDisabled();
    fireEvent.change(input,{target:{files:[new File(['%PDF'],'fut.pdf',{type:'application/pdf'})]}});
    await waitFor(()=>expect(estado().archivos[0]?.requisitoId).toBe(rid));expect(screen.getByRole('button',{name:/^Siguiente/})).toBeEnabled();
  });
});
