import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min: datos considerados frescos, no refetch al montar
      gcTime: 24 * 60 * 60 * 1000, // 24 h en caché (como “copia local”)
    },
  },
});

const persister =
  typeof window !== 'undefined'
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: 'zonaasist-react-query',
      })
    : null;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persister ? { persister } : undefined}>
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>
);
