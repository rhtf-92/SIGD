import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { usuario, accessToken } = useAuthStore();
  const [correos, setCorreos] = useState<any[]>([]);
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [tokenVerificacion, setTokenVerificacion] = useState("");
  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!usuario) { navigate("/login"); return; }
    fetchCorreos();
  }, [usuario, navigate]);

  const fetchCorreos = () => {
    fetch("/api/v1/correos", { headers: { "Authorization": `Bearer ${accessToken}` } })
        .then(res => res.json()).then(setCorreos);
  };

  const agregarCorreo = async () => {
    await fetch("/api/v1/correos", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ correo: nuevoCorreo })
    });
    setNuevoCorreo("");
    fetchCorreos();
  };

  const establecerPreferido = async (id: string) => {
    await fetch(`/api/v1/correos/${id}/preferido`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` }
    });
    fetchCorreos();
  };

  const iniciarVerificacion = async (id: string) => {
    await fetch(`/api/v1/correos/${id}/iniciar-verificacion`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` }
    });
    setVerificandoId(id);
  };

  const confirmarVerificacion = async (id: string) => {
    await fetch(`/api/v1/correos/${id}/confirmar`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenVerificacion })
    });
    setVerificandoId(null);
    setTokenVerificacion("");
    fetchCorreos();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Perfil de Usuario</h1>
      <div className="bg-white p-4 rounded shadow mb-6">
        <p><strong>Usuario:</strong> {usuario?.nombreCompleto}</p>
        <p><strong>Correo principal:</strong> {usuario?.correo}</p>
      </div>

      <h2 className="text-xl font-bold mb-3">Correos electrónicos vinculados</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        {correos.map((c) => (
            <div key={c.id_correo_adicional} className="flex justify-between items-center p-2 border-b">
                <span>{c.correo} {c.verificado ? <span className="text-green-600">(Verificado)</span> : <span className="text-yellow-600">(Pendiente)</span>} 
                {c.preferido && <span className="text-blue-600 font-bold ml-2">(Preferido)</span>}</span>
                <div className="flex gap-2">
                    {c.verificado && !c.preferido && <button onClick={() => establecerPreferido(c.id_correo_adicional)} className="text-blue-500">Marcar preferido</button>}
                    {!c.verificado && verificandoId !== c.id_correo_adicional && <button onClick={() => iniciarVerificacion(c.id_correo_adicional)} className="text-blue-500">Enviar código</button>}
                    {!c.verificado && verificandoId === c.id_correo_adicional && (
                        <>
                            <input value={tokenVerificacion} onChange={e => setTokenVerificacion(e.target.value)} placeholder="Código" className="border p-1" />
                            <button onClick={() => confirmarVerificacion(c.id_correo_adicional)} className="text-green-500">Confirmar</button>
                        </>
                    )}
                    <button onClick={() => fetch(`/api/v1/correos/${c.id_correo_adicional}`, { method: 'DELETE', headers: { "Authorization": `Bearer ${accessToken}` } }).then(fetchCorreos)} className="text-red-500">Eliminar</button>
                </div>
            </div>
        ))}
      </div>
      
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-bold">Agregar correo</h3>
        <input value={nuevoCorreo} onChange={e => setNuevoCorreo(e.target.value)} placeholder="correo@ejemplo.com" className="border p-1 mr-2" />
        <button onClick={agregarCorreo} className="bg-blue-500 text-white p-1 rounded">Agregar</button>
      </div>
    </div>
  );
}
