import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Firebase Webアプリの公開設定（秘密情報ではない。アクセス制御はFirebase/GAS側で行う）
const firebaseConfig = {
  apiKey: 'AIzaSyBlcN3id1WbVmWYhtv_pxGlO2PK7dwORCg',
  authDomain: 'higopella-portal-afa39.firebaseapp.com',
  projectId: 'higopella-portal-afa39',
  appId: '1:905363194153:web:f8489191cbd959c29f3738'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const initialUserReady = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    resolve(user);
  });
});

window.higopellaFirebase = {
  waitForInitialUser: () => initialUserReady,
  getCurrentUser: () => auth.currentUser,
  signInWithGoogle: async () => (await signInWithPopup(auth, provider)).user,
  signOutUser: () => signOut(auth)
};
window.dispatchEvent(new Event('higopella-firebase-ready'));
