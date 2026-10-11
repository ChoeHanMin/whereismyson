'use strict';

const STATE_KEY = 'wims.state';
const SETTINGS_KEY = 'wims.settings';
const HISTORY_LIMIT = 50;

const $ = (id) => document.getElementById(id);

// ---------- 저장소 ----------

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패해도 앱은 계속 동작
  }
}

let state = load(STATE_KEY, { status: 'home', outing: null, history: [] });
let settings = load(SETTINGS_KEY, { myName: '' });

const GREETING = '부모님';

// ---------- 시간 ----------

// "HH:MM" → 지금 이후 가장 가까운 그 시각 (이미 지났으면 내일)
function nextOccurrence(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

function isTomorrow(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);
  return t - today === 86400000;
}

function fmtTime(date) {
  const d = new Date(date);
  const s = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return isTomorrow(d) ? `내일 ${s}` : s;
}

function fmtDateTime(date) {
  return new Date(date).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
  });
}

function toHHMM(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- 메시지 ----------

function signature() {
  return settings.myName ? `[${settings.myName}] ` : '';
}

function mom() {
  return GREETING;
}

function leaveMessage({ who, where, eta }) {
  const lines = [`${signature()}${mom()}, 저 지금 나가요 🚪`];
  if (who) lines.push(`👥 ${who} 만나요`);
  if (where) lines.push(`📍 ${where}`);
  lines.push(`🏠 ${fmtTime(eta)}쯤 들어갈게요`);
  return lines.join('\n');
}

function lateMessage({ oldEta, newEta, reason }) {
  const lines = [`${signature()}${mom()}, 죄송해요 좀 늦어요 🙏`];
  lines.push(`🏠 ${fmtTime(oldEta)} → ${fmtTime(newEta)}쯤 들어갈게요`);
  if (reason) lines.push(`💬 ${reason}`);
  return lines.join('\n');
}

function homeMessage(at) {
  return `${signature()}${mom()}, 집 도착했어요 🏠 (${fmtTime(at)})`;
}

// ---------- 보내기 ----------

const PARENTS_URL = new URL('parents.html', location.href).href;

let pending = null; // { text, apply, type, kakaoFailed }
let sending = false;

function openSendDialog() {
  $('preview').textContent = pending.text;
  const auto = kakao && kakao.canSend() && !pending.kakaoFailed;
  $('sendShare').textContent = auto ? '🟡 카톡 자동 전송' : '🟡 카톡으로 공유';
  const hint = pending.kakaoFailed ? '카톡 자동 전송에 실패했어요. 다른 방법으로 보내 주세요.' : (kakao ? kakao.whyNotAuto() : '');
  $('sendHint').textContent = hint;
  $('sendHint').hidden = !hint;
  $('sendDialog').showModal();
}

// 카카오가 연결돼 있으면 창 없이 바로 카톡 전송, 아니면 보내기 창
function compose(text, apply, type) {
  if (sending) return;
  pending = { text, apply, type, kakaoFailed: false };
  if (kakao && kakao.canSend()) {
    sendKakao();
  } else {
    openSendDialog();
  }
}

async function sendKakao() {
  sending = true;
  toast('카톡 보내는 중…');
  try {
    await kakao.send(pending.text, PARENTS_URL);
    commit('kakao');
    toast('부모님께 카톡 보냈어요 ✅');
  } catch (e) {
    // 실패하면 다른 방법(공유/문자/복사)으로 보낼 수 있게 창을 띄움
    toast(kakao.errorMessage(e));
    pending.kakaoFailed = true;
    openSendDialog();
  } finally {
    sending = false;
  }
}

function commit(kind) {
  if (!pending) return;
  pending.apply();
  state.history.unshift({ kind, text: pending.text, at: new Date().toISOString() });
  state.history = state.history.slice(0, HISTORY_LIMIT);
  save(STATE_KEY, state);
  publishToCloud(pending.type, pending.text);
  pending = null;
  $('sendDialog').close();
  render();
}

// 부모님 화면에 반영 (로그인했을 때만)
function publishToCloud(type, text) {
  if (!cloud || !cloud.currentUser()) return;
  cloud.publish({ status: state.status, outing: state.outing, type, text })
    .catch(() => toast('부모님 화면에 반영하지 못했어요'));
}

// 번호는 저장하지 않음: 문자 앱이 열리면 받는 사람은 직접 고름
function smsHref(text) {
  return `sms:?body=${encodeURIComponent(text)}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

$('sendSms').addEventListener('click', () => {
  const href = smsHref(pending.text);
  commit('sms');
  location.href = href;
});

$('sendShare').addEventListener('click', async () => {
  const text = pending.text;
  if (kakao && kakao.canSend() && !pending.kakaoFailed) {
    $('sendDialog').close();
    sendKakao();
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ text });
      commit('share');
    } catch (e) {
      if (e.name !== 'AbortError') toast('공유에 실패했어요');
    }
    return;
  }
  // 공유 기능이 없는 브라우저: 복사 후 카톡에 붙여넣기
  if (await copy(text)) {
    commit('share');
    toast('복사했어요. 카톡에 붙여넣어 주세요');
  } else {
    toast('복사에 실패했어요');
  }
});

$('copyMsg').addEventListener('click', async () => {
  if (await copy(pending.text)) {
    commit('copy');
    toast('복사했어요');
  } else {
    toast('복사에 실패했어요');
  }
});

$('cancelSend').addEventListener('click', () => {
  pending = null;
  $('sendDialog').close();
});

// ---------- 동작 ----------

$('leaveBtn').addEventListener('click', () => {
  const who = $('who').value.trim();
  const where = $('where').value.trim();
  const etaValue = $('eta').value;
  if (!etaValue) {
    toast('몇 시쯤 들어올지 정해주세요');
    $('eta').focus();
    return;
  }
  const eta = nextOccurrence(etaValue).toISOString();
  compose(leaveMessage({ who, where, eta }), () => {
    state.status = 'out';
    state.outing = { who, where, eta, leftAt: new Date().toISOString() };
    $('who').value = '';
    $('where').value = '';
    $('eta').value = '';
  }, 'leave');
});

let lateMinutes = null;

document.querySelectorAll('[data-late]').forEach((chip) => {
  chip.addEventListener('click', () => {
    lateMinutes = Number(chip.dataset.late);
    const base = Math.max(new Date(state.outing.eta).getTime(), Date.now());
    $('newEta').value = toHHMM(base + lateMinutes * 60000);
    document.querySelectorAll('[data-late]').forEach((c) => c.classList.toggle('selected', c === chip));
  });
});

$('newEta').addEventListener('input', () => {
  lateMinutes = null;
  document.querySelectorAll('[data-late]').forEach((c) => c.classList.remove('selected'));
});

$('lateBtn').addEventListener('click', () => {
  if (!$('newEta').value) {
    toast('얼마나 늦을지 골라주세요');
    return;
  }
  const oldEta = state.outing.eta;
  const newEta = nextOccurrence($('newEta').value).toISOString();
  const reason = $('lateReason').value.trim();
  compose(lateMessage({ oldEta, newEta, reason }), () => {
    state.outing.eta = newEta;
    $('newEta').value = '';
    $('lateReason').value = '';
    lateMinutes = null;
    document.querySelectorAll('[data-late]').forEach((c) => c.classList.remove('selected'));
  }, 'late');
});

$('homeBtn').addEventListener('click', () => {
  const at = new Date().toISOString();
  compose(homeMessage(at), () => {
    state.status = 'home';
    state.outing = null;
  }, 'home');
});

$('clearHistory').addEventListener('click', () => {
  if (!confirm('기록을 모두 지울까요?')) return;
  state.history = [];
  save(STATE_KEY, state);
  render();
});

// ---------- 설정 ----------

function openSettings() {
  $('myName').value = settings.myName;
  $('settingsDialog').showModal();
}

$('openSettings').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', () => $('settingsDialog').close());
$('saveSettings').addEventListener('click', () => {
  settings = {
    myName: $('myName').value.trim(),
  };
  save(SETTINGS_KEY, settings);
  $('settingsDialog').close();
  toast('저장했어요');
});

// ---------- 카카오톡 자동 전송 ----------

let kakao = null;

function renderKakao() {
  const on = !!kakao && kakao.enabled;
  $('kakaoSection').hidden = !on;
  if (!on) return;
  const connected = kakao.isConnected();
  $('kakaoConnect').hidden = connected;
  $('kakaoConnected').hidden = !connected;
  const names = kakao.getRecipients().map((r) => r.name).join(', ');
  $('kakaoRecipients').textContent = names || '아직 안 골랐어요';
}

async function pickKakaoRecipients() {
  const box = $('kakaoFriends');
  box.hidden = false;
  box.replaceChildren('불러오는 중…');
  let list;
  try {
    list = await kakao.friends();
  } catch (e) {
    box.replaceChildren(kakao.errorMessage(e));
    return;
  }
  if (list.length === 0) {
    box.replaceChildren('목록이 비어 있어요. 부모님이 부모님 화면에서 "카카오톡 연결"을 먼저 해 주셔야 해요.');
    return;
  }
  const chosen = new Set(kakao.getRecipients().map((r) => r.uuid));
  box.replaceChildren();
  for (const f of list) {
    const label = document.createElement('label');
    label.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = f.uuid;
    cb.dataset.name = f.name;
    cb.checked = chosen.has(f.uuid);
    label.append(cb, ` ${f.name}`);
    box.append(label);
  }
  const ok = document.createElement('button');
  ok.className = 'secondary';
  ok.textContent = '받는 사람 저장';
  ok.addEventListener('click', () => {
    const picked = [...box.querySelectorAll('input:checked')].map((c) => ({ uuid: c.value, name: c.dataset.name }));
    kakao.setRecipients(picked);
    box.hidden = true;
    renderKakao();
    toast('저장했어요');
  });
  box.append(ok);
}

$('kakaoLoginBtn').addEventListener('click', () => kakao.startLogin());
$('kakaoPickBtn').addEventListener('click', pickKakaoRecipients);
$('kakaoLogoutBtn').addEventListener('click', () => {
  kakao.disconnect();
  $('kakaoFriends').hidden = true;
  renderKakao();
});

const kakaoReady = import('./kakao.js')
  .then(async (m) => {
    kakao = m;
    if (!kakao.enabled) return;
    const result = await kakao.handleRedirect();
    renderKakao();
    if (result === 'ok') {
      toast('카카오톡 연결됐어요. 받는 사람을 골라주세요');
      openSettings();
      pickKakaoRecipients();
    } else if (result === 'denied') {
      toast('카카오 동의가 취소됐어요');
    } else if (result === 'error') {
      toast('카카오톡 연결에 실패했어요');
    }
  })
  .catch(() => {});

// 카카오 연결 정보를 서버와 맞춤: 어느 브라우저에서 연결했든 같이 쓰도록
async function syncKakao() {
  await kakaoReady.catch(() => {});
  if (!kakao || !kakao.enabled || !cloud) return;
  try {
    const remote = await cloud.loadKakao();
    const local = kakao.exportState();
    if (remote && (remote.updatedAt || 0) > (local.updatedAt || 0)) {
      kakao.importState(remote);
    } else if (local.updatedAt) {
      await cloud.saveKakao(local);
    }
  } catch {
    // 서버 규칙이 아직 없거나 오프라인이면 이 브라우저 정보만 사용
  }
  kakao.onChange((st) => cloud.saveKakao(st).catch(() => {}));
  renderKakao();
  // 서버와 맞춘 뒤에도 카톡 받는 사람이 없으면 설정을 열어서 안내
  if (!kakao.canSend() && !$('settingsDialog').open) openSettings();
}

// ---------- 로그인 (Firebase) ----------
// 아들 계정이면 이 화면, 부모님 계정이면 parents.html로 보냄

const ROLE_KEY = 'wims.role';
let cloud = null;

function showView(view) {
  $('loading').hidden = view !== 'loading';
  $('loginGate').hidden = view !== 'login';
  $('sonApp').hidden = view !== 'son';
  $('openSettings').hidden = view !== 'son';
}

function showSon() {
  showView('son');
  render();
}

function showLoginError(msg) {
  $('loginError').textContent = msg;
  $('loginError').hidden = !msg;
}

function setRole(role) {
  try {
    if (role) localStorage.setItem(ROLE_KEY, role);
    else localStorage.removeItem(ROLE_KEY);
  } catch {
    // 무시
  }
}

function getRole() {
  try {
    return localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

function onUser(user) {
  if (!user) {
    setRole(null);
    $('cloudUser').hidden = true;
    showView('login');
    return;
  }
  if (!cloud.isSon(user)) {
    setRole('parent');
    location.replace('parents.html');
    return;
  }
  setRole('son');
  syncKakao();
  $('cloudUserPhone').textContent = cloud.emailToPhone(user.email);
  $('cloudUser').hidden = false;
  showSon();
  // 현재 상태를 한 번 올려서 부모님 화면과 맞춰둠
  cloud.publish({ status: state.status, outing: state.outing }).catch(() => {});
}

import('./cloud.js')
  .then((m) => {
    cloud = m;
    if (!cloud.enabled) {
      showSon();
      return;
    }
    cloud.onUser(onUser);
  })
  .catch(() => {
    // 인터넷이 안 될 때: 아들 폰이면 문자/카톡은 계속 쓸 수 있게
    if (getRole() === 'son') {
      showSon();
    } else {
      showView('login');
      showLoginError('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요');
    }
  });

$('loginBtn').addEventListener('click', async () => {
  const phone = $('loginPhone').value;
  const pin = $('loginPin').value;
  showLoginError('');
  if (!phone || pin.length < 6) {
    showLoginError('전화번호와 6자리 PIN을 넣어주세요');
    return;
  }
  if (!cloud) return;
  try {
    await cloud.login(phone, pin);
    $('loginPin').value = '';
  } catch (e) {
    showLoginError(cloud.loginErrorMessage(e));
  }
});

$('logoutBtn').addEventListener('click', () => {
  $('settingsDialog').close();
  cloud.logout();
});

// ---------- 화면 ----------

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

const KIND_LABEL = { sms: '문자', kakao: '카톡', share: '카톡 공유', copy: '복사' };

function render() {
  const out = state.status === 'out' && state.outing;

  $('leavePanel').hidden = !!out;
  $('outPanel').hidden = !out;

  if (out) {
    const { who, where, eta, leftAt } = state.outing;
    $('statusEmoji').textContent = '🚶';
    $('statusLabel').textContent = '밖에 있어요';
    $('statusDetail').textContent = [
      who && `👥 ${who}`,
      where && `📍 ${where}`,
      `🕒 ${fmtTime(leftAt)} 나감 · 🏠 ${fmtTime(eta)} 귀가 예정`,
    ].filter(Boolean).join('\n');
  } else {
    $('statusEmoji').textContent = '🏠';
    $('statusLabel').textContent = '집에 있어요';
    $('statusDetail').textContent = '';
  }

  $('overdueBanner').hidden = !(out && new Date(state.outing.eta) < new Date());

  const list = $('history');
  list.replaceChildren();
  if (state.history.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '아직 기록이 없어요';
    list.append(li);
  }
  for (const item of state.history) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = `${fmtDateTime(item.at)} · ${KIND_LABEL[item.kind] || ''}`;
    const text = document.createElement('div');
    text.textContent = item.text.split('\n')[0];
    li.append(time, text);
    list.append(li);
  }
}

// 귀가 예정 시간이 지났는지 주기적으로 확인
setInterval(render, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

