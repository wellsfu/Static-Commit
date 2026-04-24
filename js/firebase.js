import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "REDACTED_API_KEY",
  authDomain: "trollgo-b6036.firebaseapp.com",
  projectId: "trollgo-b6036",
  storageBucket: "trollgo-b6036.firebasestorage.app",
  messagingSenderId: "REDACTED_SENDER_ID",
  appId: "1:REDACTED_SENDER_ID:web:9547809a236e5ef39fb97c",
  measurementId: "G-LS28QKDP9Q"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
