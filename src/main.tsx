import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateFirestoreConnection } from './services/firebase.ts';

// Test connection to Firestore on boot as required by Firestore integration rules
validateFirestoreConnection();

createRoot(document.getElementById('root')!).render(<App />);

