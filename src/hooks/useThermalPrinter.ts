import { useCallback, useRef } from 'react';

export const useThermalPrinter = () => {
  const isPrintingRef = useRef(false);

  const printTicket = useCallback((ticketElementId: string) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    const element = document.getElementById(ticketElementId);
    if (!element) {
      console.error(`No se encontró el elemento con id: ${ticketElementId}`);
      isPrintingRef.current = false;
      return;
    }

    // Crear un iframe invisible para evitar congelar la pantalla de Ventanilla
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impresión de Ticket</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; font-family: monospace; }
            </style>
          </head>
          <body>
            ${element.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
        isPrintingRef.current = false;
      }, 250);
    } else {
      isPrintingRef.current = false;
    }
  }, []);

  return { printTicket };
};