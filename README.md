# Huellas de Vida · Podología Anabel

Aplicación estática HTML, CSS, JavaScript y JSON. Se prueba directamente con la extensión **Live Server / Go Live** de VS Code; no requiere Node.js, npm ni compilación.

## Abrir con Go Live

1. Abre en VS Code la carpeta `Proyecto_Anabel`.
2. En el Explorador, abre `config.json`.
3. En Supabase → **Project Settings → API Keys**, copia la **Publishable key** (o la clave pública `anon`) y reemplaza el texto `PEGA_AQUI_LA_PUBLISHABLE_KEY_DE_SUPABASE` de `supabaseAnonKey`.
4. Guarda `config.json`. Ese archivo está excluido de Git.
5. Abre `index.html` y pulsa **Go Live** en la barra inferior de VS Code.
6. Inicia sesión con el usuario creado en Supabase Auth.

Si no aparece Go Live, instala la extensión **Live Server** (Ritwick Dey), vuelve a abrir `index.html` y elige **Open with Live Server**. Mantén VS Code y el navegador con conexión a Internet para Supabase y la fuente tipográfica.

La clave debe ser la Publishable/anon, nunca `service_role`. Aunque la clave pública se usa en el navegador, RLS en Supabase es lo que protege los datos. No publiques `config.json` ni datos clínicos.

## Datos y seguridad

- `config.example.json`: plantilla de configuración sin credenciales.
- `config.json`: configuración local ignorada por Git.
- `supabase/schema.sql`: tablas, RLS y bucket privado ya ejecutados en el proyecto.
- `supabase/quick-patient-migration.sql`: permitir pacientes nuevos sin fecha de nacimiento.
- `src/app.js`: interacción, autenticación y operaciones de datos.
- `src/styles.css`: estilos responsive.

Para permitir agendar antes de conocer la fecha de nacimiento, ejecuta una vez el SQL de `supabase/quick-patient-migration.sql` desde **Supabase → SQL Editor**. Las fichas, citas, sesiones, fotos y gastos se guardan en Supabase. Prueba primero los flujos y los permisos con registros ficticios. El recordatorio web de las 20:00 requiere que la aplicación permanezca abierta.

## Publicar con GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` publica el sitio estático al hacer push a `main`. Configura el secreto `SUPABASE_PUBLISHABLE_KEY` en los ajustes del repositorio antes del primer despliegue. El workflow genera `config.json` solo dentro del artefacto publicado; no lo agrega al repositorio.
