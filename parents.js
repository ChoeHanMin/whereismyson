const $ = (id) => document.getElementById(id);

let cloud = null;
try {
  cloud = await import('./cloud.js');
} catch {
  // 인터넷이 안 되거나 Firebase를 못 불러온 경우
}

// 카카오: 부모님은 한 번 연결만 해두면 아들의 친구 목록에 나타나요
let kakao = null;
try {
  kakao = await import('./kakao.js');
} catch {
  // 무시
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

function renderKakao() {
  if (!kakao || !kakao.enabled) return;
  const connected = kakao.isConnected();
  $('kakaoConnect').hidden = connected;
  $('kakaoConnected').hidden = !connected;
}

if (kakao && kakao.enabled) {
  const result = await kakao.handleRedirect();
  if (result === 'ok') toast('카카오톡 연결됐어요');
  else if (result === 'denied') toast('카카오 동의가 취소됐어요');
  else if (result === 'error') toast('카카오톡 연결에 실패했어요');
  renderKakao();
  $('kakaoLoginBtn').addEventListener('click', () => kakao.startLogin());
}

function fmtTime(date) {
  const d = new Date(date);
  const s = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 1) return `내일 ${s}`;
  if (diff === -1) return `어제 ${s}`;
  return s;
}

function fmtDateTime(date) {
  return new Date(date).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
  });
}

const TYPE_EMOJI = { leave: '🚪', late: '🙏', home: '🏠' };

let unsubs = [];
let lastStatus = null;

function show(view) {
  $('loginPanel').hidden = view !== 'login';
  $('notReady').hidden = view !== 'notReady';
  $('statusCard').hidden = view !== 'main';
  $('eventsPanel').hidden = view !== 'main';
  $('logoutBtn').hidden = view !== 'main';
  $('kakaoPanel').hidden = view !== 'main' || !kakao || !kakao.enabled;
}

function renderStatus() {
  const s = lastStatus;
  const detail = $('statusDetail');
  detail.replaceChildren();

  if (!s) {
    $('statusEmoji').textContent = '🤔';
    $('statusLabel').textContent = '아직 소식이 없어요';
    return;
  }

  const updated = s.updatedAt ? s.updatedAt.toDate() : null;

  if (s.status === 'out' && s.outing) {
    const { who, where, eta, leftAt } = s.outing;
    const overdue = new Date(eta) < new Date();
    $('statusEmoji').textContent = '🚶';
    $('statusLabel').textContent = '밖에 있어요';
    const lines = [
      who && `👥 ${who} 만나요`,
      where && `📍 ${where}`,
      `🕒 ${fmtTime(leftAt)} 나감`,
    ].filter(Boolean);
    detail.append(lines.join('\n') + '\n');
    const etaLine = document.createElement('span');
    etaLine.textContent = `🏠 ${fmtTime(eta)} 귀가 예정${overdue ? ' (지났어요!)' : ''}`;
    if (overdue) etaLine.className = 'overdue';
    detail.append(etaLine);
  } else {
    $('statusEmoji').textContent = '🏠';
    $('statusLabel').textContent = '집에 있어요';
    if (updated) detail.append(`${fmtTime(updated)} 도착`);
  }
}

function renderEvents(events) {
  const list = $('events');
  list.replaceChildren();
  if (events.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '아직 소식이 없어요';
    list.append(li);
  }
  for (const e of events) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = e.at ? fmtDateTime(e.at.toDate()) : '';
    const text = document.createElement('div');
    text.style.whiteSpace = 'pre-line';
    text.textContent = e.text || TYPE_EMOJI[e.type] || '';
    li.append(time, text);
    list.append(li);
  }
}

function onDenied(err) {
  if (err && err.code === 'permission-denied') {
    cloud.logout();
    $('loginError').textContent = '등록된 번호가 아니에요';
    $('loginError').hidden = false;
  }
}

function stopWatching() {
  unsubs.forEach((u) => u());
  unsubs = [];
}

if (!cloud || !cloud.enabled) {
  $('notReady').querySelector('.note').textContent = cloud
    ? '아직 서버가 준비되지 않았어요.'
    : '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  show('notReady');
} else {
  cloud.onUser((user) => {
    stopWatching();
    if (!user) {
      show('login');
      return;
    }
    if (cloud.isSon(user)) {
      location.replace('./');
      return;
    }
    show('main');
    unsubs.push(cloud.watchStatus((s) => { lastStatus = s; renderStatus(); }, onDenied));
    unsubs.push(cloud.watchEvents(renderEvents, onDenied));
  });
}

$('loginBtn').addEventListener('click', async () => {
  const phone = $('loginPhone').value;
  const pin = $('loginPin').value;
  $('loginError').hidden = true;
  if (!phone || pin.length < 6) {
    $('loginError').textContent = '전화번호와 6자리 PIN을 넣어주세요';
    $('loginError').hidden = false;
    return;
  }
  try {
    await cloud.login(phone, pin);
    $('loginPin').value = '';
  } catch (e) {
    $('loginError').textContent = cloud.loginErrorMessage(e);
    $('loginError').hidden = false;
  }
});

$('logoutBtn').addEventListener('click', () => cloud.logout());

// 귀가 예정 시간이 지났는지 주기적으로 다시 표시
setInterval(renderStatus, 30000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
