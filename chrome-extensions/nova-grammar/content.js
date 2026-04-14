'use strict';
// NovaGrammar content script
// Adds context menu grammar check and underline highlighting

const API_URL = 'https://api.languagetool.org/v2/check';

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getSelectedText') {
    sendResponse({ text: window.getSelection().toString() });
  }
  if (msg.action === 'highlightErrors') {
    highlightInActiveElement(msg.matches);
  }
  return true;
});

function highlightInActiveElement(matches) {
  const el = document.activeElement;
  if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT')) return;
  // For now just show a badge count near the element
  const existing = document.getElementById('nova-grammar-badge');
  if (existing) existing.remove();

  if (matches.length === 0) return;
  const rect = el.getBoundingClientRect();
  const badge = document.createElement('div');
  badge.id = 'nova-grammar-badge';
  badge.style.cssText = `
    position: fixed;
    top: ${rect.top - 24 + window.scrollY}px;
    right: ${window.innerWidth - rect.right}px;
    background: #ef4444;
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 20px;
    z-index: 999999;
    pointer-events: none;
    font-family: system-ui, sans-serif;
  `;
  badge.textContent = `${matches.length} issue${matches.length !== 1 ? 's' : ''}`;
  document.body.appendChild(badge);

  setTimeout(() => badge.remove(), 4000);
}
