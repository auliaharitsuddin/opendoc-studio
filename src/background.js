const APP_URL = chrome.runtime.getURL('app.html');
const PURGE_ALARM = 'opendoc-scratch-purge';

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: APP_URL });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP_URL });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(PURGE_ALARM, { periodInMinutes: 5 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(PURGE_ALARM, { periodInMinutes: 5 });
});

// Safety-net sweep: purges any batch-mode scratch file left behind by a crashed
// or force-closed tab. Every other tool never touches persistent storage at all.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PURGE_ALARM) return;
  const { purgeStaleScratch } = await import('./core/file-store.js');
  await purgeStaleScratch(15 * 60 * 1000);
});
