import PendienteItem from './PendienteItem';
import './EquipoCard.css';

export default function EquipoCard({ equipo, reload, onClick }) {
  const nota = equipo.nota.toString();
  
  // Array de 10 colores distintos
  const colors = [
    "#4300FF",
    "#41d3f0",
    "#3bdb9b", 
    "#b835cc",
    "#ff6b6b",
    "#4ecdc4",
    "#feca57",
    "#ff9ff3",
    "#54a0ff",
    "#00d2d3"
  ];
  
  // Asignar color basado en el ID del equipo
  const colorIndex = equipo.id % colors.length;
  const cardColor = colors[colorIndex];

  return (
    <div 
      className="card" 
      onClick={onClick} 
      style={{ 
        cursor: 'pointer',
        '--card-bg-color': cardColor
      }}
    >
      <ul className="card_list">
        <div className="card_number">
          #<span style={{ fontSize: '.4em' }}>{nota.slice(0, -1)}</span>
          <span style={{ fontSize: '3em' }}>{nota.slice(-1)}</span>
        </div>
        <div className="card_title">
          <span style={{ fontSize: '2.6em' }}>{equipo.marca}</span>
          <br />
          <span style={{ fontSize: '1em' }}>{equipo.modelo}</span>
          <br />
          <span style={{ color: 'var(--primary)', fontSize: '0.9em' }}>{equipo.color}</span>
        </div>
        {equipo.pendientes && equipo.pendientes.length > 0
          ? equipo.pendientes.map(p => (
              <PendienteItem key={p.id} pendiente={p} reload={reload} />
            ))
          : <li className="card__list_item">Sin pendientes.</li>}
      </ul>
    </div>
  );
}
