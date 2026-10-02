import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import DashboardEjecutivoPage from "@/pages/reportes/DashboardEjecutivoPage";

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardEjecutivoPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// This test validates the runtime accessibility contract of the executive dashboard.
describe("DashboardEjecutivoPage accessibility", () => {
  it("renders the primary dashboard heading and accessible KPI region", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: /tablero directivo ejecutivo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/métricas ejecutivas principales/i)).toBeInTheDocument();
  });

  it("announces the dashboard status message when content is unavailable", () => {
    renderDashboard();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
