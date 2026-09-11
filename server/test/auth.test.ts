import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { verifyTelegramWebAppData } from '../src/security/auth.js';

describe('Telegram WebApp Auth Verification', () => {
  const botToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

  it('allows mock token when mock mode is enabled', () => {
    const res = verifyTelegramWebAppData('mock', botToken, true);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.user?.username, 'alexandrmotologa');
  });

  it('rejects missing or empty initData when mock mode is disabled', () => {
    const res = verifyTelegramWebAppData(undefined, botToken, false);
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || '', /Missing initData/);
  });

  it('validates legitimate HMAC-SHA256 signature and fresh timestamp', () => {
    const now = Math.floor(Date.now() / 1000);
    const userJson = JSON.stringify({ id: 987654, first_name: 'Alexandr', username: 'alexandrmotologa' });

    const params: Record<string, string> = {
      auth_date: now.toString(),
      query_id: 'AAHdF6IQAAAAAN0XohD123',
      user: userJson,
    };

    const pairs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const initData = `auth_date=${encodeURIComponent(params.auth_date)}&query_id=${encodeURIComponent(
      params.query_id
    )}&user=${encodeURIComponent(params.user)}&hash=${hash}`;

    const res = verifyTelegramWebAppData(initData, botToken, false);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.user?.id, 987654);
    assert.strictEqual(res.user?.username, 'alexandrmotologa');
  });

  it('rejects tampered signature hash', () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = `auth_date=${now}&query_id=test&hash=deadbeef000111222333`;

    const res = verifyTelegramWebAppData(initData, botToken, false);
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || '', /Invalid signature/);
  });

  it('rejects expired auth_date older than 24 hours', () => {
    const expiredTime = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const params: Record<string, string> = {
      auth_date: expiredTime.toString(),
      query_id: 'expired_query',
    };

    const pairs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const initData = `auth_date=${expiredTime}&query_id=expired_query&hash=${hash}`;

    const res = verifyTelegramWebAppData(initData, botToken, false);
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || '', /expired/i);
  });
});
