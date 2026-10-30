# -*- coding: utf-8 -*-
with open(r'src\routes\AppRouter.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";'''

new = '''import ValidadorPublicoCvdPage from "../pages/validador/ValidadorPublicoCvdPage";
import LoginPage from "../pages/LoginPage";
import RecuperarPasswordPage from "../pages/recuperar/RecuperarPasswordPage";
import CasillaElectronicaPage from "../pages/casilla/CasillaElectronicaPage";'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\routes\AppRouter.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
