import { useEffect, type RefObject } from "react";

// Efectos visuales: chispas del mouse, explosión al hacer clic, onda en botones
// y porcentaje de avance. No usa estado de React, así que no vuelve a dibujar
// la página ni interfiere con los formularios.
export function useRegistroEffects(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // ---- Avance del formulario (se escribe directo en el DOM) ----
    let last = -1;
    const calc = () => {
      const form = root.querySelector("form");
      let p = 0;
      if (form) {
        const els = Array.from(
          form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")
        ).filter((e) => e.type !== "hidden" && !e.disabled && !(e as HTMLInputElement).readOnly);
        if (els.length) {
          const done = els.filter((e) =>
            e.type === "checkbox" || e.type === "radio"
              ? (e as HTMLInputElement).checked
              : e.value.trim() !== ""
          ).length;
          p = Math.round((done / els.length) * 100);
        }
      }
      if (p === last) return;
      last = p;
      const bar = root.querySelector<HTMLElement>(".reg-prog i");
      const pct = root.querySelector<HTMLElement>(".reg-pct");
      if (bar) bar.style.width = `${p}%`;
      if (pct) pct.textContent = `${p}% completo`;
    };
    root.addEventListener("input", calc);
    root.addEventListener("change", calc);
    const mo = new MutationObserver(calc);
    mo.observe(root, { childList: true, subtree: true });
    calc();

    // ---- Chispas y ondas ----
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let layer: HTMLDivElement | null = null;
    let onMove: ((e: PointerEvent) => void) | null = null;
    let onDown: ((e: PointerEvent) => void) | null = null;

    if (!reduce) {
      const L = document.createElement("div");
      L.className = "reg-fx";
      document.body.appendChild(L);
      layer = L;
      const COLORS = ["#0A7CFF", "#0A7CFF", "#F5047D", "#F5047D", "#38C6FF"];
      const spark = (x: number, y: number, r: number, size?: number) => {
        if (L.childElementCount > 70) return;
        const s = document.createElement("i");
        const a = Math.random() * 6.283;
        const d = r * (0.4 + Math.random());
        const n = size ?? 6 + Math.random() * 7;
        s.style.cssText =
          `left:${x}px;top:${y}px;width:${n}px;height:${n}px;` +
          `color:${COLORS[Math.floor(Math.random() * COLORS.length)]};` +
          `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 18}px`;
        L.appendChild(s);
        s.addEventListener("animationend", () => s.remove());
      };
      let lx = 0;
      let ly = 0;
      onMove = (e) => {
        if (e.pointerType !== "mouse") return;
        const dx = e.clientX - lx;
        const dy = e.clientY - ly;
        if (dx * dx + dy * dy < 400) return;
        lx = e.clientX;
        ly = e.clientY;
        spark(lx, ly, 22);
        if (Math.random() < 0.5) spark(lx, ly, 34, 5);
      };
      onDown = (e) => {
        for (let i = 0; i < 9; i++) spark(e.clientX, e.clientY, 46 + Math.random() * 20, 7 + Math.random() * 6);
        const t = (e.target as HTMLElement).closest<HTMLElement>("button,.reg-back");
        if (t && !(t as HTMLButtonElement).disabled && root.contains(t)) {
          const r = t.getBoundingClientRect();
          const m = Math.max(r.width, r.height) * 2;
          const k = document.createElement("span");
          k.className = "reg-rip";
          k.style.cssText = `width:${m}px;height:${m}px;left:${e.clientX - r.left - m / 2}px;top:${e.clientY - r.top - m / 2}px`;
          t.appendChild(k);
          k.addEventListener("animationend", () => k.remove());
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerdown", onDown);
    }

    return () => {
      root.removeEventListener("input", calc);
      root.removeEventListener("change", calc);
      mo.disconnect();
      if (onMove) window.removeEventListener("pointermove", onMove);
      if (onDown) window.removeEventListener("pointerdown", onDown);
      layer?.remove();
    };
  }, [rootRef]);
}