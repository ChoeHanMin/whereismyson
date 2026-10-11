# Where is my son 🏠

> 출필고 반필면(出必告 反必面) — 나갈 때는 반드시 아뢰고, 돌아오면 반드시 얼굴을 뵌다.

나갈 때, 늦을 때, 들어올 때 버튼 한 번으로 어머니께 카톡이나 문자를 보내는 웹앱이에요.

## 기능

- **🚪 나가요**: 누구를 만나는지, 어디 가는지, 몇 시쯤 들어오는지 알려요.
- **🙏 늦어요**: +30분, +1시간, +2시간을 고르거나 시간을 직접 정해요. 사유를 함께 보낼 수도 있어요.
- **🏠 들어왔어요**: 도착 시간과 함께 알려요.
- **⏰ 귀가 시간 알림**: 귀가 예정 시간이 지나면 늦는다고 알리라는 배너를 띄워요.
- **📜 기록**: 보낸 메시지를 최근 50개까지 보관해요. 기록은 내 폰에만 저장돼요.

## 보내는 방법

| 버튼 | 동작 |
| --- | --- |
| 💬 문자로 보내기 | 어머니 번호와 내용이 채워진 문자 앱이 열려요. 전송 버튼만 누르면 돼요. |
| 🟡 카톡 자동 전송 | 카카오톡을 연결했으면 부모님께 바로 보내요. 연결하지 않았으면 공유 창이 열려요. |
| 복사만 하기 | 내용을 클립보드에 복사해요. |

메시지는 내 폰에서 직접 보내요. 비용은 들지 않아요.

## 설치 (GitHub Pages)

1. 리포의 **Settings → Pages**에서 **Source**를 `Deploy from a branch`로 바꾸고, 브랜치를 `main`, 폴더를 `/ (root)`로 정해요.
2. 1~2분 뒤 `https://choehanmin.github.io/whereismyson/`에서 열려요.
3. Android Chrome으로 그 주소를 열고 **⋮ → 홈 화면에 추가**를 누르면 앱처럼 쓸 수 있어요.
4. 처음 열면 설정 창이 떠요. 어머니 번호, 호칭, 내 이름을 넣어주세요.

## 로그인과 부모님 화면

가족 모두 **https://choehanmin.github.io/whereismyson/** 에서 등록된 전화번호와 6자리 PIN으로 로그인해요.

- **아들 번호로 로그인하면** 나가요, 늦어요, 들어왔어요 화면이 나와요. 버튼을 누르면 문자/카톡과 함께 부모님 화면에도 반영돼요.
- **어머니나 아버지 번호로 로그인하면** 부모님 화면(`parents.html`)으로 넘어가요. 아들이 지금 집인지 밖인지, 누구를 만나 어디 갔는지, 몇 시에 들어오는지를 실시간으로 볼 수 있어요.
- 등록되지 않은 번호로는 아무것도 볼 수 없어요.

카톡은 설정에서 고른 부모님께 자동으로 가요. 문자는 문자 앱이 열리면 받는 사람을 직접 골라요.

### Firebase 설정 (처음 한 번)

전화번호는 리포에 넣지 않고 Firebase에만 등록해요.

1. https://console.firebase.google.com 에서 **프로젝트 추가**를 눌러요. Google 애널리틱스는 꺼도 돼요.
2. **Authentication → 시작하기 → 이메일/비밀번호**를 사용 설정해요.
3. **Authentication → 사용자 → 사용자 추가**로 아들, 어머니, 아버지 계정을 하나씩 만들어요.
   - 이메일: `전화번호숫자만@whereismyson.app` (예: `01012345678@whereismyson.app`)
   - 비밀번호: 6자리 PIN
4. **Firestore Database → 데이터베이스 만들기**에서 위치는 `asia-northeast3 (서울)`, 모드는 **프로덕션 모드**로 만들어요.
5. **Firestore → 규칙** 탭에 [`firestore.rules`](firestore.rules) 내용을 붙여넣고 **게시**해요.
   계정을 다시 만들었다면 규칙과 `firebase-config.js`의 `SON_UID`를 새 **사용자 UID**로 바꿔요.
6. **프로젝트 설정 → 내 앱 → 웹 앱 추가(`</>`)**를 눌러요. 나오는 `firebaseConfig` 값을 [`firebase-config.js`](firebase-config.js)에 넣어요.

## 카톡 자동 전송 (카카오 친구 메시지)

아들이 버튼을 누르면 아들 카톡 계정으로 부모님 1:1 채팅방에 메시지가 바로 가요.

1. https://developers.kakao.com 에서 **애플리케이션 추가**를 눌러요.
2. **앱 키**의 **JavaScript 키**와 **REST API 키**를 [`kakao-config.js`](kakao-config.js)에 넣어요.
3. **플랫폼 → Web**에 사이트 도메인 `https://choehanmin.github.io`를 등록해요.
4. **카카오 로그인**을 활성화하고, **Redirect URI**에 아래 두 주소를 등록해요.
   - `https://choehanmin.github.io/whereismyson/`
   - `https://choehanmin.github.io/whereismyson/parents.html`
5. **동의항목**에서 **카카오톡 메시지 전송**과 **카카오톡 친구 목록**을 켜요.
6. **팀 관리**에서 부모님 카카오 계정을 팀원으로 초대해요. 심사 전에는 팀원끼리만 친구 메시지를 주고받을 수 있어요.
7. 부모님이 부모님 화면에서 **카카오톡 연결**을 한 번 눌러요.
8. 아들이 ⚙️ 설정 → **카카오톡 연결**을 누른 뒤 **받는 사람**으로 부모님을 골라요.

## 로컬 실행

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## 구성

순수 HTML, CSS, JS로 만들었고 빌드 과정이 없어요. 서버는 Firebase(무료 요금제)를 써요.

- `index.html`, `style.css`, `app.js`: 앱 본체
- `parents.html`, `parents.js`: 부모님 화면
- `cloud.js`, `firebase-config.js`, `firestore.rules`: Firebase 로그인과 실시간 공유
- `kakao.js`, `kakao-config.js`: 카카오톡 친구 메시지 자동 전송
- `manifest.webmanifest`, `parents.webmanifest`, `sw.js`, `icon*`: 홈 화면 설치와 오프라인 지원
