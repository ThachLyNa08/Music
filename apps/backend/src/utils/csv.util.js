function escapeCsvValue(value) {
  if (value === null || value === undefined) return ''

  let normalized = value

  if (value instanceof Date) {
    normalized = value.toISOString()
  }

  if (typeof value === 'boolean') {
    normalized = value ? 'Có' : 'Không'
  }

  const str = String(normalized)

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

function jsonToCsv(rows, columns) {
  const header = columns.map((col) => escapeCsvValue(col.header)).join(',')

  const body = rows.map((row) => {
    return columns
      .map((col) => {
        const value =
          typeof col.value === 'function'
            ? col.value(row)
            : row[col.key]

        return escapeCsvValue(value)
      })
      .join(',')
  })

  return '\uFEFF' + [header, ...body].join('\r\n')
}

function createCsvFilename(moduleName) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')

  const stamp =
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())

  return `musicflow-${moduleName}-${stamp}.csv`
}

function sendCsv(res, filename, csvContent) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  )
  return res.status(200).send(csvContent)
}

module.exports = {
  jsonToCsv,
  createCsvFilename,
  sendCsv
}
