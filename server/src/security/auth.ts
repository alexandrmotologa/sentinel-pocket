import crypto from 'crypto';
import { AuthVerificationResult, TelegramUserData } from '../types.js';

/**
 * Validates Telegram WebApp initData string using HMAC-SHA256 as specified in the
 * Telegram Web Apps documentation: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function verifyTelegramWebAppData(
  initData: string | undefined,
  botToken: string,
  isMockMode = false
): AuthVerificationResult {
  // Allow mock bypass when mock mode is enabled
  if (isMockMode && (!initData || initData === 'mock' || initData.startsWith('mock'))) {
    return {
      valid: true,
      user: {
        id: 10001,
        first_name: 'Alexandr',
        last_name: 'Motologa',
        username: 'alexandrmotologa',
        language_code: 'en',
      },
    };
  }

  if (!initData) {
    return { valid: false, reason: 'Missing initData' };
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) {
    return { valid: false, reason: 'Missing hash parameter' };
  }

  // Remove hash and prepare data-check-string
  urlParams.delete('hash');
  const params: string[] = [];
  for (const [key, value] of urlParams.entries()) {
    params.push(`${key}=${value}`);
  }
  params.sort();
  const dataCheckString = params.join('\n');

  // Compute secret key: HMAC_SHA256(key="WebAppData", msg=botToken)
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  // Compute signature: HMAC_SHA256(key=secretKey, msg=dataCheckString)
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) {
    return { valid: false, reason: 'Invalid signature hash' };
  }

  // Verify auth_date freshness (maximum 24 hours)
  const authDate = parseInt(urlParams.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    return { valid: false, reason: 'Auth data has expired (older than 24h)' };
  }

  let user: TelegramUserData | undefined;
  const userJson = urlParams.get('user');
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      // Ignored if user parameter is malformed
    }
  }

  return { valid: true, user };
}
