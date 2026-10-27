/** Pogingen: lange kant in pixels en JPEG-kwaliteit. Ruim boven de 1920 px die de website gebruikt. */
const STEPS = [
  [4000, 0.9],
  [3200, 0.86],
  [2400, 0.82],
] as const

/**
 * Verkleint een foto in de browser tot hooguit `maxBytes` (als JPEG), voor
 * hosting die grote verzoeken weigert (Vercel: 4,5 MB). Een bestand dat al
 * klein genoeg is komt ongewijzigd terug. De browser past de EXIF-rotatie toe
 * en laat metadata (zoals locatie) weg. Gooit een fout als het niet lukt,
 * bijvoorbeeld bij een HEIC-bestand dat de browser niet kan lezen.
 */
export async function fitUpload(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) return file
  const bitmap = await createImageBitmap(file)
  try {
    for (const [edge, quality] of STEPS) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) break
      // JPEG kent geen transparantie: wit in plaats van zwart.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= maxBytes) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
      }
    }
  } finally {
    bitmap.close()
  }
  throw new Error('De foto kon niet klein genoeg worden gemaakt.')
}

/** Bytes als megabytes, zoals elders in het beheer (1 MB = 1024 × 1024 bytes). */
export function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 1 })
}
