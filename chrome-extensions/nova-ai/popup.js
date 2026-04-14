'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────
const DEFAULT_API = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:3b';

let apiEndpoint = DEFAULT_API;
let chatHistory = [];
let currentPageText = '';
let lastWritePrompt = '';

const apiInput = document.getElementById('apiEndpoint');

// Load saved settings
chrome.storage.local.get(['apiEndpoint', 'chatHistory'], (d) => {
  apiEndpoint = d.apiEndpoint || DEFAULT_API;
  apiInput.value = apiEndpoint;
  chatHistory = d.chatHistory || [];
  if (chatHistory.length > 0) restoreChatHistory();
});

apiInput.addEventListener('change', () => {
  apiEndpoint = apiInput.value.trim() || DEFAULT_API;
  chrome.storage.local.set({ apiEndpoint });
});

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  btn.classList.add('active');
}

// ─── Page Content Extraction ──────────────────────────────────────────────────
async function getPageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Get main content, avoiding nav/footer/ads
        const selectors = ['article', 'main', '[role="main"]', '.content', '#content', 'body'];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.innerText;
            if (text && text.length > 200) return text.slice(0, 6000);
          }
        }
        return document.body.innerText.slice(0, 6000);
      }
    });
    return result?.result || '';
  } catch (e) {
    return '';
  }
}

// ─── AI API Call ──────────────────────────────────────────────────────────────
async function callAI(prompt, systemPrompt = '') {
  const base = apiEndpoint.replace(/\/$/, '');
  const isOllama = base.includes('11434') || base.includes('ollama');

  if (isOllama) {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: DEFAULT_MODEL, prompt: fullPrompt, stream: false }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.response || 'No response';
  } else {
    // OpenAI-compatible
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const key = await getStoredKey();
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'gpt-3.5-turbo', messages, max_tokens: 1000 }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }
}

async function getStoredKey() {
  return new Promise(resolve => chrome.storage.local.get(['apiKey'], d => resolve(d.apiKey || '')));
}

// ─── Summarize Tab ────────────────────────────────────────────────────────────
const PROMPTS = {
  summarize: 'Summarize the following webpage content in 3-4 clear paragraphs. Focus on the main points:\n\n',
  keypoints: 'Extract the 5-7 most important key points from the following content as a bulleted list:\n\n',
  tldr: 'Give a TL;DR (too long; didn\'t read) summary in 2-3 sentences of:\n\n',
  explain: 'Explain the following content as if speaking to a curious 16-year-old. Use simple language:\n\n'
};

async function runPageAction(action) {
  const output = document.getElementById('summarizeOutput');
  output.className = 'output-box loading';
  output.innerHTML = '<div class="mini-spinner"></div> Reading page and thinking...';
  document.getElementById('outputActions').style.display = 'none';

  try {
    const pageText = await getPageContent();
    if (!pageText || pageText.length < 100) {
      output.className = 'output-box';
      output.textContent = 'Could not read this page. Try on a regular article or blog post.';
      return;
    }
    currentPageText = pageText;
    const prompt = PROMPTS[action] + pageText;
    const result = await callAI(prompt);
    output.className = 'output-box';
    output.textContent = result;
    document.getElementById('outputActions').style.display = 'flex';
  } catch (e) {
    output.className = 'output-box';
    output.textContent = `Error: ${e.message}.\n\nMake sure Ollama is running at ${apiEndpoint} or configure an OpenAI-compatible endpoint below.`;
  }
}

function copyOutput() {
  const text = document.getElementById('summarizeOutput').textContent;
  navigator.clipboard.writeText(text);
}

function clearOutput() {
  document.getElementById('summarizeOutput').textContent = 'Click an action above to analyze the current page content.';
  document.getElementById('outputActions').style.display = 'none';
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────
function restoreChatHistory() {
  const container = document.getElementById('chatMessages');
  chatHistory.slice(-10).forEach(msg => {
    addMessageToUI(msg.role, msg.content);
  });
}

function addMessageToUI(role, content) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  sendBtn.disabled = true;

  addMessageToUI('user', text);
  chatHistory.push({ role: 'user', content: text });

  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'msg assistant thinking';
  thinkingDiv.innerHTML = '<div class="mini-spinner"></div> Thinking...';
  document.getElementById('chatMessages').appendChild(thinkingDiv);
  document.getElementById('chatMessages').scrollTop = 999999;

  try {
    // Build context with page content if available
    const pageCtx = currentPageText
      ? `Context (current webpage): ${currentPageText.slice(0, 2000)}\n\n`
      : '';
    const systemPrompt = `You are NovaAI, a helpful AI assistant integrated into the Chrome browser. Be concise and helpful. ${pageCtx}`;

    // Build conversation for context
    const historyContext = chatHistory.slice(-6).map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const prompt = `${historyContext}\nAssistant:`;
    const result = await callAI(prompt, systemPrompt);

    thinkingDiv.remove();
    addMessageToUI('assistant', result);
    chatHistory.push({ role: 'assistant', content: result });
    chrome.storage.local.set({ chatHistory: chatHistory.slice(-20) });
  } catch (e) {
    thinkingDiv.remove();
    addMessageToUI('assistant', `Error: ${e.message}. Make sure Ollama is running or configure your API endpoint.`);
  }

  sendBtn.disabled = false;
  input.focus();
}

document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

// ─── Translate Tab ────────────────────────────────────────────────────────────
async function doTranslate() {
  const text = document.getElementById('translateInput').value.trim();
  const from = document.getElementById('fromLang').value;
  const to = document.getElementById('toLang').value;
  const output = document.getElementById('translateOutput');

  if (!text) { output.textContent = 'Enter text to translate.'; return; }

  output.className = 'output-box loading';
  output.innerHTML = '<div class="mini-spinner"></div> Translating...';

  try {
    // Try LibreTranslate (free, open source)
    const langFrom = from === 'auto' ? 'auto' : from;
    const res = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: langFrom, target: to, format: 'text' }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      output.className = 'output-box';
      output.textContent = data.translatedText || 'No result';
    } else {
      throw new Error('Translation API unavailable');
    }
  } catch (e) {
    // Fallback: use AI
    try {
      const fromName = from === 'auto' ? 'the detected language' : LANG_NAMES[from] || from;
      const toName = LANG_NAMES[to] || to;
      const prompt = `Translate the following text from ${fromName} to ${toName}. Only return the translated text, nothing else:\n\n${text}`;
      const result = await callAI(prompt);
      output.className = 'output-box';
      output.textContent = result;
    } catch (e2) {
      output.className = 'output-box';
      output.textContent = `Translation failed: ${e2.message}`;
    }
  }
}

const LANG_NAMES = {
  en:'English', es:'Spanish', fr:'French', de:'German', it:'Italian',
  pt:'Portuguese', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean',
  ar:'Arabic', hi:'Hindi', nl:'Dutch', pl:'Polish', tr:'Turkish'
};

function swapLangs() {
  const from = document.getElementById('fromLang');
  const to = document.getElementById('toLang');
  const tmp = from.value;
  from.value = to.value === 'auto' ? 'en' : to.value;
  to.value = tmp === 'auto' ? 'en' : tmp;
  // Also swap text
  const inEl = document.getElementById('translateInput');
  const outEl = document.getElementById('translateOutput');
  const outText = outEl.textContent;
  if (outText && outText !== 'Translation will appear here') {
    inEl.value = outText;
    outEl.textContent = 'Translation will appear here';
  }
}

async function getPageTranslation() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });
    const selected = result?.result || '';
    if (selected.trim()) {
      document.getElementById('translateInput').value = selected;
      doTranslate();
    } else {
      document.getElementById('translateOutput').textContent = 'Select text on the page first, then click this button.';
    }
  } catch (e) {
    document.getElementById('translateOutput').textContent = 'Cannot access this page.';
  }
}

// ─── Write Tab ────────────────────────────────────────────────────────────────
const TEMPLATES = {
  email: 'Write a professional email about: ',
  linkedin: 'Write an engaging LinkedIn post about: ',
  tweet: 'Write a Twitter thread (5 tweets) about: ',
  blog: 'Write a compelling blog post introduction about: ',
  cover: 'Write a cover letter for a job application as a: ',
  summary: 'Write an executive summary report about: '
};

function useTemplate(type) {
  document.getElementById('writePrompt').value = TEMPLATES[type];
  document.getElementById('writePrompt').focus();
}

async function generateWrite() {
  const prompt = document.getElementById('writePrompt').value.trim();
  if (!prompt) return;
  lastWritePrompt = prompt;

  const output = document.getElementById('writeOutput');
  output.className = 'output-box loading';
  output.innerHTML = '<div class="mini-spinner"></div> Writing with AI...';
  document.getElementById('writeActions').style.display = 'none';

  try {
    const result = await callAI(prompt, 'You are an expert writer. Write clear, engaging, professional content. Be concise yet thorough.');
    output.className = 'output-box';
    output.textContent = result;
    document.getElementById('writeActions').style.display = 'flex';
  } catch (e) {
    output.className = 'output-box';
    output.textContent = `Error: ${e.message}`;
  }
}

function copyWrite() {
  navigator.clipboard.writeText(document.getElementById('writeOutput').textContent);
}

function regenerateWrite() {
  if (lastWritePrompt) generateWrite();
}
