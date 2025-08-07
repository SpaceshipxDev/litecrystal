"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登录失败')
        return
      }
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/')
    } catch {
      setError('登录失败')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">登录</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Input placeholder="姓名" value={name} onChange={e => setName(e.target.value)} />
        <Input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
        <Button type="submit" className="w-full">登录</Button>
        <p className="text-sm text-center text-gray-600">
          没有账号？ <Link href="/signup" className="text-blue-500">注册</Link>
        </p>
      </form>
    </div>
  )
}
