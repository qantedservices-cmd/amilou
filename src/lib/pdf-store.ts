// Temporary in-memory store for PDF files (single-use, auto-expiring)
interface PdfEntry {
  buffer: Buffer
  fileName: string
  expires: number
}

const store = new Map<string, PdfEntry>()

export function storePdf(buffer: Buffer, fileName: string): string {
  // Cleanup expired entries
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expires < now) store.delete(key)
  }

  const id = crypto.randomUUID()
  store.set(id, { buffer, fileName, expires: now + 5 * 60 * 1000 }) // 5 min
  return id
}

export function getPdf(id: string): PdfEntry | null {
  const entry = store.get(id)
  if (!entry) return null
  store.delete(id) // Single use
  return entry
}
