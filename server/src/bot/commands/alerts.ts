import { CommandContext, Context } from 'grammy';
import { MonitorStore } from '../../monitor/store.js';
import { createAlertTriageKeyboard } from '../keyboards/triageKeyboard.js';

export async function handleAlertsCommand(
  ctx: CommandContext<Context>,
  store: MonitorStore,
  webAppUrl: string
): Promise<void> {
  const openIncidents = store.getIncidents('OPEN');
  if (openIncidents.length === 0) {
    await ctx.reply('✅ *All clear!* No active open incidents across monitored clusters.', {
      parse_mode: 'Markdown',
    });
    return;
  }

  await ctx.reply(`🚨 *${openIncidents.length} Active Incident(s) Requiring Attention:*`, {
    parse_mode: 'Markdown',
  });

  for (const inc of openIncidents.slice(0, 3)) {
    const service = store.getServiceById(inc.serviceId);
    const text =
      `*${inc.title}*\n` +
      `Target: \`${service?.name || inc.serviceId}\`\n` +
      `Severity: \`${inc.severity}\`\n` +
      `Started: ${new Date(inc.startedAt).toLocaleTimeString()}\n` +
      (inc.errorDetails ? `Details: _${inc.errorDetails}_\n` : '');

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: createAlertTriageKeyboard(webAppUrl, inc.serviceId, inc.id),
    });
  }
}
