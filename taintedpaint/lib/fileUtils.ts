import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'

export async function writeJsonAtomic(filePath: string, data: any) {
  // Use a unique temporary file so concurrent writes don't interfere
  const tempPath = `${filePath}.${randomUUID()}.tmp`

  // Write the entire JSON to the temp file first
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2))

  // Atomically replace the target file
  try {
    await fs.rename(tempPath, filePath)
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      try {
        await fs.unlink(filePath)
        await fs.rename(tempPath, filePath)
        return
      } catch (innerErr) {
        await fs.unlink(tempPath).catch(() => {})
        throw innerErr
      }
    }
    await fs.unlink(tempPath).catch(() => {})
    throw err
  }
}

export async function renameWithFallback(oldPath: string, newPath: string) {
  try {
    await fs.rename(oldPath, newPath)
  } catch (err: any) {
    if (err?.code === 'EXDEV') {
      await fs.copyFile(oldPath, newPath)
      await fs.unlink(oldPath)
    } else {
      throw err
    }
  }
}
