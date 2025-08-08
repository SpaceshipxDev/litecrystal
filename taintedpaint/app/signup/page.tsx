"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const DEPARTMENTS = ['商务', '编程', '手工', '操机', '表面处理', '检验']

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [department, setDepartment] = useState(DEPARTMENTS[0])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, department, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '注册失败')
        return
      }
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/')
    } catch {
      setError('注册失败')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">注册</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Input placeholder="姓名" value={name} onChange={e => setName(e.target.value)} />
        <select
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={department}
          onChange={e => setDepartment(e.target.value)}
        >
          {DEPARTMENTS.map(dep => (
            <option key={dep} value={dep}>{dep}</option>
          ))}
        </select>
        <Input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
        <Button type="submit" className="w-full">注册</Button>
        <p className="text-sm text-center text-gray-600">
          已有账号？ <Link href="/login" className="text-blue-500">登录</Link>
        </p>
      </form>
    </div>
  )
}
