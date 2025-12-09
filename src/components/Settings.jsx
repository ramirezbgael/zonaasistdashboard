import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon.jsx';
import ProcesosPage from './ProcesosPage.jsx';
import './Settings.css';

export default function Settings({ onClose }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('apariencia');

  const tabs = [
    { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
    { id: 'procesos', label: 'Procesos', icon: 'cog' },
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
            </div>
          )}

          {activeTab === 'procesos' && (
            <div className="settings-procesos-section">
              <ProcesosPage />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

