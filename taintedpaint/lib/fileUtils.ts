import { promises as fs } from 'fs'

export async function writeJsonAtomic(filePath: string, data: any) {
  const tempPath = filePath + '.tmp'
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2))
  await fs.rename(tempPath, filePath)
}
