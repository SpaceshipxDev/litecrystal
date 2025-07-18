import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'

export async function writeJsonAtomic(filePath: string, data: any) {
  // Use a unique temporary file so concurrent writes don't interfere
  const tempPath = `${filePath}.${randomUUID()}.tmp`

  // Write the entire JSON to the temp file first
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2))

  // Atomically replace the target file
  await fs.rename(tempPath, filePath)
}
