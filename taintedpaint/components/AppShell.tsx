"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import AccountButton from "@/components/AccountButton"
import { cn } from "@/lib/utils"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBoard = pathname === "/"

  return (
    <div className="min-h-screen flex flex-col">
      <header className="apple-glass apple-shadow sticky top-0 z-40 border-b border-transparent">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[15px] font-semibold tracking-tight text-gray-900">Estara</Link>
          </div>
          <div className="flex items-center gap-2">
            <AccountButton />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">© {new Date().getFullYear()} Estara</footer>
    </div>
  )
}

// Tabs removed for focused, simplified UX


