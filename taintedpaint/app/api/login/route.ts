import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/userStore'

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json()
    if (!name || !password) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const user = await authenticateUser(name, password)
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
}
