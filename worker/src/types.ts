import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  UPLOADS: R2Bucket;
  UPLOADS_PUBLIC_URL?: string;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string; // 'sandbox' | 'live'
  RESEND_API_KEY?: string;
  FRONTEND_URL?: string;
  API_PUBLIC_URL?: string;
  CHILD_SAFETY_SIGNOFF?: string;
  CLICKSEND_USERNAME?: string;
  CLICKSEND_API_KEY?: string;
  CLICKSEND_REQUIRED?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_REQUIRED?: string;
  FROM_EMAIL: string;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS?: string;
}

export interface AuthUser {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type Variables = {
  user: AuthUser;
};
