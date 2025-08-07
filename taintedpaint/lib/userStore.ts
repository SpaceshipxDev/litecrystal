import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { LOCAL_STORAGE_ROOT } from './storagePaths'
import type { User } from '@/types'

const USERS_PATH = path.join(LOCAL_STORAGE_ROOT, 'users.json')

async function readUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_PATH, 'utf8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true })
  await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2), 'utf8')
}

export async function addUser(name: string, department: string, password: string) {
  const users = await readUsers()
  if (users.find(u => u.name === name)) {
    throw new Error('User exists')
  }
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
  const user: User = { name, department, passwordHash }
  users.push(user)
  await writeUsers(users)
  return { name: user.name, department: user.department }
}

export async function authenticateUser(name: string, password: string) {
  const users = await readUsers()
  const user = users.find(u => u.name === name)
  if (!user) return null
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
  if (user.passwordHash !== passwordHash) return null
  return { name: user.name, department: user.department }
}
