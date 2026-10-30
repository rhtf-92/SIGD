# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''          <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="rol"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
              >
                Rol institucional
              </label>
              <select
                id="rol"
                value={rol}
                onChange={(event) => {
                  setRol(event.target.value);
                  setError("");
                  setPassword("");
                }}
                className="input-sigd"
              >
                {ROLES_CANONICOS.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.label}
                  </option>
                ))}
              </select>
            </div>'''

new = '''          <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="identificador"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
              >
                Usuario / DNI / Correo
              </label>
              <input
                id="identificador"
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ingrese su usuario, DNI o correo"
                autoComplete="username"
                className="input-sigd"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={mostrar ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  className="input-sigd pr-24"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-bold text-tinta-500 transition hover:text-vault-azul-tinta"
                >
                  {mostrar ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="rol"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
              >
                Rol Institucional
              </label>
              <select
                id="rol"
                value={rol}
                onChange={(event) => {
                  setRol(event.target.value);
                  setError("");
                  setPassword("");
                }}
                className="input-sigd"
              >
                <option value="ESTUDIANTE">Estudiante</option>
                <option value="DOCENTE">Docente</option>
                <option value="MESA_PARTES">Mesa de Partes</option>
                <option value="DIRECTOR">Director General</option>
                <option value="SUPER_ADMIN">Super Administrador</option>
              </select>
            </div>'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
