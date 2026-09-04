export function isDesktopApp() {
  return Boolean(window.mikan)
}

export function getDesktopBridge() {
  return window.mikan
}
