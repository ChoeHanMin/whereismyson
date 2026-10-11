// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → "SDK 설정 및 구성"의 firebaseConfig 값
// 이 값은 공개돼도 괜찮아요. 누가 볼 수 있는지는 firestore.rules가 막아요.
export const firebaseConfig = {
  apiKey: 'AIzaSyBuzIQB_-0wqqhucjIP9X4Ijb4C3JUGbTE',
  authDomain: 'whereismyson-69e24.firebaseapp.com',
  projectId: 'whereismyson-69e24',
  storageBucket: 'whereismyson-69e24.firebasestorage.app',
  messagingSenderId: '169901474052',
  appId: '1:169901474052:web:f4602792459ec0693f5051',
};

// 아들 계정의 UID. 이 계정으로 로그인하면 아들 화면, 나머지는 부모님 화면으로 가요.
export const SON_UID = 'RP50dVDWDvVmaBqcIwcdXqn7GVm2';
