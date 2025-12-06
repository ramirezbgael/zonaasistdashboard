# Configuración de Supabase para Envío de Emails

Este documento explica cómo configurar Supabase para enviar correos electrónicos automáticamente cuando se registra un nuevo equipo.

## Opción 1: Edge Functions (Recomendado)

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Inicializar el proyecto (si no lo has hecho)

```bash
supabase init
```

### 3. Crear una Edge Function para enviar emails

```bash
supabase functions new send-receipt-email
```

### 4. Instalar dependencias de email

Edita `supabase/functions/send-receipt-email/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const { equipo_id, cliente_email, cliente_nombre, equipo_info } = await req.json()

    if (!cliente_email) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó email del cliente' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Llamar a Resend API para enviar el email
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Zona Asist <noreply@tudominio.com>',
        to: [cliente_email],
        subject: `Recibo de Equipo #${equipo_info.nota}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
                .info-row { margin: 10px 0; }
                .label { font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Zona Asist</h1>
                  <p>Comprobante de Recepción de Equipo</p>
                </div>
                <div class="content">
                  <p>Estimado/a ${cliente_nombre},</p>
                  <p>Le confirmamos la recepción de su equipo con los siguientes datos:</p>
                  
                  <div class="info-row">
                    <span class="label">Número de Equipo:</span> #${equipo_info.nota}
                  </div>
                  <div class="info-row">
                    <span class="label">Marca:</span> ${equipo_info.marca}
                  </div>
                  <div class="info-row">
                    <span class="label">Modelo:</span> ${equipo_info.modelo}
                  </div>
                  <div class="info-row">
                    <span class="label">Color:</span> ${equipo_info.color}
                  </div>
                  ${equipo_info.problema ? `<div class="info-row"><span class="label">Problema reportado:</span> ${equipo_info.problema}</div>` : ''}
                  
                  <p style="margin-top: 20px;">Su equipo ha sido recibido y será procesado según el procedimiento establecido.</p>
                  <p>Le notificaremos cuando su equipo esté listo para recoger.</p>
                  
                  <p style="margin-top: 30px;">Atentamente,<br>El equipo de Zona Asist</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      throw new Error(`Error al enviar email: ${emailData.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### 5. Configurar variables de entorno en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Ve a **Settings** > **Edge Functions**
3. Agrega la variable de entorno:
   - `RESEND_API_KEY`: Tu API key de Resend

### 6. Desplegar la función

```bash
supabase functions deploy send-receipt-email
```

### 7. Configurar Resend (Servicio de Email)

1. Ve a [resend.com](https://resend.com) y crea una cuenta
2. Crea una API key
3. Verifica tu dominio (opcional pero recomendado)
4. Agrega la API key a las variables de entorno de Supabase

---

## Opción 2: Database Trigger + pg_net (Alternativa)

### 1. Instalar extensión pg_net

En el SQL Editor de Supabase, ejecuta:

```sql
-- Habilitar extensión pg_net (si está disponible)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Crear función trigger

```sql
CREATE OR REPLACE FUNCTION enviar_email_recepcion()
RETURNS TRIGGER AS $$
DECLARE
  cliente_record RECORD;
  equipo_record RECORD;
BEGIN
  -- Obtener datos del equipo
  SELECT * INTO equipo_record
  FROM equipos
  WHERE id = NEW.id;

  -- Obtener datos del cliente si existe
  IF NEW.cliente_id IS NOT NULL THEN
    SELECT * INTO cliente_record
    FROM clientes
    WHERE id = NEW.cliente_id;
  END IF;

  -- Solo enviar email si hay cliente y tiene email
  IF cliente_record.id IS NOT NULL AND cliente_record.email IS NOT NULL AND cliente_record.email != '' THEN
    -- Llamar a la Edge Function
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-receipt-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'equipo_id', NEW.id,
          'cliente_email', cliente_record.email,
          'cliente_nombre', cliente_record.nombre,
          'equipo_info', jsonb_build_object(
            'nota', equipo_record.nota,
            'marca', equipo_record.marca,
            'modelo', equipo_record.modelo,
            'color', equipo_record.color,
            'problema', equipo_record.problema
          )
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Crear trigger

```sql
CREATE TRIGGER trigger_enviar_email_recepcion
AFTER INSERT ON equipos
FOR EACH ROW
EXECUTE FUNCTION enviar_email_recepcion();
```

---

## Opción 3: Usar Supabase Auth (Envío desde el frontend)

### Desde el frontend (React)

```javascript
// En AddEquipoModalTypeform.jsx después de crear el equipo
const enviarEmailRecepcion = async (equipo, cliente) => {
  if (!cliente.email) return;

  try {
    const { data, error } = await supabase.functions.invoke('send-receipt-email', {
      body: {
        equipo_id: equipo.id,
        cliente_email: cliente.email,
        cliente_nombre: cliente.nombre,
        equipo_info: {
          nota: equipo.nota,
          marca: equipo.marca,
          modelo: equipo.modelo,
          color: equipo.color,
          problema: equipo.problema
        }
      }
    });

    if (error) {
      console.error('Error al enviar email:', error);
    } else {
      console.log('Email enviado exitosamente:', data);
    }
  } catch (error) {
    console.error('Error al invocar función:', error);
  }
};

// Llamar después de crear el equipo
await enviarEmailRecepcion(nuevoEquipo, cliente);
```

---

## Cambios necesarios en la tabla `clientes`

### Agregar columna `email` si no existe

```sql
-- Agregar columna email si no existe
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Agregar índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);

-- Opcional: Agregar constraint para validar formato de email
ALTER TABLE clientes
ADD CONSTRAINT check_email_format 
CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');
```

### Verificar RLS (Row Level Security)

Asegúrate de que las políticas de RLS permitan INSERT y UPDATE:

```sql
-- Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'clientes';

-- Si necesitas crear/actualizar políticas:
CREATE POLICY "Users can insert their own clients"
ON clientes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update their own clients"
ON clientes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

---

## Servicios de Email Recomendados

1. **Resend** (Recomendado)
   - Generoso plan gratuito
   - API simple
   - Bueno para transaccionales

2. **SendGrid**
   - Plan gratuito disponible
   - Muy confiable

3. **Mailgun**
   - Plan gratuito limitado
   - Bueno para desarrolladores

4. **Amazon SES**
   - Muy económico
   - Más complejo de configurar

---

## Pruebas

Para probar el envío de emails:

1. Crea un equipo con un cliente que tenga email
2. Verifica en los logs de Supabase Edge Functions
3. Revisa la bandeja de entrada del email del cliente (incluyendo spam)

---

## Notas Importantes

1. **Límites de Rate**: Los servicios de email tienen límites de envío. Considera implementar un queue si esperas muchos emails.

2. **Dominio verificado**: Para mejor deliverability, verifica tu dominio en el servicio de email.

3. **Templates**: Considera usar un servicio de templates como SendGrid Dynamic Templates o crear tus propios templates HTML.

4. **Error Handling**: Siempre maneja errores de envío de email sin bloquear la creación del equipo.

