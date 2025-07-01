import { supabase } from '../../supabase.js';

export default function PendienteItem({ pendiente, reload }) {
  const togglePendiente = async () => {
    const nuevoStatus = pendiente.status === 'terminado' ? 'pendiente' : 'terminado';
    await supabase.from('pendientes').update({ status: nuevoStatus }).eq('id', pendiente.id);
    reload();
  };

  return (
    <li className="card__list_item">
      <button
        type="button"
        className={`check-btn check${pendiente.status === 'terminado' ? ' completed' : ''}`}
        title={pendiente.status === 'terminado' ? 'Marcar como pendiente' : 'Marcar como terminado'}
        onClick={togglePendiente}
      >
        {pendiente.status === 'terminado' && (
          <svg className="check_svg" fill="currentColor" viewBox="0 0 16 16">
            <path clipRule="evenodd" fillRule="evenodd"
              d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z">
            </path>
          </svg>
        )}
      </button>
      <span className="list_text"> {pendiente.descripcion}</span>
    </li>
  );
}
