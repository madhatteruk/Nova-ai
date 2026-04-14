'use strict';
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'novaAISummarize',
    title: 'Summarize with NovaAI',
    contexts: ['page', 'selection']
  });
  chrome.contextMenus.create({
    id: 'novaAIExplain',
    title: 'Explain with NovaAI',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'novaAITranslate',
    title: 'Translate with NovaAI',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.local.set({
    contextAction: info.menuItemId,
    contextText: info.selectionText || ''
  });
  chrome.action.openPopup();
});
