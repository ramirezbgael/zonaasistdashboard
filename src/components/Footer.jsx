import Icon from './Icon.jsx';
import './Footer.css';

export default function Footer({ demoMode = false }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-brand">
            <Icon name="tools" className="footer-logo-icon" />
            <span className="footer-brand-text">Zona Asist</span>
          </div>
          <p className="footer-tagline">
            Sistema de gestión para talleres técnicos
          </p>
        </div>

        <div className="footer-section">
          <h4 className="footer-title">Enlaces Rápidos</h4>
          <ul className="footer-links">
            <li>
              <a href={demoMode ? "/demo" : "/"}>
                <Icon name="home" />
                Dashboard
              </a>
            </li>
            <li>
              <a href={demoMode ? "/demo/equipos" : "/equipos"}>
                <Icon name="tools" />
                Equipos
              </a>
            </li>
            <li>
              <a href={demoMode ? "/demo/documentos" : "/documentos"}>
                <Icon name="file-alt" />
                Documentos
              </a>
            </li>
            <li>
              <a href={demoMode ? "/demo/clientes" : "/clientes"}>
                <Icon name="users" />
                Clientes
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-title">Información</h4>
          <ul className="footer-links">
            <li>
              <Icon name="calendar-alt" />
              <span>© {currentYear} Zona Asist</span>
            </li>
            <li>
              <Icon name="code" />
              <span>Versión 1.0</span>
            </li>
            {demoMode && (
              <li className="footer-demo-badge">
                <Icon name="info-circle" />
                <span>Modo Demo</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          Todos los derechos reservados. Zona Asist © {currentYear}
        </p>
      </div>
    </footer>
  );
}
