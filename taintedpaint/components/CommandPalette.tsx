"use client"

import { useEffect, useState, useRef } from "react"
import { Search } from "lucide-react"

export default function CommandPalette({
  onSelect,
}: {
  onSelect?: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="apple-glass apple-shadow apple-border-light rounded-2xl border w-full max-w-xl mx-auto mt-24 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索任务、客户或操作…"
            className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400"
          />
        </div>
        {/* hook up result list later if needed */}
      </div>
    </div>
  )
}


