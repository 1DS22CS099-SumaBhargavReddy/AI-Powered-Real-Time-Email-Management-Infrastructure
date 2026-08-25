// src/models/email.model.ts

export type AICategory =
  | 'Work'
  | 'Personal'
  | 'Finance'
  | 'Promotions'
  | 'Social'
  | 'Travel'
  | 'Shopping'
  | 'Education'
  | 'Interviews'
  | 'Job Applications'
  | 'Notifications'
  | 'Important'
  | 'Spam'
  | 'Uncategorized';

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailDocument {
  id: string;
  userId: string;
  messageId: string;
  sender: string;
  receiver: string;
  subject: string;
  body: string;
  category: AICategory;
  summary?: string;
  receivedAt: Date;
}

export interface SearchQuery {
  q?: string;
  category?: AICategory;
  from?: number;
  size?: number;
}