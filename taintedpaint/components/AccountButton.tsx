"use client"

import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface StoredUser {
  name: string
  department: string
}

export default function AccountButton() {
  const [user, setUser] = useState<StoredUser | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
  }, [])

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
    setOpen(false)
    router.push('/login')
  }

  if (!user) {
    return (
      <Link href="/login" className="p-2 apple-glass rounded-xl hover:bg-white/70" title="登录">
        <User className="w-5 h-5 text-gray-700" />
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 apple-glass rounded-xl hover:bg-white/70"
        title={user.name}
      >
        <User className="w-5 h-5 text-gray-700" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 apple-glass border apple-border-light rounded-2xl apple-shadow z-50">
          <div className="px-4 py-2 text-sm text-gray-800 border-b border-transparent">{user.name}</div>
          <button
            onClick={logout}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-white/70"
          >
            退出
          </button>
        </div>
      )}
    </div>
  )
}
