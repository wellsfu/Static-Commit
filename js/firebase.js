import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// firebaseConfig is injected at deploy time from js/firebase.config.js
// For local development: copy js/firebase.config.example.js → js/firebase.config.js and fill in your values
import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
