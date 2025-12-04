import { useState } from 'react';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import MainLayout from './components/MainLayout.jsx';
import MainDashboard from './components/MainDashboard.jsx';
import './App.css';
import { supabase } from './supabase.js';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Rutas protegidas con el nuevo layout */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          {/* Dashboard principal (hub) */}
          <Route index element={<MainDashboard />} />
          
          {/* Módulo de Equipos (existente) */}
          <Route path="equipos" element={<Dashboard />} />
          
          {/* Módulos nuevos - por implementar */}
          <Route path="documentos" element={<ComingSoonPage module="Documentos y Facturación" />} />
          <Route path="logistica" element={<ComingSoonPage module="Logística y Pedidos" />} />
          <Route path="clientes" element={<ComingSoonPage module="Clientes y Proveedores" />} />
          <Route path="reportes" element={<ComingSoonPage module="Reportes y Analytics" />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

// Componente temporal para módulos no implementados
function ComingSoonPage({ module }) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '400px', 
      gap: '1rem' 
    }}>
      <div style={{ fontSize: '4rem' }}>🚧</div>
      <h2 style={{ margin: 0, color: '#1e293b' }}>Módulo de {module}</h2>
      <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '500px' }}>
        Este módulo está en desarrollo. Pronto estará disponible con todas las funcionalidades 
        para gestionar {module.toLowerCase()}.
      </p>
      <button 
        onClick={() => window.history.back()}
        style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          border: 'none',
          padding: '0.75rem 2rem',
          borderRadius: '25px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        ← Volver al Dashboard
      </button>
    </div>
  );
}
