// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { ReCaptchaV3Provider, initializeAppCheck } from "firebase/app-check";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCpQAoZEZufrRsOxev2TNcP_A_D0dwbasM",
  authDomain: "evtree-1.firebaseapp.com",
  projectId: "evtree-1",
  storageBucket: "evtree-1.firebasestorage.app",
  messagingSenderId: "121004750347",
  appId: "1:121004750347:web:363a33cb86ebe5d51d790e",
  measurementId: "G-QDEWK2W36Z",
};

const firebaseApp = initializeApp(firebaseConfig);

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaV3Provider("6LepM_YrAAAAAHVY3Px_MrNBS3sp9vOKfItIU7dV"),
});

export { firebaseApp };
