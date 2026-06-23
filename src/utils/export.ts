import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { downloadBlob } from './download'

export interface ExportColumn {
  /** 字段名 */
  prop: string
  /** 列标题 */
  label: string
  /** 自定义格式化函数 */
  formatter?: (row: any, value: any) => string | number
}

/**
 * 导出数据为 Excel 文件
 * @param columns 列定义
 * @param data 数据
 * @param filename 文件名（不含扩展名）
 */
export function exportToExcel(columns: ExportColumn[], data: any[], filename: string): void {
  // 构造表头
  const header = columns.map((col) => col.label)
  // 构造数据行
  const rows = data.map((row) => {
    const item: Record<string, any> = {}
    columns.forEach((col) => {
      const rawValue = row[col.prop]
      const value = col.formatter ? col.formatter(row, rawValue) : rawValue ?? ''
      item[col.label] = value
    })
    return item
  })

  const worksheet = XLSX.utils.json_to_sheet(rows, { header })
  // 自动列宽
  const colWidths = columns.map((col) => {
    const maxLen = Math.max(
      col.label.length * 2,
      ...rows.map((row) => {
        const v = row[col.label]
        return v == null ? 0 : String(v).length
      }),
    )
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
  })
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  saveAs(blob, finalName)
}

/**
 * 导出数据为 CSV 文件
 * @param columns 列定义
 * @param data 数据
 * @param filename 文件名（不含扩展名）
 */
export function exportToCsv(columns: ExportColumn[], data: any[], filename: string): void {
  // 表头
  const header = columns.map((col) => escapeCsvCell(col.label))
  // 数据行
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = row[col.prop]
        const value = col.formatter ? col.formatter(row, rawValue) : rawValue ?? ''
        return escapeCsvCell(value)
      })
      .join(',')
  })
  // 拼接 CSV 内容（带 BOM 头，确保 Excel 正确识别中文）
  const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n')
  const finalName = filename.endsWith('.csv') ? filename : `${filename}.csv`
  downloadBlob(csvContent, finalName, 'text/csv;charset=utf-8;')
}

/**
 * CSV 单元格转义
 * - 包含逗号、双引号、换行符时需要用双引号包裹
 * - 双引号需要转义为两个双引号
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
