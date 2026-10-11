// 카카오톡 "친구에게 메시지 보내기"로 부모님께 자동 전송
// - 아들: 카카오 로그인 → 받는 사람(부모님) 고르기 → 버튼 누르면 바로 전송
// - 부모님: 카카오 로그인을 한 번 해서 앱에 연결해야 아들의 친구 목록에 나타나요
import { KAKAO_JS_KEY, KAKAO_REST_KEY } from './kakao-config.js';

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
const TOKEN_KEY = 'wims.kakao.token';
const RECIPIENTS_KEY = 'wims.kakao.recipients';
const STATE = 'wims-kakao';
const SCOPES = 'talk_message,friends';

export const enabled = !!(KAKAO_JS_KEY && KAKAO_REST_KEY);

// ---------- 저장 ----------

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 무시
  }
}

// ---------- 로그인 ----------

// 카카오 개발자 콘솔에 등록한 Redirect URI와 정확히 같아야 함
function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

export function startLogin() {
  const params = new URLSearchParams({
    client_id: KAKAO_REST_KEY,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state: STATE,
  });
  location.href = `https://kauth.kakao.com/oauth/authorize?${params}`;
}

async function tokenRequest(params) {
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({ client_id: KAKAO_REST_KEY, ...params }),
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

function saveToken(json) {
  const old = read(TOKEN_KEY, {});
  write(TOKEN_KEY, {
    access_token: json.access_token,
    expires_at: Date.now() + json.expires_in * 1000,
    // 갱신할 때는 refresh_token이 안 올 수도 있어서 기존 값 유지
    refresh_token: json.refresh_token || old.refresh_token,
  });
}

// 카카오 로그인에서 돌아왔으면 토큰을 받아 저장. 결과: null | 'ok' | 'denied' | 'error'
export async function handleRedirect() {
  const url = new URL(location.href);
  if (url.searchParams.get('state') !== STATE) return null;
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  history.replaceState(null, '', location.pathname); // 주소창에서 code 지우기
  if (error) return 'denied';
  if (!code) return 'error';
  try {
    saveToken(await tokenRequest({
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
      code,
    }));
    return 'ok';
  } catch {
    return 'error';
  }
}

export function isConnected() {
  return !!read(TOKEN_KEY, null);
}

export function disconnect() {
  write(TOKEN_KEY, null);
  write(RECIPIENTS_KEY, null);
}

async function accessToken() {
  const t = read(TOKEN_KEY, null);
  if (!t) return null;
  if (Date.now() < t.expires_at - 60000) return t.access_token;
  if (!t.refresh_token) return null;
  try {
    const json = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
    saveToken(json);
    return json.access_token;
  } catch {
    // 갱신 토큰도 만료됨 → 다시 로그인해야 함
    write(TOKEN_KEY, null);
    return null;
  }
}

// ---------- API ----------

let sdkPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const done = () => {
        if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
        resolve(window.Kakao);
      };
      if (window.Kakao) {
        done();
        return;
      }
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = done;
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error('sdk-load-failed'));
      };
      document.head.append(s);
    });
  }
  return sdkPromise;
}

async function api(url, data) {
  const Kakao = await loadSdk();
  const token = await accessToken();
  if (!token) throw { code: 'not-connected' };
  Kakao.Auth.setAccessToken(token);
  return Kakao.API.request({ url, data });
}

// 앱에 연결한 카톡 친구 목록 (부모님도 카카오 로그인을 한 번 해야 보여요)
export async function friends() {
  const res = await api('/v1/api/talk/friends', { limit: 100 });
  return (res.elements || []).map((f) => ({ uuid: f.uuid, name: f.profile_nickname }));
}

export function getRecipients() {
  return read(RECIPIENTS_KEY, []);
}

export function setRecipients(list) {
  write(RECIPIENTS_KEY, list.slice(0, 5)); // 한 번에 최대 5명
}

export function canSend() {
  return enabled && isConnected() && getRecipients().length > 0;
}

export async function send(text, link) {
  const recipients = getRecipients();
  if (recipients.length === 0) throw { code: 'no-recipients' };
  const res = await api('/v1/api/talk/friends/message/default/send', {
    receiver_uuids: recipients.map((r) => r.uuid),
    template_object: {
      object_type: 'text',
      text,
      link: { web_url: link, mobile_web_url: link },
      button_title: '아들 어디야',
    },
  });
  if (res.failure_info && res.failure_info.length) throw { code: 'partial', res };
  return res;
}

export function errorMessage(e) {
  const code = e && e.code;
  if (code === 'not-connected') return '카카오톡 연결이 끊겼어요. 설정에서 다시 연결해 주세요';
  if (code === 'no-recipients') return '설정에서 카톡 받을 사람을 골라주세요';
  if (code === 'partial') return '일부에게는 카톡을 보내지 못했어요';
  if (code === -402 || code === -403) return '카카오 동의가 필요해요. 설정에서 다시 연결해 주세요';
  if (e && e.message === 'sdk-load-failed') return '인터넷 연결을 확인해 주세요';
  return '카톡을 보내지 못했어요';
}
