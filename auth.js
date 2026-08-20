(function () {
// ---------------------------------------------------------------------------
// Gate de acceso por clave, compartido por las dos pestañas (Kadora y
// Competencia). Va cargado ANTES de script.js y script-competencia.js: esos
// dos archivos exponen su DATA_URL en window (KADORA_DATA_URL /
// KADORA_COMP_DATA_URL) nada más arrancar, y esperan a un evento
// 'kadora-auth-ready' antes de pedir datos, para no disparar ningún fetch
// hasta que haya una clave válida.
//
// Contrato con doGet() en los dos Apps Script (Kadora y Competencia): la
// clave viaja como parámetro ?key= en la misma URL del feed. doGet() debe
// devolver, si la clave es válida, { data: [...], scope: 'all'|'<Residencia>',
// scopeLabel: '<Nombre a mostrar>' } — filtrando "data" a esa residencia si
// scope no es 'all'. Si la clave no es válida, { error: 'invalid_key' } (sin
// campo "data"). Las claves deben ser IDÉNTICAS en los dos scripts.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'kadoraAuthSession';

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session && session.key ? session : null;
  } catch (err) {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

window.KadoraAuth = {
  session: readSession(),
  logout,
};

const overlay = document.getElementById('authOverlay');
const form = document.getElementById('authForm');
const input = document.getElementById('authKeyInput');
const errorEl = document.getElementById('authError');
const submitBtn = document.getElementById('authSubmitBtn');
const badge = document.getElementById('accessBadge');
const badgeLabel = document.getElementById('accessLabel');
const logoutBtn = document.getElementById('logoutBtn');
const toggleVisibilityBtn = document.getElementById('authToggleVisibility');
const eyeIcon = document.getElementById('authEyeIcon');

const EYE_OPEN = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path><circle cx="12" cy="12" r="3"></circle>';
const EYE_CLOSED = '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.6 20.6 0 0 1 5.06-6.06M9.9 4.24A9.7 9.7 0 0 1 12 4c7 0 11 8 11 8a20.5 20.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';

toggleVisibilityBtn.addEventListener('click', () => {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  eyeIcon.innerHTML = isPassword ? EYE_CLOSED : EYE_OPEN;
  toggleVisibilityBtn.setAttribute('aria-pressed', String(isPassword));
  toggleVisibilityBtn.setAttribute('aria-label', isPassword ? 'Ocultar clave' : 'Mostrar clave');
  input.focus();
});

function showAccessBadge() {
  if (!window.KadoraAuth.session) return;
  badgeLabel.textContent = 'Acceso: ' + window.KadoraAuth.session.label;
  badge.hidden = false;
}

function unlockApp() {
  document.body.classList.remove('auth-locked');
  showAccessBadge();
}

async function verifyKey(key) {
  // Se comprueba contra el endpoint de Kadora; Mario mantiene las mismas 6
  // claves sincronizadas en los dos Apps Script, así que si es válida aquí
  // también lo será en el de Competencia.
  const url = window.KADORA_DATA_URL + '?key=' + encodeURIComponent(key);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json || json.error) return null;
  return { key, scope: json.scope || 'all', label: json.scopeLabel || json.scope || 'Corporativo' };
}

if (window.KadoraAuth.session) {
  unlockApp();
} else {
  document.body.classList.add('auth-locked');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = input.value.trim();
  if (!key) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Comprobando…';
  errorEl.hidden = true;

  try {
    const access = await verifyKey(key);
    if (!access) {
      errorEl.textContent = 'Clave incorrecta. Comprueba que la has copiado bien.';
      errorEl.hidden = false;
      return;
    }
    writeSession(access);
    window.KadoraAuth.session = access;
    unlockApp();
    window.dispatchEvent(new Event('kadora-auth-ready'));
  } catch (err) {
    console.error(err);
    errorEl.textContent = 'No se ha podido comprobar la clave. Revisa tu conexión e inténtalo de nuevo.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }
});

logoutBtn.addEventListener('click', logout);

})();
