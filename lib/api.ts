// API Configuration
const API_BASE_URL =
  typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://v0-attendance-system-design-eight.vercel.app/api'
    : '/api'; // Use relative path for Vercel serverless

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
    };
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      // For 409 status codes, return the data instead of throwing
      if (response.status === 409) {
        return data;
      }
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  auth: {
    register: (data: any) => apiClient.request('/auth?route=register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    login: (data: any) => apiClient.request('/auth?route=login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    scan: (data: any) => apiClient.request('/auth?route=scan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    generateManualCode: (data: { sessionId: string, type: 'in' | 'out' }) => apiClient.request('/auth?route=generate-manual-code', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    generatePendingCodes: (data: { sessionId: string, type: 'in' | 'out' }) => apiClient.request('/auth?route=generate-pending-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    clearSessionCodes: (sessionId: string) => apiClient.request('/auth?route=clear-session-codes', {
      method: 'DELETE',
      body: JSON.stringify({ sessionId }),
    }),
    submitManualCode: (data: { code: string, studentId: string }) => apiClient.request('/auth?route=manual-code', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    manualAttendanceUpdate: (data: { sessionId: string, studentId: string, status: 'present' | 'late' | 'absent' | 'pending' }) => apiClient.request('/auth?route=manual-attendance-update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getSessionAttendance: (sessionId: string) => apiClient.request(`/auth?route=session-attendance&sessionId=${sessionId}`),
    removeStudentFromSubject: (data: { subjectId: string, studentId: string }) => apiClient.request('/auth?route=remove-student-from-subject', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),
  },
  teacher: {
    getSubjects: (teacherId: string) => apiClient.request(`/subjects?route=teacher-subjects&teacherId=${teacherId}`),
    createSubject: (data: any) => apiClient.request('/subjects?route=create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getSubject: (id: string) => apiClient.request(`/subjects?route=get&id=${id}`),
    getSubjectStudents: (id: string) => apiClient.request(`/subjects?route=students&id=${id}`),
    getSubjectSessions: (id: string) => apiClient.request(`/subjects?route=sessions&id=${id}`),
    startSession: (id: string, data: any) => apiClient.request(`/subjects?route=create-session&id=${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    stopSession: (sessionId: string) => apiClient.request(`/sessions?route=stop&id=${sessionId}`, {
      method: 'PUT',
    }),
    getActiveSession: (id: string) => apiClient.request(`/subjects?route=active-session&id=${id}`),
    deleteSubject: (id: string) => apiClient.request(`/subjects?route=delete&id=${id}`, {
      method: 'DELETE',
    }),
    updateSubject: (id: string, data: any) => apiClient.request(`/subjects?route=update&id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },
  student: {
    getSubjects: (studentId: string) => apiClient.request(`/subjects?route=student-subjects&studentId=${studentId}`),
  },
  records: {
    getEnrollments: () => apiClient.request('/records?route=enrollments'),
    getAttendanceRecords: () => apiClient.request('/records?route=attendance-records'),
  },
};

export const healthCheck = async () => {
  try {
    const response = await fetch('/api/health');
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}; 