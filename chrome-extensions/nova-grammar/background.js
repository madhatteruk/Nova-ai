'use strict';
// NovaGrammar background service worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'novaGrammarCheck',
    title: 'Check with NovaGrammar',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'novaGrammarCheck') {
    // Store selected text and open popup
    chrome.storage.local.set({ savedText: info.selectionText });
    chrome.action.openPopup();
  }
});
