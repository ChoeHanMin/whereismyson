// Firebase 연결: 로그인, 아들 상태 올리기, 부모님 화면에서 실시간으로 보기
import { firebaseConfig, SON_UID } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, serverTimestamp,
  onSnapshot, query, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const enabled = !!firebaseConfig;
export { SON_UID };

export function isSon(user) {
  return !!user && user.uid === SON_UID;
}

let auth;
let db;
if (enabled) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// 전화번호 + PIN 로그인을 Firebase 이메일/비밀번호 계정으로 처리
const EMAIL_DOMAIN = '@whereismyson.app';

export function phoneToEmail(phone) {
  return phone.replace(/\D/g, '') + EMAIL_DOMAIN;
}

export function emailToPhone(email) {
  const d = (email || '').replace(EMAIL_DOMAIN, '');
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d;
}

export function login(phone, pin) {
  return signInWithEmailAndPassword(auth, phoneToEmail(phone), pin);
}

export function logout() {
  return signOut(auth);
}

export function onUser(cb) {
  if (!enabled) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export function currentUser() {
  return enabled ? auth.currentUser : null;
}

// 아들 쪽: 현재 상태 덮어쓰기 + (type이 있으면) 기록 한 줄 추가
export async function publish({ status, outing, type, text }) {
  await setDoc(doc(db, 'status', 'current'), { status, outing, updatedAt: serverTimestamp() });
  if (type) await addDoc(collection(db, 'events'), { type, text, at: serverTimestamp() });
}

// 아들 쪽: 카카오 연결 정보 (아들만 읽고 쓸 수 있음)
export async function loadKakao() {
  const snap = await getDoc(doc(db, 'private', 'kakao'));
  return snap.exists() ? snap.data() : null;
}

export function saveKakao(state) {
  return setDoc(doc(db, 'private', 'kakao'), state);
}

// 부모님 쪽: 실시간 구독
export function watchStatus(cb, onError) {
  return onSnapshot(
    doc(db, 'status', 'current'),
    (snap) => cb(snap.exists() ? snap.data({ serverTimestamps: 'estimate' }) : null),
    onError,
  );
}

export function watchEvents(cb, onError) {
  const q = query(collection(db, 'events'), orderBy('at', 'desc'), limit(20));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }))),
    onError,
  );
}

export function loginErrorMessage(e) {
  const code = e && e.code;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
    return '전화번호나 PIN이 맞지 않아요';
  }
  if (code === 'auth/too-many-requests') return '시도가 너무 많아요. 잠시 후 다시 해주세요';
  if (code === 'auth/network-request-failed') return '인터넷 연결을 확인해 주세요';
  return '로그인에 실패했어요';
}
