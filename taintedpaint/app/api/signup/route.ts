import { NextRequest, NextResponse } from 'next/server'
import { addUser } from '@/lib/userStore'

const DEPARTMENTS = ['商务', '编程', '手工', '操机', '表面处理', '检验']

export async function POST(req: NextRequest) {
  try {
    const { name, department, password } = await req.json()
    if (!name || !department || !password || !DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const user = await addUser(name, department, password)
    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json({ error: 'User exists' }, { status: 400 })
  }
}
