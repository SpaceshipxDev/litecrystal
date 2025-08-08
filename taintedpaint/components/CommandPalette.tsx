"use client"

import { useEffect, useState, useRef } from "react"
import { Search } from "lucide-react"

export default function CommandPalette({
  onSelect,
}: {
  onSelect?: (value: string) => void
}) {
  // Minimal: only capture ⌘K to focus the board search input

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        const input = document.getElementById("board-search") as HTMLInputElement | null
        input?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return null
}


