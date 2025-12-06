# 🚀 Despliegue en Netlify - Arquitectura Completa

Esta guía explica cómo desplegar todo el proyecto en Netlify. Las notificaciones se crean en Supabase y se consumen desde tu proyecto local para enviar WhatsApp.

## 🏗️ Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────────┐
│                    NETLIFY                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Frontend (React/Vite)                           │  │
│  │  - Dashboard, Equipos, Documentos, etc.          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Edge Functions                                   │  │
│  │  - send-pending-reminders (crea notificaciones)   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Database                                         │  │
│  │  - equipos, documentos, pedidos, notificaciones  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         TU PROYECTO LOCAL                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Consume notificaciones de Supabase              │  │
│  │  - Lee tabla notificaciones                      │  │
│  │  - Envía mensajes por WhatsApp                   │  │
│  │  - Marca notificaciones como leídas               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 📦 Estructura del Proyecto

```
zonaasistdashboard/
├── src/                          # Frontend (va a Netlify)
│   ├── components/
│   ├── App.jsx
│   └── ...
├── supabase/
│   └── functions/                # Edge Functions (se despliegan a Supabase)
│       └── send-pending-reminders/  # Crea notificaciones en BD
├── netlify.toml                  # Configuración de Netlify
└── package.json
```

## 🚀 Pasos de Despliegue

### 1. Preparar el Proyecto para Netlify

1. **El archivo `netlify.toml` ya está creado** en la raíz del proyecto ✅

2. **Verificar que `package.json` tenga el script de build:**
   - Ya está configurado: `"build": "vite build"` ✅

3. **Variables de entorno en Vite (opcional):**
   Si usas variables de entorno, crea `.env`:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```
   Y agrégalas también en Netlify (Settings → Environment variables)

### 2. Desplegar Frontend en Netlify

1. **Conectar repo a Netlify:**
   - Ve a https://app.netlify.com
   - "Add new site" → "Import an existing project"
   - Conecta tu repo de GitHub

2. **Configurar build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `18` (en variables de entorno)

3. **Variables de entorno en Netlify:**
   - `VITE_SUPABASE_URL=tu_supabase_url`
   - `VITE_SUPABASE_ANON_KEY=tu_anon_key`
   - (Si usas variables de entorno en Vite)

4. **Deploy:**
   - Netlify detectará automáticamente el `netlify.toml`
   - El deploy se hará automáticamente en cada push

### 3. Desplegar Edge Functions en Supabase

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Linkear proyecto
supabase link --project-ref tu-project-ref

# Desplegar función de recordatorios
supabase functions deploy send-pending-reminders
```

**Nota:** Ya no necesitas desplegar `send-whatsapp` ni configurar servicios externos. Las notificaciones se crean en Supabase y tu proyecto local las consume.

### 4. Configurar tu Proyecto Local para Consumir Notificaciones

Revisa `NOTIFICACIONES_API.md` para ver cómo consumir las notificaciones desde tu proyecto local.

**Resumen:**
1. Conecta tu proyecto local a Supabase usando el `service_role_key`
2. Consulta la tabla `notificaciones` donde `leida = false`
3. Envía WhatsApp usando tu servicio
4. Marca las notificaciones como leídas después de enviar

### 5. Configurar Base de Datos

Ejecuta en Supabase SQL Editor:
- `SUPABASE_NOTIFICACIONES_SETUP.sql`
- `SUPABASE_WHATSAPP_SETUP.sql`

### 6. Configurar Cron Job para Recordatorios

Usa una de estas opciones:

#### Opción A: GitHub Actions (Gratis)

Crea `.github/workflows/daily-reminders.yml`:

```yaml
name: Daily WhatsApp Reminders

on:
  schedule:
    - cron: '0 9,14,18 * * *'  # 9am, 2pm, 6pm UTC
  workflow_dispatch:  # Permite ejecución manual

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Send Reminders
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://TU_PROJECT_REF.supabase.co/functions/v1/send-pending-reminders
```

Agrega `SUPABASE_SERVICE_ROLE_KEY` a GitHub Secrets.

#### Opción B: EasyCron / cron-job.org

1. Crea cuenta en https://cron-job.org (gratis)
2. Nueva tarea:
   - URL: `https://TU_PROJECT_REF.supabase.co/functions/v1/send-pending-reminders`
   - Método: POST
   - Headers:
     - `Authorization: Bearer TU_SERVICE_ROLE_KEY`
     - `Content-Type: application/json`
   - Horarios: 9:00, 14:00, 18:00 (3 veces al día)

## 🔐 Variables de Entorno Necesarias

### Netlify
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Tu Proyecto Local
- `SUPABASE_URL` (URL de tu proyecto Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (para acceso completo a notificaciones)

## 📝 Checklist de Despliegue

- [ ] Frontend desplegado en Netlify
- [ ] Edge Function `send-pending-reminders` desplegada en Supabase
- [ ] Base de datos configurada (scripts SQL ejecutados)
- [ ] Cron job configurado para recordatorios (3 veces al día)
- [ ] Proyecto local configurado para consumir notificaciones
- [ ] Prueba de creación de notificación exitosa
- [ ] Prueba de consumo desde proyecto local exitosa

## 🧪 Probar el Sistema Completo

1. **Probar frontend:**
   - Visita tu URL de Netlify
   - Verifica que todo carga correctamente

2. **Probar creación de notificaciones:**
```bash
curl -X POST \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://TU_PROJECT_REF.supabase.co/functions/v1/send-pending-reminders
```

3. **Verificar notificaciones creadas:**
```sql
SELECT * FROM notificaciones 
WHERE tipo = 'recordatorio_diario' 
ORDER BY created_at DESC 
LIMIT 10;
```

4. **Probar consumo desde tu proyecto local:**
   - Ejecuta manualmente el cron job
   - O espera al horario programado

## 🆘 Solución de Problemas

### Frontend no carga en Netlify
- Verifica que `dist/` se genera correctamente
- Revisa los logs de build en Netlify
- Verifica variables de entorno

### Edge Functions no funcionan
- Verifica que estén desplegadas: `supabase functions list`
- Revisa logs: `supabase functions logs send-whatsapp`
- Verifica secrets: `supabase secrets list`

### No aparecen notificaciones en la BD
- Verifica que la Edge Function se ejecute correctamente
- Revisa logs: `supabase functions logs send-pending-reminders`
- Verifica que haya items pendientes asignados a usuarios

### Tu proyecto local no consume notificaciones
- Verifica conexión a Supabase (URL y service_role_key)
- Revisa permisos RLS en tabla `notificaciones`
- Verifica que estés filtrando correctamente (`leida = false`)

## 💰 Costos Estimados

- **Netlify:** Gratis (hasta 100GB bandwidth/mes)
- **Supabase:** Gratis (hasta 500MB database, 2GB bandwidth)
- **Railway:** Gratis ($5 crédito/mes, suficiente para empezar)
- **Render:** Gratis (pero se duerme después de 15 min de inactividad)

**Total: $0/mes para empezar** (con límites)

## 📚 Recursos

- [Netlify Documentation](https://docs.netlify.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Railway Documentation](https://docs.railway.app/)
- [Render Documentation](https://render.com/docs)

