import '@fontsource-variable/manrope';
import '@fontsource-variable/fraunces/opsz.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startConnection } from './net/controller';

startConnection();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
