/** Renderer entry — mounts App behind AppInitializer (auth/setup gate). */
import React from 'react'
import ReactDOM, { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import '@fontsource-variable/geist'
import AppInitializer from './AppInitializer'

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
const root = createRoot(rootElement);

// Render the app
root.render(
  <React.StrictMode>
      <AppInitializer />
  </React.StrictMode>
);
