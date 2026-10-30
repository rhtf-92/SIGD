# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    s = f.read()

# Also fix the fallback navigation
old = '        navigate(rolActual.destino, { replace: true });'
new = '        const destinoFallback = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || \"/casilla\";\n        navigate(destinoFallback, { replace: true });'

s2 = s.replace(old, new)
with open(r'src\pages\LoginPage.tsx', 'w', encoding='utf-8') as f:
    f.write(s2)
print('done')
