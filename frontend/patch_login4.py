# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? "Verificando en BD SIGD…" : "Ingresar al sistema"}
            </button>
          </form>'''

new = '''            <div className="flex items-center justify-between text-xs">
              <Link
                to="/recuperar-password"
                className="font-semibold text-vault-azul-tinta hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
              <Link
                to="/registro"
                className="font-semibold text-vault-azul-tinta hover:underline"
              >
                Crear cuenta
              </Link>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? "Verificando en BD SIGD…" : "Ingresar al sistema"}
            </button>
          </form>'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
