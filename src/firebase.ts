import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// تفعيل ميزة العمل بدون إنترنت وتقليل استهلاك البيانات
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // تفشل في حالة فتح عدة تبويبات للمتصفح في وقت واحد
        console.warn('Persistence failed-precondition');
    } else if (err.code === 'unimplemented') {
        // المتصفح لا يدعم هذه الميزة
        console.warn('Persistence unimplemented');
    }
});

export const auth = getAuth(app);
