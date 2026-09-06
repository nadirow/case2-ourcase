/* =========================================================
   FIREBASE SETUP
   Project: nia-ultimate
========================================================= */

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore
} from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   CONFIG
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyBtaf8GlntGucnt0fj_WX--UCJeZdto4n8",
    authDomain: "nia-ultimate.firebaseapp.com",
    projectId: "nia-ultimate",
    storageBucket: "nia-ultimate.firebasestorage.app",
    messagingSenderId: "48054427819",
    appId: "1:48054427819:web:bc4fb9c34b7601995d17ee"
};


/* =========================================================
   INITIALIZE
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   ANONYMOUS AUTH
=========================================================

   Your app currently lets the user choose I/N without
   passwords.

   Anonymous Firebase Auth gives Firestore an authenticated
   user without requiring a password.
========================================================= */

let authReadyResolve;

const authReady = new Promise(resolve => {
    authReadyResolve = resolve;
});


onAuthStateChanged(auth, async user => {

    if (user) {
        authReadyResolve(user);
        return;
    }

    try {

        await signInAnonymously(auth);

    } catch (error) {

        console.error(
            "Firebase anonymous authentication failed:",
            error
        );

        authReadyResolve(null);
    }
});


/* =========================================================
   MAKE SURE AUTH EXISTS
========================================================= */

async function ensureFirebaseAuth() {

    let user = auth.currentUser;

    if (user) {
        return user;
    }

    user = await authReady;

    if (user) {
        return user;
    }

    const credential =
        await signInAnonymously(auth);

    return credential.user;
}


/* =========================================================
   EXPORT
========================================================= */

export {
    app,
    auth,
    db,
    ensureFirebaseAuth
};