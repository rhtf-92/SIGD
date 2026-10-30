# -*- coding: utf-8 -*-
with open(r'src\pages\LoginPage.tsx', encoding='utf-8') as f:
    content = f.read()

# Look for the exact lines
old = '''        await loginStore({ identificador, password: clave });
        const destino = rolActual.destino;
        navigate(destino, { replace: true });
        return;'''

if old in content:
    print('found')
else:
    print('no')
