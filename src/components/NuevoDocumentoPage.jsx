import { useNavigate } from 'react-router-dom';
import AddDocumentoModal from './AddDocumentoModal.jsx';

export default function NuevoDocumentoPage({ demoMode = false }) {
  const navigate = useNavigate();
  const basePath = demoMode ? '/demo' : '';

  return (
    <AddDocumentoModal
      mode="page"
      demoMode={demoMode}
      onClose={() => navigate(`${basePath}/documentos`)}
      onDocumentoAdded={() => {
        navigate(`${basePath}/documentos`);
      }}
    />
  );
}

