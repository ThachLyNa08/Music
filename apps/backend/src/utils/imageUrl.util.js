function normalizeCoverUrl(url, req) {
  if (!url) return null

  const clean = String(url).trim()

  if (!clean || clean === 'null' || clean === 'undefined' || clean === '[object Object]') {
    return null
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean
  }

  // If req is not provided, we can't accurately append the host, so just return the clean path
  if (!req || !req.protocol || !req.get) {
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`

  if (clean.startsWith('/uploads')) {
    return `${baseUrl}${clean}`
  }

  if (clean.startsWith('uploads')) {
    return `${baseUrl}/${clean}`
  }

  if (clean.startsWith('/images')) {
    return `${baseUrl}${clean}`
  }

  if (clean.startsWith('images')) {
    return `${baseUrl}/${clean}`
  }

  if (clean.startsWith('/')) {
    return `${baseUrl}${clean}`
  }

  return `${baseUrl}/uploads/${clean}`
}

module.exports = {
  normalizeCoverUrl
}
