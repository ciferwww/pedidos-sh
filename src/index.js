import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Admin from './Admin.jsx'; // ← Importamos tu interfaz de administrador
import reportWebVitals from './reportWebVitals';

// Un enrutador simple: detecta si estás en /admin
function Router() {
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
    return <Admin />;
  }
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router /> {/* ← Ahora renderizamos el Router en lugar de solo App */}
  </React.StrictMode>
);

reportWebVitals();