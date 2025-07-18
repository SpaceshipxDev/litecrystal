import path from 'path'

export function sanitizeRelativePath(relPath) {
  const normalized = path.normalize(relPath)
  const sanitized = normalized.replace(/^(\.\.[\/\\])+/, '')
  if (sanitized.includes('..')) {
    throw new Error('Invalid path')
  }
  return sanitized
}
