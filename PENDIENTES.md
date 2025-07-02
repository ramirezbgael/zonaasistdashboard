# 📋 PENDIENTES DEL PROYECTO

## 🎯 Tareas Principales

### 1. **Anotar los Pendientes** ✅
- [x] Crear lista de pendientes
- [x] Organizar por prioridad

### 2. **Equipos Pendientes más Chiquitos**
- [ ] Reducir tamaño de las tarjetas de equipos pendientes
- [ ] Ajustar CSS para cards más compactas
- [ ] Optimizar layout para mejor visualización
- [ ] Revisar responsive design

### 3. **Ruteo de React**
- [ ] Implementar React Router
- [ ] Configurar rutas principales:
  - [ ] `/` - Dashboard principal
  - [ ] `/login` - Página de login
  - [ ] `/equipos` - Lista de equipos
  - [ ] `/pendientes` - Equipos pendientes
- [ ] Configurar navegación entre páginas
- [ ] Implementar rutas protegidas (auth)

### 4. **Variables de Entorno (.env)**
- [ ] Crear archivo `.env`
- [ ] Configurar variables de Supabase:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Configurar variables de desarrollo/producción
- [ ] Actualizar `supabase.js` para usar variables de entorno
- [ ] Agregar `.env` al `.gitignore`

### 5. **Sistema de Colores**
- [ ] Definir paleta de colores consistente
- [ ] Crear variables CSS para colores:
  - [ ] Colores primarios
  - [ ] Colores secundarios
  - [ ] Colores de estado (success, error, warning)
  - [ ] Colores de fondo
  - [ ] Colores de texto
- [ ] Implementar tema oscuro/claro
- [ ] Aplicar colores en todos los componentes

### 6. **Cambiar problema por motivo de ingreso**

## 🎨 Detalles de Implementación

### Colores Sugeridos:
```css
:root {
  /* Colores principales */
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  
  /* Colores de fondo */
  --bg-primary: rgb(15, 15, 15);
  --bg-secondary: #4b4b4b;
  --bg-light: #f8f9fa;
  
  /* Colores de texto */
  --text-primary: #ffffff;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;
}
```

### Estructura de Rutas Sugerida:
```jsx
// App.jsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/login" element={<Login />} />
    <Route path="/equipos" element={<EquiposList />} />
    <Route path="/pendientes" element={<PendientesList />} />
  </Routes>
</BrowserRouter>
```

## 📝 Notas Adicionales
- Priorizar la implementación del ruteo para mejor UX
- Los equipos pendientes más pequeños mejorarán la densidad de información
- El sistema de colores debe ser consistente en toda la aplicación
- Las variables de entorno son críticas para la seguridad

---
*Última actualización: $(date)* 