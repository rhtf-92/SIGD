# -*- coding: utf-8 -*-
with open(r'src\components\landing\HeroInstitucional.tsx', encoding='utf-8') as f:
    content = f.read()

# Remove the carousel images if user wants - but requirement says hide images for internal/admin roles
# For now, let's add logic to hide images for non-student/external roles? Or just hide
# But better to add conditional - check useSesion
old = '''              <img
                key={ondo-}
                src={diapositiva.src}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              />

              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#04213f]/95 via-[#04213f]/35 to-[#04213f]/20"
              />

              <img
                key={diapositiva.id}
                src={diapositiva.src}
                alt={diapositiva.titulo}
                className="relative z-10 h-full w-full animate-[portada-fade_500ms_ease-out] object-contain object-center p-0 sm:p-1 lg:max-h-[640px] lg:object-cover"
                loading={indice === 0 ? "eager" : "lazy"}
              />'''

new = '''              {(!autenticado || rol === "ESTUDIANTE") && (
                <>
                  <img
                    key={ondo-}
                    src={diapositiva.src}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                  />

                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#04213f]/95 via-[#04213f]/35 to-[#04213f]/20"
                  />

                  <img
                    key={diapositiva.id}
                    src={diapositiva.src}
                    alt={diapositiva.titulo}
                    className="relative z-10 h-full w-full animate-[portada-fade_500ms_ease-out] object-contain object-center p-0 sm:p-1 lg:max-h-[640px] lg:object-cover"
                    loading={indice === 0 ? "eager" : "lazy"}
                  />
                </>
              )}
              {(autenticado && rol && rol !== "ESTUDIANTE") && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f] to-[#000814]" />
              )}'''

if old not in content:
    print('NOT FOUND')
else:
    content = content.replace(old, new)
    with open(r'src\components\landing\HeroInstitucional.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('done')
