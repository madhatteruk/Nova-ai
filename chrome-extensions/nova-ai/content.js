'use strict';
// NovaAI content script - handles page text extraction and context menu actions
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getPageText') {
    const selectors = ['article', 'main', '[role="main"]', '.content', '#content', 'body'];
    let text = '';
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { text = el.innerText; if (text.length > 200) break; }
    }
    sendResponse({ text: text.slice(0, 8000), title: document.title, url: location.href });
  }
  if (msg.action === 'getSelection') {
    sendResponse({ text: window.getSelection().toString() });
  }
  return true;
});
