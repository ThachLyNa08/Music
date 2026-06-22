const { pool } = require('../config/database');

const tableCache = new Map();
const columnCache = new Map();

function cacheKey(parts) {
  return parts.join(':');
}

async function tableExists(tableName) {
  if (!tableName) return false;
  const key = cacheKey(['table', tableName]);
  if (tableCache.has(key)) return tableCache.get(key);

  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [tableName]
  );

  const exists = Number(rows?.[0]?.total || 0) > 0;
  tableCache.set(key, exists);
  return exists;
}

async function columnExists(tableName, columnName) {
  if (!tableName || !columnName) return false;
  const key = cacheKey(['column', tableName, columnName]);
  if (columnCache.has(key)) return columnCache.get(key);

  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName]
  );

  const exists = Number(rows?.[0]?.total || 0) > 0;
  columnCache.set(key, exists);
  return exists;
}

async function getExistingColumns(tableName, columnNames) {
  const checks = await Promise.all(
    columnNames.map(async columnName => [columnName, await columnExists(tableName, columnName)])
  );
  return checks.reduce((acc, [columnName, exists]) => {
    acc[columnName] = exists;
    return acc;
  }, {});
}

function clearIntrospectionCache() {
  tableCache.clear();
  columnCache.clear();
}

module.exports = {
  tableExists,
  columnExists,
  getExistingColumns,
  clearIntrospectionCache,
};
