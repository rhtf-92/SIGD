import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../src/api/client';
import DashboardEjecutivoPage from '../../../src/pages/DashboardEjecutivoPage';
vi.mock('@/api/client',()=>({apiClient:{get:vi.fn()}}));
function renderDashboard(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return render(<MemoryRouter><QueryClientProvider client={client}><DashboardEjecutivoPage/></QueryClientProvider></MemoryRouter>);}
function respond(){vi.mocked(apiClient.get).mockImplementation(async(url,config)=>{
 const periodo=(config?.params as {periodo?:string}|undefined)?.periodo;
 if(String(url).includes('/tendencias'))return {data:[{mes:1,radicados:120,atendidos:90},{mes:2,radicados:80,atendidos:0},{mes:3,radicados:0,atendidos:0}]} as never;
 if(String(url).includes('/cuellos-botella'))return {data:[]} as never;
 const jan=periodo==='2026-01',feb=periodo==='2026-02';
 return {data:{contadores:{nRadicados:jan?120:feb?80:0,nAtendidos:jan?90:0,nArchivados:0,nResueltos:jan?90:0,nEnTramite:jan?30:feb?80:0,nObservados:jan?3:feb?8:0,nResueltosDentroPlazo:jan?81:0,horasHabilesSuma:jan?90:0}}} as never;
});}
afterEach(()=>vi.clearAllMocks());
describe('Dashboard con contrato mensual real',()=>{
 it('consulta los doce meses sin enviar filtros incompatibles',async()=>{respond();renderDashboard();await screen.findByText('Expedientes registrados');const summaries=vi.mocked(apiClient.get).mock.calls.filter(([url])=>url==='/api/v1/reportes/dashboard/resumen');expect(summaries).toHaveLength(12);expect(summaries[0][1]?.params).toEqual({periodo:'2026-01'});expect(summaries[11][1]?.params).toEqual({periodo:'2026-12'});});
 it('consolida numeradores antes de dividir porcentajes',async()=>{respond();renderDashboard();await screen.findByText('Expedientes registrados');expect(screen.getByText('200')).toBeInTheDocument();const card=screen.getByText('VTEP').closest('article')??screen.getByText('VTEP').parentElement!;expect(card.textContent).toContain('45');});
 it('consulta un solo mes al seleccionar periodo mensual',async()=>{respond();const user=userEvent.setup();renderDashboard();await screen.findByText('Expedientes registrados');vi.mocked(apiClient.get).mockClear();await user.selectOptions(screen.getByLabelText('Periodo'),'month');await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reportes/dashboard/resumen',{params:{periodo:'2026-01'}}));});
 it('cambia el filtro de febrero sin fechas inventadas',async()=>{respond();const user=userEvent.setup();renderDashboard();await screen.findByText('Expedientes registrados');await user.selectOptions(screen.getByLabelText('Periodo'),'month');await user.selectOptions(await screen.findByLabelText('Mes'),'02');await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reportes/dashboard/resumen',{params:{periodo:'2026-02'}}));await screen.findByText('80');});
 it('selecciona un rango de meses completos',async()=>{respond();const user=userEvent.setup();renderDashboard();await screen.findByText('Expedientes registrados');await user.selectOptions(screen.getByLabelText('Periodo'),'custom');const from=await screen.findByLabelText('Desde'),to=screen.getByLabelText('Hasta');expect(from).toHaveAttribute('type','month');fireEvent.change(from,{target:{value:'2026-03'}});fireEvent.change(to,{target:{value:'2026-03'}});await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reportes/dashboard/resumen',{params:{periodo:'2026-03'}}));});
 it('no ofrece unidades ficticias',async()=>{respond();renderDashboard();await screen.findByText('Expedientes registrados');expect(within(screen.getByLabelText(/Unidad org/)).getAllByRole('option')).toHaveLength(1);});
 it('filtra la tendencia al mes seleccionado',async()=>{respond();const user=userEvent.setup();const {container}=renderDashboard();await screen.findByText('Expedientes registrados');await user.selectOptions(screen.getByLabelText('Periodo'),'month');await user.selectOptions(await screen.findByLabelText('Mes'),'03');await waitFor(()=>expect(container.querySelectorAll('svg[role="img"] circle')).toHaveLength(2));});
 it('anuncia la carga pendiente sin mostrar ceros como datos',()=>{vi.mocked(apiClient.get).mockReturnValue(new Promise(()=>{}) as never);renderDashboard();expect(screen.getByRole('main')).toHaveAttribute('aria-busy','true');expect(screen.getByText('Cargando tablero ejecutivo.')).toBeInTheDocument();});
});
