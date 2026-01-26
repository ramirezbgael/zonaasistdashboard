import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login.jsx';
import MainLayout from './components/MainLayout.jsx';
import MainDashboard from './components/MainDashboard.jsx';
import Dashboard from './components/Dashboard.jsx';
import EquipoDetalle from './components/EquipoDetalle.jsx';
import DocumentosPage from './components/DocumentosPage.jsx';
import LogisticaPage from './components/LogisticaPage.jsx';
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
              <Route path="equipos/:id" element={<EquipoDetalle />} />
              <Route path="documentos" element={<DocumentosPage />} />
              <Route path="logistica" element={<LogisticaPage />} />
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