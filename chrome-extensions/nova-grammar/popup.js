'use strict';

const API_URL = 'https://api.languagetool.org/v2/check';
let currentMatches = [];
let originalText = '';

const inputText = document.getElementById('inputText');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const pageCheckBtn = document.getElementById('pageCheckBtn');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('statusText');
const results = document.getElementById('results');
const statsBar = document.getElementById('statsBar');
const errCount = document.getElementById('errCount');
const styleCount = document.getElementById('styleCount');
const wordCount = document.getElementById('wordCount');

async function checkGrammar(text) {
  if (!text.trim()) {
    setStatus('Please enter some text first.');
    return;
  }

  setLoading(true);
  setStatus('Checking...');
  results.innerHTML = '';
  statsBar.style.display = 'none';

  try {
    const params = new URLSearchParams({
      text: text,
      language: 'en-US',
      enabledOnly: 'false'
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    currentMatches = data.matches || [];
    originalText = text;
    displayResults(currentMatches, text);
  } catch (err) {
    setStatus('Error: Could not connect to grammar API. Check internet connection.');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

function displayResults(matches, text) {
  const errors = matches.filter(m => m.rule.category.id !== 'STYLE' && m.rule.category.id !== 'PUNCTUATION');
  const styles = matches.filter(m => m.rule.category.id === 'STYLE' || m.rule.category.id === 'PUNCTUATION');
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  errCount.textContent = `${errors.length} error${errors.length !== 1 ? 's' : ''}`;
  styleCount.textContent = `${styles.length} style`;
  wordCount.textContent = `${words} words`;
  statsBar.style.display = 'flex';

  if (matches.length === 0) {
    results.innerHTML = `
      <div class="no-errors">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        No errors found! Your text looks great.
      </div>`;
    setStatus('All clear — no grammar issues detected.');
    return;
  }

  setStatus(`Found ${matches.length} issue${matches.length !== 1 ? 's' : ''}`);
  results.innerHTML = '';

  matches.forEach((match, idx) => {
    const categoryId = match.rule.category.id;
    let typeClass = '';
    if (categoryId === 'STYLE') typeClass = 'rule-style';
    else if (categoryId === 'PUNCTUATION') typeClass = 'rule-punctuation';

    const ctx = match.context;
    const before = escapeHtml(ctx.text.slice(0, ctx.offset));
    const error = escapeHtml(ctx.text.slice(ctx.offset, ctx.offset + ctx.length));
    const after = escapeHtml(ctx.text.slice(ctx.offset + ctx.length));

    const topSuggestions = (match.replacements || []).slice(0, 4);
    const suggestionsHtml = topSuggestions.map(s =>
      `<span class="suggestion-chip" data-idx="${idx}" data-value="${escapeHtml(s.value)}">${escapeHtml(s.value)}</span>`
    ).join('');

    const item = document.createElement('div');
    item.className = `error-item ${typeClass}`;
    item.innerHTML = `
      <div class="error-context">...${before}<mark>${error}</mark>${after}...</div>
      <div class="error-message">${escapeHtml(match.message)}</div>
      ${suggestionsHtml ? `<div class="suggestions">${suggestionsHtml}</div>` : ''}
    `;
    results.appendChild(item);
  });

  // Suggestion chips apply fix to textarea
  results.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = parseInt(chip.dataset.idx);
      const value = chip.dataset.value;
      applyFix(idx, value);
    });
  });
}

function applyFix(matchIdx, replacement) {
  const match = currentMatches[matchIdx];
  if (!match) return;
  const text = inputText.value;
  const newText = text.slice(0, match.offset) + replacement + text.slice(match.offset + match.length);
  inputText.value = newText;
  // Re-check after fix
  checkGrammar(newText);
}

function setLoading(loading) {
  spinner.style.display = loading ? 'block' : 'none';
  checkBtn.disabled = loading;
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

checkBtn.addEventListener('click', () => checkGrammar(inputText.value));

clearBtn.addEventListener('click', () => {
  inputText.value = '';
  results.innerHTML = '';
  statsBar.style.display = 'none';
  setStatus('Enter text above to get started');
  currentMatches = [];
});

pageCheckBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });
    const selected = result?.result || '';
    if (selected.trim()) {
      inputText.value = selected;
      checkGrammar(selected);
    } else {
      setStatus('No text selected on the page. Select some text first.');
    }
  } catch (e) {
    setStatus('Cannot access this page. Try on a regular website.');
  }
});

// Auto-check on paste
inputText.addEventListener('paste', () => {
  setTimeout(() => {
    if (inputText.value.length > 20) checkGrammar(inputText.value);
  }, 100);
});

// Load saved text
chrome.storage.local.get(['savedText'], (data) => {
  if (data.savedText) inputText.value = data.savedText;
});
inputText.addEventListener('input', () => {
  chrome.storage.local.set({ savedText: inputText.value });
});
