export const extractIdInfo = async (base64ImageBytes: string, mimeType: string): Promise<{ fullName: string, idNumber: string }> => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch('/api/extract-id', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ base64ImageBytes, mimeType })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'فشل في قراءة الصورة');
  }

  return response.json();
};
