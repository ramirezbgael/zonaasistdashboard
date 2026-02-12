import { useNavigate } from 'react-router-dom';
import AddPedidoModal from './AddPedidoModal.jsx';

export default function NuevoPedidoPage() {
  const navigate = useNavigate();

  return (
    <AddPedidoModal
      mode="page"
      onClose={() => navigate('/logistica')}
      onPedidoAdded={() => {
        navigate('/logistica');
      }}
    />
  );
}

