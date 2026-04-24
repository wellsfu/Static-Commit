// Copy this file to firebase.config.js and fill in your Firebase project values.
// firebase.config.js is in .gitignore and will NOT be committed.
// In production, GitHub Actions injects this file automatically from repository secrets.

export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
