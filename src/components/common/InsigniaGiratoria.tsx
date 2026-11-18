// Insignia con grosor (moneda delgada). Solo diseño.
// Requiere /logo-suiza.png en frontend/public/ y el CSS de styles/registro.css
interface Props {
  size?: number;
}

const GROSOR = 3; // px de grosor de la moneda
const CAPAS = Array.from({ length: GROSOR * 2 * 2 - 1 }, (_, i) => -GROSOR + 0.5 + i * 0.5);

export default function InsigniaGiratoria({ size = 68 }: Props) {
  return (
    <div className="reg-coin" style={{ width: size, height: size }} aria-hidden="true">
      <div className="reg-coin__spin">
        {CAPAS.map((z) => (
          <img key={z} src="/logo-suiza.png" alt="" className="edge" style={{ transform: `translateZ(${z}px)` }} />
        ))}
        <img src="/logo-suiza.png" alt="" style={{ transform: `translateZ(${GROSOR}px)` }} />
        <img src="/logo-suiza.png" alt="" style={{ transform: `rotateY(180deg) translateZ(${GROSOR}px)` }} />
      </div>
    </div>
  );
}