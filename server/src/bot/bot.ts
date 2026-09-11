import { Bot } from 'grammy';
import { run, RunnerHandle } from '@grammyjs/runner';
import { AppConfig } from '../config.js';
import { HealthChecker } from '../monitor/checker.js';
import { MonitorStore } from '../monitor/store.js';
import { handleAlertsCommand } from './commands/alerts.js';
import { handleHelpCommand } from './commands/help.js';
import { handleStartCommand } from './commands/start.js';
import { handleStatusCommand } from './commands/status.js';
import { createAlertTriageKeyboard } from './keyboards/triageKeyboard.js';

export class TelegramBotManager {
  private bot: Bot | null = null;
  private runner: RunnerHandle | null = null;
  private config: AppConfig;
  private store: MonitorStore;
  private checker: HealthChecker;
  private registeredChats: Set<number> = new Set();

  constructor(config: AppConfig, store: MonitorStore, checker: HealthChecker) {
    this.config = config;
    this.store = store;
    this.checker = checker;
  }

  public async start(): Promise<void> {
    // If running in mock mode without valid bot token, log and skip live connection
    if (this.config.mockMode && (!this.config.telegramBotToken || this.config.telegramBotToken === 'mock_token')) {
      console.log('🤖 Telegram Bot: Running in MOCK_MODE (live Telegram long polling disabled).');
      return;
    }

    try {
      this.bot = new Bot(this.config.telegramBotToken);

      this.bot.command('start', (ctx) => {
        if (ctx.chat?.id) this.registeredChats.add(ctx.chat.id);
        return handleStartCommand(ctx, this.config.webAppUrl);
      });

      this.bot.command('status', (ctx) => {
        if (ctx.chat?.id) this.registeredChats.add(ctx.chat.id);
        return handleStatusCommand(ctx, this.store);
      });

      this.bot.command('alerts', (ctx) => {
        if (ctx.chat?.id) this.registeredChats.add(ctx.chat.id);
        return handleAlertsCommand(ctx, this.store, this.config.webAppUrl);
      });

      this.bot.command('help', handleHelpCommand);

      // Handle triage callback buttons
      this.bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        const fromUser = ctx.from?.username || ctx.from?.first_name || 'Operator';
        const userId = ctx.from?.id;

        // Check user permission if whitelist is configured
        if (
          this.config.allowedTelegramUsers.length > 0 &&
          userId &&
          !this.config.allowedTelegramUsers.includes(userId)
        ) {
          await ctx.answerCallbackQuery({
            text: '⛔ Unauthorized: Your Telegram ID is not on the operator whitelist.',
            show_alert: true,
          });
          return;
        }

        if (data === 'cmd_status') {
          await ctx.answerCallbackQuery();
          await handleStatusCommand(ctx as any, this.store);
          return;
        }

        if (data === 'cmd_alerts') {
          await ctx.answerCallbackQuery();
          await handleAlertsCommand(ctx as any, this.store, this.config.webAppUrl);
          return;
        }

        if (data.startsWith('runbook:')) {
          const parts = data.split(':');
          const runbookId = parts[1];
          const serviceId = parts[2];

          try {
            const exec = this.checker.executeRunbook(runbookId, serviceId, fromUser, 'Triggered via Telegram Bot');
            await ctx.answerCallbackQuery({ text: `⚡ ${exec.output}`, show_alert: true });
            await ctx.reply(`✅ *Runbook Executed:* \`${runbookId}\`\nOutput: _${exec.output}_`, {
              parse_mode: 'Markdown',
            });
          } catch (err: any) {
            await ctx.answerCallbackQuery({ text: `Failed: ${err.message}`, show_alert: true });
          }
          return;
        }

        if (data.startsWith('silence:1h:')) {
          const serviceId = data.replace('silence:1h:', '');
          const service = this.store.getServiceById(serviceId);
          const until = Date.now() + 3600 * 1000;
          this.store.silenceService(serviceId, until);
          await ctx.answerCallbackQuery({ text: `🔕 Silenced ${service?.name || serviceId} for 1 hour.` });
          await ctx.reply(`🔕 *Silenced:* Alerts for \`${service?.name || serviceId}\` suppressed until 1 hour from now.`, {
            parse_mode: 'Markdown',
          });
          return;
        }

        if (data.startsWith('ack:')) {
          const incidentId = data.replace('ack:', '');
          this.store.updateIncidentStatus(incidentId, 'ACKNOWLEDGED', null, fromUser);
          await ctx.answerCallbackQuery({ text: 'Incident marked as Acknowledged.' });
          await ctx.reply(`👀 Incident \`${incidentId}\` acknowledged by @${fromUser}.`, {
            parse_mode: 'Markdown',
          });
          return;
        }

        await ctx.answerCallbackQuery();
      });

      // Hook checker incidents to broadcast to active chats
      this.checker.on('incidentCreated', async (incident) => {
        const service = this.store.getServiceById(incident.serviceId);
        // Do not broadcast if silenced
        if (service?.silencedUntil && service.silencedUntil > Date.now()) {
          return;
        }

        const alertText =
          `🚨 *ALERT: ${incident.title}*\n\n` +
          `Target: \`${service?.name || incident.serviceId}\`\n` +
          `Severity: \`${incident.severity}\`\n` +
          `Time: ${new Date(incident.startedAt).toLocaleTimeString()}\n` +
          (incident.errorDetails ? `Details: _${incident.errorDetails}_\n` : '');

        for (const chatId of this.registeredChats) {
          try {
            await this.bot?.api.sendMessage(chatId, alertText, {
              parse_mode: 'Markdown',
              reply_markup: createAlertTriageKeyboard(this.config.webAppUrl, incident.serviceId, incident.id),
            });
          } catch (e) {
            console.error(`Failed to send alert to chat ${chatId}:`, e);
          }
        }
      });

      // Start long polling runner
      this.runner = run(this.bot);
      console.log('🤖 Telegram Bot: Long polling runner started successfully.');
    } catch (err) {
      console.error('Failed to initialize Telegram Bot:', err);
    }
  }

  public async stop(): Promise<void> {
    if (this.runner && this.runner.isRunning()) {
      await this.runner.stop();
      console.log('🤖 Telegram Bot: Long polling runner stopped.');
    }
  }
}
