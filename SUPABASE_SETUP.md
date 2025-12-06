# Configuración de Supabase para Perfil de Usuario

Este documento explica cómo configurar Supabase para que funcione la funcionalidad de perfil de usuario.

## 1. Crear la tabla `profiles`

Ve a **SQL Editor** en tu dashboard de Supabase y ejecuta el siguiente SQL:

```sql
-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nombre TEXT NOT NULL,
    apodo TEXT,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Política: Los usuarios solo pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Política: Los usuarios solo pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
```

## 2. Crear el bucket de Storage para avatares

1. Ve a **Storage** en tu dashboard de Supabase
2. Haz clic en **New bucket**
3. Configura:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **SÍ** (marcado)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/*`

## 3. Configurar políticas de Storage

Ve a **Storage** > **Policies** y crea las siguientes políticas para el bucket `avatars`:

**IMPORTANTE:** 
- Asegúrate de que el bucket `avatars` tenga RLS habilitado. Si no, ve a **Storage** > **Policies** y activa "Enable RLS" para el bucket.
- Si las políticas ya existen, primero elimínalas con `DROP POLICY` o ejecuta el script completo que las elimina y recrea.

### Script completo para eliminar y recrear políticas (recomendado)

Ejecuta este script completo en el **SQL Editor** para eliminar políticas existentes y crear las nuevas:

```sql
-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

-- Política 1: Permitir subir archivos (solo el propio usuario)
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Política 2: Permitir leer archivos públicos
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- Política 3: Permitir actualizar archivos propios
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Política 4: Permitir eliminar archivos propios
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

### Política 1: Permitir subir archivos (solo el propio usuario)

**Si la política NO existe**, usa este comando:

```sql
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

**Si la política YA existe**, primero elimínala:

```sql
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;

-- Luego créala de nuevo con el comando CREATE POLICY de arriba
```

**Nota sobre el path:** 
- Los archivos se suben a `{user_id}/{filename}` (ejemplo: `abc123-def456/1234567890.jpg`)
- `storage.foldername(name)` devuelve un array de folders en el path
- En PostgreSQL, los arrays empiezan en índice 1, por lo que `[1]` es el primer folder (el user_id)
- Si el path es `abc123/photo.jpg`, entonces `(storage.foldername(name))[1]` = `'abc123'`

### Política 2: Permitir leer archivos públicos

**Si la política NO existe:**
```sql
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');
```

**Si la política YA existe:**
```sql
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
-- Luego créala de nuevo con el comando CREATE POLICY de arriba
```

### Política 3: Permitir actualizar archivos propios

**Si la política NO existe:**
```sql
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

**Si la política YA existe:**
```sql
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
-- Luego créala de nuevo con el comando CREATE POLICY de arriba
```

### Política 4: Permitir eliminar archivos propios

**Si la política NO existe:**
```sql
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

**Si la política YA existe:**
```sql
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
-- Luego créala de nuevo con el comando CREATE POLICY de arriba
```

## 4. Verificar la configuración

Después de ejecutar todo lo anterior:

1. ✅ La tabla `profiles` debe existir con las columnas: `id`, `nombre`, `apodo`, `foto_url`, `created_at`, `updated_at`
2. ✅ El bucket `avatars` debe existir y ser público
3. ✅ Las políticas RLS deben estar activas en la tabla `profiles`
4. ✅ Las políticas de Storage deben estar configuradas para el bucket `avatars`

## Notas importantes

- El campo `nombre` es **obligatorio** la primera vez que se crea el perfil
- El campo `apodo` es **opcional** y se puede cambiar en cualquier momento
- El campo `foto_url` almacena la URL pública de la imagen subida a Storage
- Los usuarios solo pueden ver y modificar su propio perfil gracias a las políticas RLS
- Las imágenes se almacenan en `avatars/{user_id}/{timestamp}.{ext}`

## Solución de problemas

### Error: "relation 'profiles' does not exist"
- Verifica que ejecutaste el SQL para crear la tabla

### Error: "new row violates row-level security policy"
Este error puede ocurrir por varias razones:

1. **El path del archivo no coincide con la política:**
   - Verifica que los archivos se suban a `{user_id}/{filename}` (ejemplo: `abc123-def456/1234567890.jpg`)
   - NO debe ser `profiles/{user_id}-{timestamp}` ni otro formato

2. **RLS no está habilitado en el bucket:**
   - Ve a **Storage** > **Policies** y asegúrate de que "Enable RLS" esté activado para el bucket `avatars`

3. **El usuario no está autenticado:**
   - Verifica que el usuario haya iniciado sesión correctamente
   - Revisa la consola del navegador para ver si hay errores de autenticación

4. **La política no se aplicó correctamente:**
   - Elimina la política existente y créala de nuevo
   - Verifica que la política use `(storage.foldername(name))[1]` (índice 1, no 0)

5. **Solución rápida (solo para desarrollo):**
   Si necesitas probar rápidamente, puedes crear una política más permisiva temporalmente:
   ```sql
   CREATE POLICY "Allow authenticated uploads"
   ON storage.objects
   FOR INSERT
   WITH CHECK (
       bucket_id = 'avatars' AND
       auth.role() = 'authenticated'
   );
   ```
   **⚠️ ADVERTENCIA:** Esta política permite que cualquier usuario autenticado suba archivos. Úsala solo para desarrollo y elimínala en producción.

### Error: "The resource already exists" al crear el bucket
- El bucket ya existe, puedes continuar con las políticas

### Las imágenes no se muestran
- Verifica que el bucket `avatars` es público
- Verifica que la política de SELECT está configurada correctamente
- Revisa la consola del navegador para ver errores de CORS

