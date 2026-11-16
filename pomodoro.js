// ============================================================
//  pomodoro.js — таймер помодоро со звуком и автопереходом
//  Фокус → Отдых → Фокус → ... (после 4 фокусов — длинный отдых)
//  Звуки генерируются кодом (Web Audio API) — mp3-файлы не нужны.
// ============================================================

const Pomodoro = (() => {
  // ---------- НАСТРОЙКИ (сохраняются в localStorage) ----------
  const DEFAULTS = {
    focus: 25,          // минут фокуса
    shortBreak: 5,      // короткий отдых
    longBreak: 15,      // длинный отдых
    longEvery: 4,       // длинный отдых после каждых N фокусов
    autoStart: true,    // автопереход к следующему этапу
    sound: true,        // звук вкл/выкл
    volume: 0.6,        // громкость 0..1
    notify: true,       // браузерные уведомления
  };

  let settings = { ...DEFAULTS };
  try {
    settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("pomo-settings") || "{}") };
  } catch (e) {}

  function saveSettings(patch) {
    settings = { ...settings, ...patch };
    try { localStorage.setItem("pomo-settings", JSON.stringify(settings)); } catch (e) {}
    if (!running) { remaining = durationOf(mode); emit(); }
  }

  // ---------- СОСТОЯНИЕ ----------
  let mode = "focus";        // "focus" | "shortBreak" | "longBreak"
  let completedFocus = 0;    // сколько фокусов завершено
  let running = false;
  let endAt = 0;             // время окончания (timestamp) — так таймер не "отстаёт" в фоновой вкладке
  let remaining = durationOf(mode); // секунд осталось
  let tickId = null;
  const listeners = [];

  function durationOf(m) { return settings[m] * 60; }

  // ---------- ЗВУКИ ----------
  let audioCtx = null;
  function unlockAudio() {
    // Браузеры не дают играть звук до первого клика — "разблокируем" при нажатии Старт
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, start, length) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = audioCtx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(settings.volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + length);
  }

  const SOUNDS = {
    start:     () => { beep(660, 0, 0.15); beep(880, 0.15, 0.25); },                      // короткий "старт"
    focusEnd:  () => { [0, 0.35, 0.7].forEach(s => { beep(880, s, 0.3); beep(1320, s + 0.12, 0.3); }); }, // "пора отдыхать"
    breakEnd:  () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.18, 0.35)); },  // "пора работать"
  };

  function play(name) {
    if (!settings.sound || !audioCtx) return;
    SOUNDS[name]();
  }

  // ---------- УВЕДОМЛЕНИЯ ----------
  function askNotifyPermission() {
    if (settings.notify && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
  function notify(text) {
    if (settings.notify && "Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("StudentPP", { body: text, icon: "/favicon.ico" });
    }
  }

  // ---------- ЛОГИКА ТАЙМЕРА ----------
  function start() {
    if (running) return;
    unlockAudio();
    askNotifyPermission();
    running = true;
    endAt = Date.now() + remaining * 1000;
    play("start");
    tickId = setInterval(tick, 250);
    emit();
  }

  function pause() {
    if (!running) return;
    running = false;
    clearInterval(tickId);
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    emit();
  }

  function reset() {
    pause();
    remaining = durationOf(mode);
    emit();
  }

  function skip() { finish(false); }

  function tick() {
    remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (remaining <= 0) finish(true);
    else emit();
  }

  function nextMode() {
    if (mode === "focus") {
      completedFocus++;
      return completedFocus % settings.longEvery === 0 ? "longBreak" : "shortBreak";
    }
    return "focus";
  }

  function finish(withSound) {
    const wasFocus = mode === "focus";
    running = false;
    clearInterval(tickId);

    if (withSound) {
      play(wasFocus ? "focusEnd" : "breakEnd");
      notify(wasFocus ? "Фокус завершён — время отдохнуть ☕" : "Отдых окончен — снова за работу 📚");
    }

    mode = nextMode();
    remaining = durationOf(mode);
    emit();

    // АВТОПЕРЕХОД: ждём 2 сек (чтобы звук доиграл), затем запускаем следующий этап
    if (settings.autoStart) {
      setTimeout(() => { if (!running) start(); }, 2000);
    }
  }

  function setMode(m) { pause(); mode = m; remaining = durationOf(m); emit(); }

  // ---------- ПОДПИСКА НА ОБНОВЛЕНИЯ (для отрисовки UI) ----------
  function onChange(fn) { listeners.push(fn); fn(getState()); }
  function getState() {
    return { mode, remaining, running, completedFocus, settings: { ...settings } };
  }
  function emit() { const s = getState(); listeners.forEach(fn => fn(s)); }

  return { start, pause, reset, skip, setMode, saveSettings, onChange, getState };
})();
