# Repositorio CASA — reglas para Claude

Este repositorio contiene la app privada «Casa» de Mari y Juanma, publicada en
https://s9nzw2sjc5-code.github.io/CASA/ y en uso a diario.

## No modificar nada sin una petición expresa

- **No cambies ningún archivo** (`casa/`, `index.html`, `.nojekyll`, `.github/`, `README.md`,
  este `CLAUDE.md`) salvo que la usuaria pida **expresamente un cambio en la app Casa**
  en ese mismo chat. Si una tarea de otro tema (vídeos, bingo, redes, etc.) parece
  necesitar tocar este repositorio, **no lo hagas**: pregunta antes y espera un «sí» claro.
- **No añadas otros proyectos** a este repositorio. Van en su propio repositorio.
- **No renombres el repositorio, no cambies la rama por defecto ni los ajustes de
  GitHub Pages.** Cambiar el nombre cambia la dirección de la app y la deja sin servicio.
- **No toques la configuración de Firebase** (`casa/config.js`, reglas, usuarios).
- Nunca subas datos personales (tareas, notas, emails) al repositorio: es público.

## Si te piden un cambio en la app

- Trabaja en la rama `claude/deploy-app-outside-claude-ccdb78` (la que se publica).
- Prueba el cambio en local antes de subirlo (Playwright con Chromium en
  `/opt/pw-browsers/chromium`; para probar sin Firebase, sustituye `config.js` por
  `window.claude={use:async()=>null}`).
- Sube la versión de `CACHE` en `casa/sw.js` para que los móviles se actualicen.
