import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, getCurrentUser } from '../supabase.js';
import Icon from './Icon.jsx';
import ProcesosPage from './ProcesosPage.jsx';
import './Settings.css';

export default function Settings({ onClose }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('apariencia');
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    smtp_secure: true
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);

  // Cargar config SMTP al abrir
  useEffect(() => {
    async function fetchConfig() {
      setSmtpLoading(true);
      setSmtpMessage('');
      const { data: { user }, error: userError } = await getCurrentUser();
      if (!user) {
        setSmtpMessage('No autenticado');
        setSmtpLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('smtp_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSmtpConfig({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port?.toString() || '',
          smtp_user: data.smtp_user || '',
          smtp_pass: data.smtp_pass || '',
          smtp_from: data.smtp_from || '',
          smtp_secure: data.smtp_secure ?? true
        });
      } else {
        setSmtpConfig({
          smtp_host: '',
          smtp_port: '',
          smtp_user: '',
          smtp_pass: '',
          smtp_from: '',
          smtp_secure: true
        });
      }
      setSmtpLoading(false);
      if (error || userError) setSmtpMessage('Error al cargar configuración SMTP');
    }
    if (activeTab === 'email') fetchConfig();
  }, [activeTab]);

  // Actualiza window.emailEnabled globalmente para que otros componentes lo consulten
  useEffect(() => {
    window.emailEnabled = emailEnabled;
  }, [emailEnabled]);

  async function handleSmtpSave(e) {
    e.preventDefault();
    setSmtpLoading(true);
    setSmtpMessage('');
    const { data: { user }, error: userError } = await getCurrentUser();
    if (!user) {
      setSmtpMessage('No autenticado');
      setSmtpLoading(false);
      return;
    }
    // Ensure smtp_port is a number and only send valid fields
    const upsertData = {
      smtp_host: smtpConfig.smtp_host,
      smtp_port: Number(smtpConfig.smtp_port),
      smtp_user: smtpConfig.smtp_user,
      smtp_pass: smtpConfig.smtp_pass,
      smtp_from: smtpConfig.smtp_from,
      smtp_secure: !!smtpConfig.smtp_secure,
      user_id: user.id
    };
    console.log('Upsert data:', upsertData); // Debug: log data being sent
    const { error } = await supabase
      .from('smtp_config')
      .upsert(upsertData, { onConflict: ['user_id'] });
    if (error) {
      console.error('Supabase error:', error); // Debug: log full error
    }
    setSmtpLoading(false);
    setSmtpMessage(error ? `Error al guardar configuración: ${error.message}` : 'Configuración guardada');
  }

  const tabs = [
    { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
    { id: 'procesos', label: 'Procesos', icon: 'cog' },
    { id: 'email', label: 'Email', icon: 'envelope' },
  ];

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">
            <Icon name="cog" className="settings-icon" />
            Configuración
          </h2>
          <button className="settings-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {activeTab === 'apariencia' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Apariencia</h3>
              {/* Switch para activar/desactivar función de email global */}
              <div className="settings-item">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={e => setEmailEnabled(e.target.checked)}
                  />
                  Activar función de email (notas y recibos)
                </label>
              </div>
              {/* Switch para mostrar/ocultar configuración de email */}
              <div className="settings-item">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={showEmailConfig}
                    onChange={e => setShowEmailConfig(e.target.checked)}
                  />
                  Mostrar configuración de email
                </label>
              </div>
              {/* ...resto de apariencia... */}
              <div className="settings-item">
                <div className="settings-item-info">
                  <h4 className="settings-item-title">Modo Oscuro</h4>
                  <p className="settings-item-description">
                    Activa el modo oscuro para reducir la fatiga visual
                  </p>
                </div>
                
                <label className="theme-toggle">
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={toggleTheme}
                  />
                  <span className="theme-toggle-slider"></span>
                </label>
              </div>

              <div className="settings-item">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={showEmailConfig}
                    onChange={e => setShowEmailConfig(e.target.checked)}
                  />
                  Mostrar configuración de email
                </label>
              </div>
            </div>
          )}

          {activeTab === 'procesos' && (
            <div className="settings-procesos-section">
              <ProcesosPage />
            </div>
          )}

          {activeTab === 'email' && showEmailConfig && emailEnabled && (
            <form className="settings-section" onSubmit={handleSmtpSave}>
              <h3 className="settings-section-title">Configuración de Email SMTP</h3>
              <div className="settings-item">
                <label>Servidor SMTP</label>
                <input type="text" value={smtpConfig.smtp_host} onChange={e => setSmtpConfig(c => ({ ...c, smtp_host: e.target.value }))} required />
              </div>
              <div className="settings-item">
                <label>Puerto</label>
                <input type="number" value={smtpConfig.smtp_port} onChange={e => setSmtpConfig(c => ({ ...c, smtp_port: e.target.value }))} required />
              </div>
              <div className="settings-item">
                <label>Usuario</label>
                <input type="text" value={smtpConfig.smtp_user} onChange={e => setSmtpConfig(c => ({ ...c, smtp_user: e.target.value }))} required />
              </div>
              <div className="settings-item">
                <label>Contraseña</label>
                <input type="password" value={smtpConfig.smtp_pass} onChange={e => setSmtpConfig(c => ({ ...c, smtp_pass: e.target.value }))} required />
              </div>
              <div className="settings-item">
                <label>Remitente (From)</label>
                <input type="email" value={smtpConfig.smtp_from} onChange={e => setSmtpConfig(c => ({ ...c, smtp_from: e.target.value }))} required />
              </div>
              <div className="settings-item">
                <label>SSL/TLS</label>
                <input type="checkbox" checked={smtpConfig.smtp_secure} onChange={e => setSmtpConfig(c => ({ ...c, smtp_secure: e.target.checked }))} />
                <span style={{ marginLeft: 8 }}>{smtpConfig.smtp_secure ? 'Seguro (recomendado)' : 'Sin cifrado'}</span>
              </div>
              <button type="submit" className="settings-save-btn" disabled={smtpLoading}>Guardar</button>
              {smtpMessage && <div className="settings-message">{smtpMessage}</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

