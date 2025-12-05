import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon.jsx';
import './Settings.css';

export default function Settings({ onClose }) {
  const { isDarkMode, toggleTheme } = useTheme();

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

        <div className="settings-content">
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
        </div>
      </div>
    </div>
  );
}

