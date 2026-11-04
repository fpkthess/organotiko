import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DatabaseApp } from './DatabaseApp';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{import.meta.env.VITE_DATA_SOURCE === 'demo' && import.meta.env.DEV ? <App/> : <DatabaseApp/>}</React.StrictMode>);
