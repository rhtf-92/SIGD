# -*- coding: utf-8 -*-
with open(r'src\routes\AppRouter.tsx', encoding='utf-8') as f:
    content = f.read()

old = '''      <Route path=\"/\" element={<HomePage />} />
      <Route path=\"/login\" element={<LoginPage />} />
      <Route path=\"/acceso-denegado\" element={<AccesoDenegadoPage />} />'''

new = '''      <Route path=\"/\" element={<HomePage />} />
      <Route path=\"/login\" element={<LoginPage />} />
      <Route path=\"/recuperar-password\" element={<RecuperarPasswordPage />} />
      <Route path=\"/acceso-denegado\" element={<AccesoDenegadoPage />} />'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\routes\AppRouter.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
