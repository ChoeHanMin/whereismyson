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
let settings = load(SETTINGS_KEY, { momPhone: '', momName: '엄마', myName: '' });

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
  return settings.momName || '엄마';
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

let pending = null; // { text, apply }

function compose(text, apply) {
  pending = { text, apply };
  $('preview').textContent = text;
  $('sendDialog').showModal();
}

function commit(kind) {
  if (!pending) return;
  pending.apply();
  state.history.unshift({ kind, text: pending.text, at: new Date().toISOString() });
  state.history = state.history.slice(0, HISTORY_LIMIT);
  save(STATE_KEY, state);
  pending = null;
  $('sendDialog').close();
  render();
}

function smsHref(text) {
  const phone = settings.momPhone.replace(/[^0-9+]/g, '');
  return `sms:${phone}?body=${encodeURIComponent(text)}`;
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
  if (!settings.momPhone) {
    toast('설정에서 어머니 번호를 먼저 넣어주세요');
    $('sendDialog').close();
    openSettings();
    return;
  }
  const href = smsHref(pending.text);
  commit('sms');
  location.href = href;
});

$('sendShare').addEventListener('click', async () => {
  const text = pending.text;
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
  });
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
  });
});

$('homeBtn').addEventListener('click', () => {
  const at = new Date().toISOString();
  compose(homeMessage(at), () => {
    state.status = 'home';
    state.outing = null;
  });
});

$('clearHistory').addEventListener('click', () => {
  if (!confirm('기록을 모두 지울까요?')) return;
  state.history = [];
  save(STATE_KEY, state);
  render();
});

// ---------- 설정 ----------

function openSettings() {
  $('momPhone').value = settings.momPhone;
  $('momName').value = settings.momName;
  $('myName').value = settings.myName;
  $('settingsDialog').showModal();
}

$('openSettings').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', () => $('settingsDialog').close());
$('saveSettings').addEventListener('click', () => {
  settings = {
    momPhone: $('momPhone').value.trim(),
    momName: $('momName').value.trim() || '엄마',
    myName: $('myName').value.trim(),
  };
  save(SETTINGS_KEY, settings);
  $('settingsDialog').close();
  toast('저장했어요');
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

const KIND_LABEL = { sms: '문자', share: '카톡', copy: '복사' };

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

render();
if (!settings.momPhone) openSettings();
