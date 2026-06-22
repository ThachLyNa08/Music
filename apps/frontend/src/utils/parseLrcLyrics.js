export function parseLrcLyrics(rawLyrics) {
  if (typeof rawLyrics !== 'string' || !rawLyrics.trim()) return []

  const parsedLines = []
  const timestampPattern = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g
  const metadataPattern = /^\[(ar|ti|al|by|offset):.*\]$/i

  for (const rawLine of rawLyrics.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || metadataPattern.test(line)) continue

    const timestamps = [...line.matchAll(timestampPattern)]
    if (!timestamps.length) continue

    const text = line.replace(timestampPattern, '').trim()

    for (const match of timestamps) {
      const time = parseLrcTimestamp(match[1])
      if (time === null) continue
      parsedLines.push({ time, text })
    }
  }

  return parsedLines.sort((a, b) => a.time - b.time)
}

function parseLrcTimestamp(timestamp) {
  const match = String(timestamp || '').match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (!match) return null

  const minutes = Number(match[1])
  const seconds = Number(match[2])
  const fraction = (match[3] || '').padEnd(3, '0').slice(0, 3)
  const milliseconds = fraction ? Number(fraction) : 0

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null

  return (minutes * 60) + seconds + (milliseconds / 1000)
}
