/**
 * Blob 文件下载
 * @param data 文件数据
 * @param filename 文件名
 * @param mimeType MIME 类型
 */
export function downloadBlob(data: BlobPart, filename: string, mimeType = 'application/octet-stream'): void {
  const blob = new Blob([data], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * 根据 URL 下载文件
 * @param url 文件地址
 * @param filename 文件名
 */
export function downloadUrl(url: string, filename?: string): void {
  const link = document.createElement('a')
  link.href = url
  if (filename) link.download = filename
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 导出 JSON 数据
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename, 'application/json')
}
