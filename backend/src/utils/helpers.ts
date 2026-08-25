// src/utils/helpers.ts

import crypto from 'crypto';
import { simpleParser, ParsedMail } from 'mailparser';

/**
 * Generate unique email ID from message ID and account
 */
export const generateEmailId = (messageId: string, accountId: string): string => {
  return crypto
    .createHash('sha256')
    .update(`${messageId}-${accountId}`)
    .digest('hex')
    .substring(0, 32); // Shorten for readability
};

/**
 * Strip HTML tags and return plain text
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';
  
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&') // Replace &amp;
    .replace(/&lt;/g, '<') // Replace &lt;
    .replace(/&gt;/g, '>') // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
};

/**
 * Parse email buffer using mailparser
 */
export const parseEmail = async (buffer: string): Promise<ParsedMail> => {
  return await simpleParser(buffer);
};

/**
 * Get date 30 days ago for IMAP search
 */
export const get30DaysAgo = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
};

/**
 * Delay/sleep helper
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Exponential backoff retry logic
 */
export const exponentialBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) {
        throw error; // Last attempt failed
      }

      const delayTime = baseDelay * Math.pow(2, i);
      const jitter = Math.random() * 1000; // Add jitter to avoid thundering herd
      
      await sleep(delayTime + jitter);
    }
  }

  throw lastError;
};

/**
 * Sanitize filename for safe storage
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Truncate text to specified length
 */
export const truncate = (text: string, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Extract email address from "Name <email>" format
 */
export const extractEmail = (emailString: string): string => {
  const match = emailString.match(/<(.+?)>/);
  return match ? match[1] : emailString;
};

/**
 * Validate email address format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Format bytes to human readable size
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Check if string is empty or only whitespace
 */
export const isEmpty = (str: string | undefined | null): boolean => {
  return !str || str.trim().length === 0;
};

/**
 * Safely parse JSON with fallback
 */
export const safeJsonParse = <T>(
  jsonString: string,
  fallback: T
): T => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
};

/**
 * Create delay with timeout promise
 */
export const timeout = <T>(
  promise: Promise<T>,
  ms: number,
  timeoutError: Error = new Error('Operation timed out')
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(timeoutError), ms)
    )
  ]);
};

/**
 * Chunk array into smaller arrays
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Retry function with linear backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await sleep(delay);
    return retry(fn, retries - 1, delay);
  }
};