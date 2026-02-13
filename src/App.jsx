import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login.jsx';
import MainLayout from './components/MainLayout.jsx';
import MainDashboard from './components/MainDashboard.jsx';
import Dashboard from './components/Dashboard.jsx';
import EquipoDetalle from './components/EquipoDetalle.jsx';
import DocumentosPage from './components/DocumentosPage.jsx';
import LogisticaPage from './components/LogisticaPage.jsx';
import NuevoEquipoPage from './components/NuevoEquipoPage.jsx';
import NuevoDocumentoPage from './components/NuevoDocumentoPage.jsx';
import NuevoPedidoPage from './components/NuevoPedidoPage.jsx';
import ClientesPage from './components/ClientesPage.jsx';
import InventarioPage from './components/InventarioPage.jsx';
import ReportesPage from './components/ReportesPage.jsx';
import WhatsAppPage from './components/WhatsAppPage.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import './App.css';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Ruta pública de demo para portafolio (sin PrivateRoute, pero con el mismo layout, en modo demo) */}
            <Route
              path="/demo"
              element={
                <MainLayout demoMode />
              }
            >
              <Route index element={<MainDashboard demoMode />} />
              <Route path="equipos" element={<Dashboard demoMode />} />
              <Route path="equipos/nuevo" element={<NuevoEquipoPage demoMode />} />
              <Route path="equipos/:id" element={<EquipoDetalle demoMode />} />
              <Route path="documentos" element={<DocumentosPage demoMode />} />
              <Route path="documentos/nuevo" element={<NuevoDocumentoPage demoMode />} />
              <Route path="logistica" element={<LogisticaPage demoMode />} />
              <Route path="logistica/nuevo" element={<NuevoPedidoPage demoMode />} />
              <Route path="clientes" element={<ClientesPage demoMode />} />
              <Route path="inventario" element={<InventarioPage demoMode />} />
              <Route path="reportes" element={<ReportesPage demoMode />} />
              <Route path="whatsapp" element={<WhatsAppPage demoMode />} />
              {/* Fallback demo: si cae en otra subruta de /demo, mostrar dashboard demo */}
              <Route path="*" element={<MainDashboard demoMode />} />
            </Route>
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <MainLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<MainDashboard />} />
              <Route path="equipos" element={<Dashboard />} />
              <Route path="equipos/nuevo" element={<NuevoEquipoPage />} />
              <Route path="equipos/:id" element={<EquipoDetalle />} />
              <Route path="documentos" element={<DocumentosPage />} />
              <Route path="documentos/nuevo" element={<NuevoDocumentoPage />} />
              <Route path="logistica" element={<LogisticaPage />} />
              <Route path="logistica/nuevo" element={<NuevoPedidoPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="inventario" element={<InventarioPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}