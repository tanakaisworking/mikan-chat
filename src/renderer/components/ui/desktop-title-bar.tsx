import { isMacDesktop } from "@/lib/platform"

export function DesktopTitleBar() {
  if (!isMacDesktop()) return null
  return <div className="h-9 w-full shrink-0 bg-linear-to-b from-[#a53f00] to-primary [-webkit-app-region:drag] dark:from-[#5f2700] dark:to-[#7a3000]" aria-hidden="true" />
}
