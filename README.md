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
| 🟡 카톡으로 보내기 | Android 공유 창이 열려요. 카카오톡에서 어머니를 고르면 돼요. |
| 복사만 하기 | 내용을 클립보드에 복사해요. |

메시지는 내 폰에서 직접 보내요. 비용은 들지 않아요.

## 설치 (GitHub Pages)

1. 리포의 **Settings → Pages**에서 **Source**를 `Deploy from a branch`로 바꾸고, 브랜치를 `main`, 폴더를 `/ (root)`로 정해요.
2. 1~2분 뒤 `https://choehanmin.github.io/whereismyson/`에서 열려요.
3. Android Chrome으로 그 주소를 열고 **⋮ → 홈 화면에 추가**를 누르면 앱처럼 쓸 수 있어요.
4. 처음 열면 설정 창이 떠요. 어머니 번호, 호칭, 내 이름을 넣어주세요.

## 부모님 화면 (`parents.html`)

부모님은 **https://choehanmin.github.io/whereismyson/parents.html** 에서 등록된 전화번호와 6자리 PIN으로 로그인해요.
로그인하면 아들이 지금 집인지 밖인지, 누구를 만나 어디 갔는지, 몇 시에 들어오는지를 실시간으로 볼 수 있어요.
등록되지 않은 번호로는 로그인해도 아무것도 볼 수 없어요.

아들 앱에서는 ⚙️ 설정 → **부모님 화면 연결**에서 로그인하면, 버튼을 누를 때마다 부모님 화면에도 반영돼요.

### Firebase 설정 (처음 한 번)

전화번호는 리포에 넣지 않고 Firebase에만 등록해요.

1. https://console.firebase.google.com 에서 **프로젝트 추가**를 눌러요. Google 애널리틱스는 꺼도 돼요.
2. **Authentication → 시작하기 → 이메일/비밀번호**를 사용 설정해요.
3. **Authentication → 사용자 → 사용자 추가**로 아들, 어머니, 아버지 계정을 하나씩 만들어요.
   - 이메일: `전화번호숫자만@whereismyson.app` (예: `01012345678@whereismyson.app`)
   - 비밀번호: 6자리 PIN
4. **Firestore Database → 데이터베이스 만들기**에서 위치는 `asia-northeast3 (서울)`, 모드는 **프로덕션 모드**로 만들어요.
5. **Firestore → 규칙** 탭에 [`firestore.rules`](firestore.rules) 내용을 붙여넣어요.
   `SON_UID`, `MOM_UID`, `DAD_UID`를 3번에서 만든 계정의 **사용자 UID**로 바꾸고 **게시**해요.
6. **프로젝트 설정 → 내 앱 → 웹 앱 추가(`</>`)**를 눌러요. 나오는 `firebaseConfig` 값을 [`firebase-config.js`](firebase-config.js)에 넣어요.

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
- `manifest.webmanifest`, `parents.webmanifest`, `sw.js`, `icon*`: 홈 화면 설치와 오프라인 지원
