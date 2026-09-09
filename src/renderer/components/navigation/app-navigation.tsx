import { BookOpenText, House, Menu, MessagesSquare, PenLine, Plus, Settings } from "lucide-react"
import { useEffect, useState } from "react"

import { Brand } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type Page = "home" | "chat" | "create"

type NavigationProps = {
  activePage: Page
  onPageChange: (page: Page) => void
  onAddPack: () => void
  onOpenDocs: () => void
  onOpenSettings: () => void
}

export function DesktopSidebar({ activePage, onPageChange, onAddPack, onOpenDocs, onOpenSettings }: NavigationProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border/70 bg-surface-soft/40 p-4 max-md:hidden">
      <Brand tagline="未完成の物語を楽しもう" className="px-2 py-3" />

      <nav aria-label="PCメインナビゲーション" className="mt-6 grid gap-1">
        <SidebarLink active={activePage === "home"} label="ホーム" icon={<House />} onClick={() => onPageChange("home")} />
        <SidebarLink active={activePage === "chat"} label="チャット" icon={<MessagesSquare />} onClick={() => onPageChange("chat")} />
        <SidebarLink active={activePage === "create"} label="つくる" icon={<PenLine />} onClick={() => onPageChange("create")} />
      </nav>

      <Button variant="outline" className="mt-4 w-full justify-start px-3 font-medium shadow-none" onClick={onAddPack}>
        <Plus />
        シナリオを追加
      </Button>

      <div className="mt-auto grid gap-1 border-t border-border/70 pt-4">
        <SidebarLink label="技術ドキュメント" icon={<BookOpenText />} onClick={onOpenDocs} />
        <SidebarLink label="設定" icon={<Settings />} onClick={onOpenSettings} />
      </div>
    </aside>
  )
}

function SidebarLink({ active = false, label, icon, onClick }: { active?: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full justify-start px-3 font-medium text-muted-foreground shadow-none",
        active && "text-primary hover:bg-surface",
      )}
      onClick={onClick}
    >
      {icon}
      <span className={cn(active && "font-semibold")}>{label}</span>
    </Button>
  )
}

export function MobileHeader({ onOpenDocs, onOpenSettings }: Pick<NavigationProps, "onOpenDocs" | "onOpenSettings">) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!window.matchMedia) return
    const desktop = window.matchMedia("(min-width: 768px)")
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false)
    }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center border-b border-border/80 bg-background/94 px-3 backdrop-blur-xl max-md:flex">
      <Brand tagline="未完成の物語を楽しもう" className="gap-2 [&_img]:size-10 [&_[data-brand-title]]:text-xl" />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="ml-auto size-11 rounded-full" aria-label="メニューを開く" />}
        >
          <Menu />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-2">
          <DropdownMenuItem className="min-h-11 gap-3 px-3 text-sm" onClick={onOpenDocs}>
            <BookOpenText />
            技術ドキュメント
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 gap-3 px-3 text-sm" onClick={onOpenSettings}>
            <Settings />
            設定
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

export function MobileNavigation({ activePage, onPageChange, onAddPack }: Pick<NavigationProps, "activePage" | "onPageChange" | "onAddPack">) {
  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] z-30 hidden max-md:block">
        <Button className="h-13 w-full gap-2 rounded-md shadow-overlay" onClick={onAddPack}>
          <Plus />
          新しいシナリオを作成&amp;インポート
        </Button>
      </div>
      <nav
        aria-label="モバイルメインナビゲーション"
        className="fixed inset-x-0 bottom-0 z-30 hidden h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-3 border-t border-border/80 bg-surface/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgb(91_62_40_/_8%)] backdrop-blur-xl max-md:grid"
      >
        <MobileTabButton active={activePage === "home"} label="ホーム" icon={<House />} onClick={() => onPageChange("home")} />
        <MobileTabButton active={activePage === "chat"} label="チャット" icon={<MessagesSquare />} onClick={() => onPageChange("chat")} />
        <MobileTabButton active={activePage === "create"} label="つくる" icon={<PenLine />} onClick={() => onPageChange("create")} />
      </nav>
    </>
  )
}

function MobileTabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className="relative flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 aria-current:text-primary [&_svg]:size-6"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {active ? <span className="absolute top-0 h-0.5 w-12 rounded-full bg-primary" aria-hidden="true" /> : null}
    </button>
  )
}
