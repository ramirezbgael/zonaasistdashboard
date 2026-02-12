import { useNavigate } from 'react-router-dom';
import AddDocumentoModal from './AddDocumentoModal.jsx';

export default function NuevoDocumentoPage() {
  const navigate = useNavigate();

  return (
    <AddDocumentoModal
      mode="page"
      onClose={() => navigate('/documentos')}
      onDocumentoAdded={() => {
        navigate('/documentos');
      }}
    />
  );
}

