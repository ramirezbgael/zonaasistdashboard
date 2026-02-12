import Icon from './Icon.jsx';
import './MainDashboard.css';

export default function DemoSectionPage({ title, subtitle, items }) {
  return (
    <div className="main-dashboard">
      <section className="quick-actions">
        <h2 className="section-title quick-actions-title">{title}</h2>
        {subtitle && (
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {subtitle}
          </p>
        )}
        <div className="quick-actions-grid">
          {items.map((item) => (
            <div key={item.id} className="quick-action-btn" style={{ alignItems: 'flex-start' }}>
              <Icon name={item.icon || 'box'} className="action-icon" />
              <div style={{ textAlign: 'left' }}>
                <div className="action-label">{item.title}</div>
                {item.description && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.description}</div>
                )}
                {item.meta && (
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    {item.meta}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

