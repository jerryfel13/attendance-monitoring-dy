// API Configuration
const API_BASE_URL = '/api/auth'; // Use relative path for Vercel serverless

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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  auth: {
    register: (data: any) => apiClient.request('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    login: (data: any) => apiClient.request('/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    scan: (data: any) => apiClient.request('/scan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  teacher: {
    getSubjects: (teacherId: string) => apiClient.request(`/teacher-subjects?teacherId=${teacherId}`),
    createSubject: (data: any) => apiClient.request('/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getSubject: (id: string) => apiClient.request(`/subjects-${id}`),
    getSubjectStudents: (id: string) => apiClient.request(`/subjects-${id}-students`),
    getSubjectSessions: (id: string) => apiClient.request(`/subjects-${id}-sessions`),
    startSession: (id: string, data: any) => apiClient.request(`/subjects-${id}-sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    stopSession: (sessionId: string) => apiClient.request(`/sessions-${sessionId}-stop`, {
      method: 'PUT',
    }),
    getActiveSession: (id: string) => apiClient.request(`/subjects-${id}-sessions-active`),
  },
  student: {
    getSubjects: (studentId: string) => apiClient.request(`/student-subjects?studentId=${studentId}`),
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