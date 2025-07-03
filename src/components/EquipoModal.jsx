import './EquipoModal.css';

export default function EquipoModal({ equipo, onClose }) {
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal">
          <button onClick={onClose} style={{ float: 'right' }}>Cerrar</button>
          <h2>Detalles del equipo</h2>
          <p><strong>Marca:</strong> {equipo.marca}</p>
          <p><strong>Modelo:</strong> {equipo.modelo}</p>
          <p><strong>Color:</strong> {equipo.color}</p>

          <p><strong>Nota:</strong> {equipo.nota}</p>

        </div>
    </div>
  );
}