import '@fontsource-variable/nunito';
import '@fontsource-variable/fredoka';
import './styles/app.css';
import './styles/roles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installAudioUnlock, installClickSound } from './lib/sound';
import { startAccount } from './net/account';
import { startConnection } from './net/controller';

startConnection();
void startAccount();
installAudioUnlock();
installClickSound();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
