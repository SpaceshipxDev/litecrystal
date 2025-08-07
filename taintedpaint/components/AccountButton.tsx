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
      <Link href="/login" className="p-2 hover:bg-gray-100 rounded-lg" title="登录">
        <User className="w-5 h-5 text-gray-600" />
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-gray-100 rounded-lg"
        title={user.name}
      >
        <User className="w-5 h-5 text-gray-600" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded shadow-md z-50">
          <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">{user.name}</div>
          <button
            onClick={logout}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            退出
          </button>
        </div>
      )}
    </div>
  )
}
