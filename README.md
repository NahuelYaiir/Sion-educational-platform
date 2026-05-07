# Sion Recibos Web

App web privada para gestionar recibos y operación docente de Sion desde una sola plataforma.

## Incluye

- login con Supabase Auth
- guardado de recibos en Supabase
- vista previa premium del recibo
- descarga en PDF desde el navegador
- historial reciente reutilizable
- pestaña docente con materias, alumnos, inscripciones, asistencia y calificaciones reales

## Estructura

- app: [`public/index.html`](/Users/nahuel/Documents/Playground/sion_recibos_web/public/index.html)
- estilos: [`public/styles.css`](/Users/nahuel/Documents/Playground/sion_recibos_web/public/styles.css)
- lógica: [`public/app.js`](/Users/nahuel/Documents/Playground/sion_recibos_web/public/app.js)
- variables de entorno cliente: [`public/env.js`](/Users/nahuel/Documents/Playground/sion_recibos_web/public/env.js)
- SQL base: [`supabase/schema.sql`](/Users/nahuel/Documents/Playground/sion_recibos_web/supabase/schema.sql)

## Configuración de Supabase

1. Crear un proyecto en Supabase.
2. En SQL Editor ejecutar [`supabase/schema.sql`](/Users/nahuel/Documents/Playground/sion_recibos_web/supabase/schema.sql).
3. En Auth crear tu usuario con email y contraseña.
4. Completar [`public/env.js`](/Users/nahuel/Documents/Playground/sion_recibos_web/public/env.js) con:

```js
window.SION_SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
window.SION_SUPABASE_ANON_KEY = "TU_PUBLISHABLE_KEY";
```

Usar:

- `Project URL`
- `Publishable key`

No usar:

- `secret key`
- `service_role`

### Checklist mínimo para dejarlo funcionando

1. En Supabase abrí `SQL Editor` y ejecutá [schema.sql](/Users/nahuel/Documents/Playground/sion_recibos_web/supabase/schema.sql)
2. En `Authentication`:
   creá tu usuario con email y contraseña
3. En `Project Settings`:
   copiá `Project URL` y `Publishable key`
4. Pegalos en [public/env.js](/Users/nahuel/Documents/Playground/sion_recibos_web/public/env.js)
5. Volvé a publicar:

```bash
cd /Users/nahuel/Documents/Playground/sion_recibos_web
firebase deploy --only hosting:sionrecibos
```

### Qué hace la app con Supabase

- inicia sesión con `Supabase Auth`
- guarda cada recibo en `public.recibos`
- si repetís el mismo `punto_venta + numero_recibo` para el mismo usuario, actualiza el registro en vez de duplicarlo
- carga historial solo de tu usuario autenticado
- deja que cada profesor cree sus propias `materias`
- permite cargar `alumnos` reales y reutilizarlos entre materias
- guarda `inscripciones`, `asistencias`, `evaluaciones` y `calificaciones`

### Importante para la nueva pestaña docente

Si ya habías ejecutado el SQL viejo, volvé a correr [schema.sql](/Users/nahuel/Documents/Playground/sion_recibos_web/supabase/schema.sql) en Supabase para crear las tablas nuevas del módulo docente:

- `materias`
- `alumnos`
- `materia_alumnos`
- `evaluaciones`
- `calificaciones`
- `asistencias`

Además, si querés dejar listo el botón de Drive:

```js
window.SION_DRIVE_UPLOAD_URL = "https://script.google.com/macros/s/TU_WEB_APP_ID/exec"
```

Ese endpoint puede ser un Google Apps Script Web App que reciba el PDF y lo guarde en tu carpeta.

Para la pestaña docente, también podés usar un Apps Script para exportar a Google Sheets:

```js
window.SION_ACADEMIC_SYNC_URL = "https://script.google.com/macros/s/TU_WEB_APP_ID/exec";
window.SION_ACADEMIC_SPREADSHEET_ID = "TU_SPREADSHEET_ID";
```

Con eso vas a poder exportar:

- presentismo a la hoja `presentismo`
- notas a la hoja `notas`

Ya te dejé un script base en [google_apps_script/Code.gs](/Users/nahuel/Documents/Playground/sion_recibos_web/google_apps_script/Code.gs) apuntando a esta carpeta:

[`https://drive.google.com/drive/folders/1hhbvZdn1KP26lvpLEe4e6O6O3DXP2kwz`](https://drive.google.com/drive/folders/1hhbvZdn1KP26lvpLEe4e6O6O3DXP2kwz)

### Cómo activarlo

1. Abrí [script.new](https://script.new)
2. Pegá el contenido de [google_apps_script/Code.gs](/Users/nahuel/Documents/Playground/sion_recibos_web/google_apps_script/Code.gs)
3. En `Deploy` → `New deployment`
4. Elegí `Web app`
5. Ejecutar como: `Me`
6. Acceso: `Anyone with the link`
7. Copiá la URL terminada en `/exec`
8. Pegala en [public/env.js](/Users/nahuel/Documents/Playground/sion_recibos_web/public/env.js) como `window.SION_DRIVE_UPLOAD_URL`

Con eso el botón `Guardar PDF en Drive` ya debería empezar a funcionar y guardar el archivo con formato `Apellido-numeroRecibo.pdf`.

## Cómo abrirla localmente

Podés servir `public/` con cualquier hosting estático. Por ejemplo:

```bash
cd /Users/nahuel/Documents/Playground/sion_recibos_web/public
python3 -m http.server 8787
```

Luego abrir:

[`http://127.0.0.1:8787`](http://127.0.0.1:8787)

## Publicar en Firebase Hosting

1. La carpeta ya quedó enlazada al proyecto `spotto-app-83049`
2. El sitio separado de Hosting quedó configurado como `sion-recibos-web`
3. Desde [`/Users/nahuel/Documents/Playground/sion_recibos_web`](</Users/nahuel/Documents/Playground/sion_recibos_web>) correr:

```bash
firebase deploy --only hosting:sionrecibos
```

La configuración ya quedó lista en [firebase.json](/Users/nahuel/Documents/Playground/sion_recibos_web/firebase.json).

## Nota sobre acceso privado

La tabla `recibos` acepta operaciones de usuarios autenticados. Como el acceso es personal, la práctica recomendada es crear solo tu usuario en Supabase Auth para que nadie más pueda entrar a la aplicación.
