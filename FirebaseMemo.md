// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDiT1TQY6cU3D66hTnsRWg4LLQWOKO26Cs",
  authDomain: "addressconversion-93436.firebaseapp.com",
  projectId: "addressconversion-93436",
  storageBucket: "addressconversion-93436.firebasestorage.app",
  messagingSenderId: "570611168026",
  appId: "1:570611168026:web:b23839ca0c47be221e72a3",
  measurementId: "G-G4KYSF6M1Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);