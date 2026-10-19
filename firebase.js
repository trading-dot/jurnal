import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
export { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, onAuthStateChanged, signOut, deleteUser, getAdditionalUserInfo } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
export { collection, doc, setDoc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyBTxIhyGWK668Zg8DRI9Qi5XXwNa5p60Io",
  authDomain: "pertemuan-5-f5c9c.firebaseapp.com",
  projectId: "pertemuan-5-f5c9c",
  storageBucket: "pertemuan-5-f5c9c.firebasestorage.app",
  messagingSenderId: "763911312835",
  appId: "1:763911312835:web:64fe5210318dc95acc5976"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
