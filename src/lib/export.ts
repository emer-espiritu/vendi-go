import { downloadFile } from './utils'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number
}

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]) {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const header = columns.map((column) => escape(column.header)).join(';')
  const body = rows.map((row) => columns.map((column) => escape(column.value(row))).join(';')).join('\n')
  return `${header}\n${body}`
}

export function exportCsv<T>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  downloadFile(`\ufeff${toCsv(rows, columns)}`, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

/**
 * Genera un libro SpreadsheetML 2003 (.xls) que Excel y LibreOffice abren de forma nativa.
 * Evita dependencias externas manteniendo una exportación real a Excel.
 */
export function exportExcel<T>(filename: string, sheetName: string, rows: T[], columns: ExportColumn<T>[]) {
  const escape = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

  const cell = (value: string | number) => {
    const isNumber = typeof value === 'number' && Number.isFinite(value)
    return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escape(String(value))}</Data></Cell>`
  }

  const headerRow = `<Row>${columns.map((column) => cell(column.header)).join('')}</Row>`
  const dataRows = rows.map((row) => `<Row>${columns.map((column) => cell(column.value(row))).join('')}</Row>`).join('')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${escape(sheetName).slice(0, 31)}">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`

  downloadFile(xml, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
}

/** Abre el diálogo de impresión: el navegador permite guardar como PDF. */
export function printDocument() {
  window.print()
}
