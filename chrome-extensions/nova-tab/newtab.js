'use strict';

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  const use12 = true;
  let displayH = h;
  let ampm = '';
  if (use12) {
    ampm = h >= 12 ? ' PM' : ' AM';
    displayH = h % 12 || 12;
  }
  document.getElementById('clock').textContent = `${displayH}:${m}`;

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('date').textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;

  const greeting = document.getElementById('greeting');
  if (h < 12) greeting.textContent = 'Good morning ☀️';
  else if (h < 17) greeting.textContent = 'Good afternoon 🌤️';
  else greeting.textContent = 'Good evening 🌙';
}
setInterval(updateClock, 1000);
updateClock();

// ─── Animated Background ──────────────────────────────────────────────────────
(function() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      a: Math.random()
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // gradient bg
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // stars
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x * w/1920, p.y * h/1080, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(Date.now()/2000 + p.a * 10) * 0.2})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ─── Weather ──────────────────────────────────────────────────────────────────
const WMO_CODES = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Rain showers',81:'Heavy showers',82:'Violent showers',
  95:'Thunderstorm',96:'Hail storm',99:'Heavy hail storm'
};
const WMO_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌧️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',
  71:'❄️',73:'🌨️',75:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};

function loadWeather() {
  if (!navigator.geolocation) {
    document.getElementById('weatherDesc').textContent = 'Location not available';
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&windspeed_unit=mph`;
      const res = await fetch(url);
      const data = await res.json();
      const cw = data.current_weather;
      const code = cw.weathercode;
      document.getElementById('weatherIcon').textContent = WMO_ICONS[code] || '🌡️';
      document.getElementById('weatherTemp').textContent = `${Math.round(cw.temperature)}°C`;
      document.getElementById('weatherDesc').textContent = WMO_CODES[code] || 'Unknown';
      // Reverse geocode for city name
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const geoData = await geoRes.json();
      const city = geoData.address?.city || geoData.address?.town || geoData.address?.village || 'Your Location';
      document.getElementById('weatherLocation').textContent = `📍 ${city}`;
    } catch (e) {
      document.getElementById('weatherDesc').textContent = 'Weather unavailable';
    }
  }, () => {
    document.getElementById('weatherDesc').textContent = 'Allow location for weather';
  }, { timeout: 5000 });
}
loadWeather();

// ─── Focus Input ──────────────────────────────────────────────────────────────
const focusInput = document.getElementById('focusInput');
chrome.storage.local.get(['focusGoal'], d => {
  if (d.focusGoal) focusInput.value = d.focusGoal;
});
focusInput.addEventListener('input', () => {
  chrome.storage.local.set({ focusGoal: focusInput.value });
});

// ─── Pomodoro Timer ───────────────────────────────────────────────────────────
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let timerModeMinutes = 25;

function setTimerMode(btn, minutes) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  timerModeMinutes = minutes;
  timerSeconds = minutes * 60;
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timerStartBtn').textContent = 'Start';
  updateTimerDisplay();
}

function toggleTimer() {
  const btn = document.getElementById('timerStartBtn');
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    btn.textContent = 'Resume';
  } else {
    timerRunning = true;
    btn.textContent = 'Pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        btn.textContent = 'Start';
        timerSeconds = 0;
        updateTimerDisplay();
        // Notify
        new Notification('NovaTab Timer', {
          body: `${timerModeMinutes} minute session complete! Take a break.`,
          icon: 'icons/icon48.png'
        });
        return;
      }
      updateTimerDisplay();
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerModeMinutes * 60;
  document.getElementById('timerStartBtn').textContent = 'Start';
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

// ─── Quotes ───────────────────────────────────────────────────────────────────
const QUOTES = [
  { q: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
  { q: 'It does not matter how slowly you go as long as you do not stop.', a: 'Confucius' },
  { q: 'Everything you can imagine is real.', a: 'Pablo Picasso' },
  { q: 'The best time to plant a tree was 20 years ago. The second best time is now.', a: 'Chinese Proverb' },
  { q: 'Whether you think you can or think you cannot, you are right.', a: 'Henry Ford' },
  { q: 'Strive not to be a success, but rather to be of value.', a: 'Albert Einstein' },
  { q: 'In the middle of every difficulty lies opportunity.', a: 'Albert Einstein' },
  { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
  { q: 'Life is what happens to you while you\'re busy making other plans.', a: 'John Lennon' },
  { q: 'You miss 100% of the shots you don\'t take.', a: 'Wayne Gretzky' },
  { q: 'The future belongs to those who believe in the beauty of their dreams.', a: 'Eleanor Roosevelt' },
  { q: 'Spread love everywhere you go. Let no one ever come to you without leaving happier.', a: 'Mother Teresa' },
  { q: 'When you reach the end of your rope, tie a knot in it and hang on.', a: 'Franklin D. Roosevelt' },
  { q: 'Always remember that you are absolutely unique. Just like everyone else.', a: 'Margaret Mead' },
  { q: 'Do not go where the path may lead, go instead where there is no path and leave a trail.', a: 'Ralph Waldo Emerson' },
];

let quoteIdx = Math.floor(Math.random() * QUOTES.length);

function showQuote(idx) {
  const q = QUOTES[idx];
  document.getElementById('quoteText').textContent = `"${q.q}"`;
  document.getElementById('quoteAuthor').textContent = `— ${q.a}`;
}

function nextQuote() {
  quoteIdx = (quoteIdx + 1) % QUOTES.length;
  showQuote(quoteIdx);
  chrome.storage.local.set({ quoteIdx });
}

chrome.storage.local.get(['quoteIdx'], d => {
  if (d.quoteIdx !== undefined) quoteIdx = d.quoteIdx;
  showQuote(quoteIdx);
});

// ─── Todo List ────────────────────────────────────────────────────────────────
let todos = [];

function saveTodos() {
  chrome.storage.local.set({ todos });
}

function renderTodos() {
  const list = document.getElementById('todoList');
  list.innerHTML = '';
  todos.forEach((todo, i) => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.done ? 'done' : ''}`;
    const id = `todo-${i}`;
    li.innerHTML = `
      <input type="checkbox" id="${id}" ${todo.done ? 'checked' : ''}>
      <label for="${id}">${escapeHtml(todo.text)}</label>
      <button class="todo-del" data-i="${i}" title="Delete">✕</button>
    `;
    li.querySelector('input').addEventListener('change', (e) => {
      todos[i].done = e.target.checked;
      saveTodos();
      renderTodos();
    });
    li.querySelector('.todo-del').addEventListener('click', () => {
      todos.splice(i, 1);
      saveTodos();
      renderTodos();
    });
    list.appendChild(li);
  });
}

function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();
  if (!text) return;
  todos.unshift({ text, done: false });
  input.value = '';
  saveTodos();
  renderTodos();
}

document.getElementById('todoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo();
});

chrome.storage.local.get(['todos'], d => {
  todos = d.todos || [];
  renderTodos();
});

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
