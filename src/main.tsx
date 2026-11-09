import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateFirestoreConnection } from './services/firebase.ts';
import { initClientSecurity } from './utils/security.ts';

// Test connection to Firestore on boot as required by Firestore integration rules
validateFirestoreConnection();

// Initialize client protection against long-press inspection, context menus, and debugger triggers
initClientSecurity();

createRoot(document.getElementById('root')!).render(<App />);
