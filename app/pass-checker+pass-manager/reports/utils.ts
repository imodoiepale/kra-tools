// Parse dates in various formats
export const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null

  // Handle Excel serial number format
  if (!isNaN(Number(dateStr))) {
    const excelEpoch = new Date(1900, 0, 1)
    const daysSinceEpoch = Number(dateStr) - 1
    const millisecondsSinceEpoch = daysSinceEpoch * 24 * 60 * 60 * 1000
    return new Date(excelEpoch.getTime() + millisecondsSinceEpoch)
  }

  // Try different date formats
  const formats = [
    'DD/MM/YYYY',
    'DD-MM-YYYY',
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD-MM-YY',
    'YYYY/MM/DD'
  ]

  for (const format of formats) {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  return null
}

// Format dates consistently
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A'
  const date = parseDate(dateStr)
  if (!date) return 'Invalid Date'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Get status color based on status
export const getStatusColor = (status: string | null): string => {
  if (!status) return 'bg-gray-100 text-gray-800'

  const lowerStatus = status.toLowerCase()

  switch (lowerStatus) {
    case 'valid':
      return 'bg-green-100 text-green-800'
    case 'invalid':
    case 'error':
      return 'bg-red-100 text-red-800'
    case 'locked':
    case 'pending':
    case 'password expired':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
