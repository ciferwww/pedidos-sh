import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Admin from './Admin.jsx';
import SuperAdmin from './SuperAdmin.jsx';
import reportWebVitals from './reportWebVitals';

function Router() {
  const path = window.location.pathname;
  if (path === '/admin' || path === '/admin/') return <Admin />;
  if (path === '/superadmin')                  return <SuperAdmin />;
  return <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);

reportWebVitals();