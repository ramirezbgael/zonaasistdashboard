import { useState } from 'react';
//import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard';
import '../style.css';

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <div>
      <h1></h1>
      <Dashboard />
    </div>
  );
}
