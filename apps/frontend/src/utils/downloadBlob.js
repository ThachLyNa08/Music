export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  link.remove()
  window.URL.revokeObjectURL(url)
}

export function getFilenameFromDisposition(disposition, fallback = 'musicflow-report.csv') {
  if (!disposition) return fallback

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const normalMatch = disposition.match(/filename="?([^"]+)"?/i)
  if (normalMatch?.[1]) {
    return normalMatch[1]
  }

  return fallback
}
