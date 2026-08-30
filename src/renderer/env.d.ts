export {}

declare global {
  interface Window {
    mikan?: {
      platform: NodeJS.Platform
    }
  }
}
