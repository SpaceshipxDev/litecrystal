"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Search, RotateCw, X, CalendarRange } from "lucide-react"
import AccountButton from "@/components/AccountButton"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBoard = pathname === "/"
  const [search, setSearch] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [deliveryStart, setDeliveryStart] = useState("")
  const [deliveryEnd, setDeliveryEnd] = useState("")
  const [resultCount, setResultCount] = useState<number | null>(null)

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

  useEffect(() => {
    const onResults = (e: Event) => {
      const ce = e as unknown as CustomEvent<number>
      setResultCount(typeof ce.detail === "number" ? ce.detail : null)
    }
    window.addEventListener("board:resultsCount" as any, onResults as any)
    return () => window.removeEventListener("board:resultsCount" as any, onResults as any)
  }, [])

  const dispatchSearch = (value: string) => {
    try {
      window.dispatchEvent(new CustomEvent("board:search", { detail: value }))
    } catch {}
  }

  const dispatchDeliveryRange = (start: string, end: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent("board:deliveryRange", { detail: { start, end } })
      )
    } catch {}
  }

  const triggerRefresh = () => {
    try {
      window.dispatchEvent(new Event("board:refresh"))
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col">
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
                    className="w-64 pl-8 pr-20 py-2 text-sm rounded-xl bg-white/60 backdrop-blur border apple-border-light focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <button
                    onClick={() => setIsDatePickerOpen((o) => !o)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/70"
                    aria-label="按交期过滤"
                  >
                    <CalendarRange className="w-4 h-4 text-gray-400" />
                  </button>
                  {search && (
                    <button
                      onClick={() => { setSearch(""); dispatchSearch("") }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/70"
                      aria-label="清除"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                  {(search || deliveryStart || deliveryEnd) && resultCount !== null && (
                    <div className="absolute -bottom-5 left-8 text-xs text-gray-500">
                      {resultCount} results
                    </div>
                  )}
                  {isDatePickerOpen && (
                    <div className="absolute right-0 mt-2 w-72 p-3 rounded-lg bg-white/90 backdrop-blur border apple-border-light shadow flex flex-col gap-2 z-50">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={deliveryStart}
                          onChange={(e) => setDeliveryStart(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border apple-border-light rounded"
                        />
                        <span className="text-gray-500">—</span>
                        <input
                          type="date"
                          value={deliveryEnd}
                          onChange={(e) => setDeliveryEnd(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border apple-border-light rounded"
                        />
                      </div>
                      <div className="flex justify-end gap-2 text-sm">
                        <button
                          onClick={() => {
                            setDeliveryStart("")
                            setDeliveryEnd("")
                            dispatchDeliveryRange("", "")
                            setIsDatePickerOpen(false)
                          }}
                          className="px-2 py-1 rounded hover:bg-gray-100"
                        >
                          清除
                        </button>
                        <button
                          onClick={() => {
                            dispatchDeliveryRange(deliveryStart, deliveryEnd)
                            setIsDatePickerOpen(false)
                          }}
                          className="px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            )}
            <AccountButton />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

    </div>
  )
}

// Tabs removed for focused, simplified UX


