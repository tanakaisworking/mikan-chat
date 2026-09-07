export function isDesktopApp() {
  return Boolean(window.mikan)
}

export function isMacDesktop() {
  return window.mikan?.platform === "darwin"
}

export function getDesktopBridge() {
  return window.mikan
}
