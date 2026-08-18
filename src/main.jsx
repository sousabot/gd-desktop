import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/rift-theme.css';

// HashRouter (not BrowserRouter) because the production build is loaded
// from a local file:// URL under Electron — path-based routing breaks there.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
