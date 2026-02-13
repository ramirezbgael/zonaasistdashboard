import { useNavigate } from 'react-router-dom';
import AddPedidoModal from './AddPedidoModal.jsx';

export default function NuevoPedidoPage({ demoMode = false }) {
  const navigate = useNavigate();
  const basePath = demoMode ? '/demo' : '';

  return (
    <AddPedidoModal
      mode="page"
      demoMode={demoMode}
      onClose={() => navigate(`${basePath}/logistica`)}
      onPedidoAdded={() => {
        navigate(`${basePath}/logistica`);
      }}
    />
  );
}

