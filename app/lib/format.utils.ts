export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    // Format as DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return 'Invalid Date';
  }
};

export const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    // Format as DD/MM/YYYY HH:mm
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return 'Invalid Date';
  }
};

export const getStatusColorClass = (status: string | null | undefined): string => {
  if (!status) return 'text-yellow-600 font-medium';
  
  const statusLower = status.toLowerCase();
  if (statusLower === 'valid' || statusLower === 'valid - nil return filed') {
    return 'text-green-600 font-medium';
  }
  if (statusLower === 'error' || statusLower === 'invalid') {
    return 'text-red-600 font-medium';
  }
  return 'text-yellow-600 font-medium';
};
