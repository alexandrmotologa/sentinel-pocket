import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  telegramBotToken: string;
  webAppUrl: string;
  port: number;
  host: string;
  mockMode: boolean;
  sentinelEndpoint: string;
  canaryMeshEndpoint: string;
  allowedTelegramUsers: number[];
  databasePath: string;
}

const parseAllowedUsers = (raw?: string): number[] => {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((id) => !isNaN(id));
};

export const config: AppConfig = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || 'mock_token',
  webAppUrl: process.env.WEB_APP_URL || 'http://localhost:8080',
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  mockMode: process.env.MOCK_MODE === 'true' || !process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'mock_token',
  sentinelEndpoint: process.env.SENTINEL_ENDPOINT || 'http://localhost:9090',
  canaryMeshEndpoint: process.env.CANARYMESH_ENDPOINT || 'http://localhost:8000',
  allowedTelegramUsers: parseAllowedUsers(process.env.ALLOWED_TELEGRAM_USERS),
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'sentinel_pocket.db'),
};
