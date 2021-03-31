export const Browser = {
  isQQBrowser: !!window.navigator.userAgent.match(/QQBrowser\/(\d+\.\d+)/i),
  isFireFox: !!window.navigator.userAgent.match(/Firefox\/(\d+\.\d+)/i),
  isSogou: !!window.navigator.userAgent.match(/MetaSr\/(\d+\.\d+)/i),
  isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
};