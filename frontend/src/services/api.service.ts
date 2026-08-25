import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Email {
  id: string;
  sender: string;
  senderEmail?: string;
  receiver: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  snippet?: string;
  category: 'INTERESTED' | 'MEETING_BOOKED' | 'NOT_INTERESTED' | 'SPAM' | 'OUT_OF_OFFICE' | 'UNCATEGORIZED';
  confidenceScore: number;
  isRead: boolean;
  isStarred: boolean;
  summary?: string;
  receivedAt: string;
  account?: { email: string };
  replies?: Array<{ id: string; type: string; suggestion: string; isRagGrounded?: boolean }>;
}

export interface EmailAccount {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  syncStatus: string;
  lastSyncedAt?: string;
}

export const fetchEmails = async (category?: string, accountId?: string, page = 1) => {
  const response = await apiClient.get('/emails', {
    params: { category, accountId, page }
  });
  return response.data?.data || { emails: [], total: 0 };
};

export const searchEmails = async (query: string, category?: string) => {
  const response = await apiClient.get('/emails/search', {
    params: { q: query, category }
  });
  return response.data?.data || { emails: [], total: 0 };
};

export const fetchEmailById = async (id: string) => {
  const response = await apiClient.get(`/emails/${id}`);
  return response.data?.data?.email || null;
};

export const suggestReply = async (id: string) => {
  const response = await apiClient.post(`/emails/${id}/suggest-reply`);
  return response.data?.data || { replies: [] };
};

export const categorizeEmail = async (id: string) => {
  const response = await apiClient.post(`/emails/${id}/categorize`);
  return response.data?.data?.email || null;
};

export const setCategory = async (id: string, category: string) => {
  const response = await apiClient.post(`/emails/${id}/set-category`, { category });
  return response.data?.data?.email || null;
};

export const fetchAccounts = async () => {
  const response = await apiClient.get('/accounts');
  return response.data?.data?.accounts || [];
};

export const connectAccount = async (data: { email: string; imapHost: string; imapPort: number; password: string }) => {
  const response = await apiClient.post('/accounts/connect', data);
  return response.data?.data || null;
};

export const disconnectAccount = async (id: string) => {
  const response = await apiClient.delete(`/accounts/${id}`);
  return response.data?.data || null;
};
