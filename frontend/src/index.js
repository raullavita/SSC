import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const INSTALLED_SHELL_PLATFORMS = new Set(['electron', 'android', 'ios']);
const isInstalledShell = INSTALLED_SHELL_PLATFORMS.has(process.env.REACT_APP_SSC_PLATFORM);
const Router = isInstalledShell ? HashRouter : BrowserRouter;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);