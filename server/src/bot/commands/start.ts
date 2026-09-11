import { CommandContext, Context } from 'grammy';
import { createWelcomeKeyboard } from '../keyboards/triageKeyboard.js';

export async function handleStartCommand(ctx: CommandContext<Context>, webAppUrl: string): Promise<void> {
  const userName = ctx.from?.first_name || 'Operator';
  const text =
    `🛡️ *Sentinel Pocket — Mobile Incident Cockpit*\n\n` +
    `Welcome, ${userName}. Sentinel Pocket is active and monitoring your services.\n\n` +
    `• Instant anomaly detection with flap protection\n` +
    `• 1-Tap runbooks (Container Restart, Canary Rollback)\n` +
    `• Real-time latency sparklines\n\n` +
    `Tap the button below to open the mobile cockpit.`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: createWelcomeKeyboard(webAppUrl),
  });
}
