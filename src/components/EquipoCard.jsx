import PendienteItem from './PendienteItem';
import './EquipoCard.css';

export default function EquipoCard({ equipo, reload }) {

  const nota = equipo.nota.toString();

  return (
    <div className="card">
      <div className="card_number">
        #<span style={{ fontSize: '.4em' }}>{nota.slice(0, -1)}</span><span style={{ fontSize: '3em' }}>{nota.slice(-1)}</span>
      </div>
      <div className="card_title">
        <span style={{ fontSize: '2.6em' }}>{equipo.marca}</span>
        <span style={{ fontSize: '1em' }}> {equipo.modelo}</span>
        <br />
        <span style={{ color: 'var(--primary)', fontSize: '0.9em' }}>{equipo.color}</span>
      </div>
      <ul className="card_list">
        {equipo.pendientes && equipo.pendientes.length > 0
          ? equipo.pendientes.map(p => (
            <PendienteItem key={p.id} pendiente={p} reload={reload} />
          ))
          : <li className="card__list_item">Sin pendientes.</li>
        }
      </ul>
      <div className="card_buttons">
        <button>CALL</button>
        <button>MORE</button>
        <button className="button">Marcar como listo</button>
      </div>
    </div>
  );
}
