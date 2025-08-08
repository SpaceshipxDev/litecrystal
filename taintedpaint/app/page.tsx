// app.page.tsx 

"use client"

import KanbanBoard from "@/kanban-board"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
 

export default function Page() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (!user) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [router])
  if (!ready) return null
  return <KanbanBoard />
}
