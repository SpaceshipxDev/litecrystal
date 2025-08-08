"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Search, RotateCw, X } from "lucide-react"
import AccountButton from "@/components/AccountButton"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBoard = pathname === "/"
  const [search, setSearch] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Listen to board refresh state to animate the header refresh icon
  useEffect(() => {
    const onRefreshing = (e: Event) => {
      // e is CustomEvent<boolean>
      const ce = e as unknown as CustomEvent<boolean>
      setIsRefreshing(Boolean(ce.detail))
    }
    window.addEventListener("board:refreshing" as any, onRefreshing as any)
    return () => window.removeEventListener("board:refreshing" as any, onRefreshing as any)
  }, [])

  const dispatchSearch = (value: string) => {
    try {
      window.dispatchEvent(new CustomEvent("board:search", { detail: value }))
    } catch {}
  }

  const triggerRefresh = () => {
    try {
      window.dispatchEvent(new Event("board:refresh"))
    } catch {}
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="apple-glass apple-shadow sticky top-0 z-40 border-b border-transparent">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[15px] font-semibold tracking-tight text-gray-900">Estara</Link>
            {isBoard && (
              <button
                onClick={triggerRefresh}
                className={`p-1.5 text-gray-600 hover:text-gray-900 rounded-md transition-all ${isRefreshing ? "animate-spin" : ""}`}
                title="刷新"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isBoard && (
              <div className="relative hidden sm:block">
                  <input
                    id="board-search"
                    type="text"
                    placeholder="搜索客户、负责人或ID…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); dispatchSearch(e.target.value) }}
                    className="w-64 px-8 py-2 text-sm rounded-xl bg-white/60 backdrop-blur border apple-border-light focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  {search && (
                    <button
                      onClick={() => { setSearch(""); dispatchSearch("") }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/70"
                      aria-label="清除"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
              </div>
            )}
            <AccountButton />
          </div>
        </div>
      </header>

      <main className={`flex-1 min-h-0 ${isBoard ? "overflow-hidden" : "overflow-auto"}`}>
        {children}
      </main>

    </div>
  )
}

// Tabs removed for focused, simplified UX


