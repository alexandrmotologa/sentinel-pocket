import { CommandContext, Context } from 'grammy';
import { MonitorStore } from '../../monitor/store.js';

export async function handleStatusCommand(ctx: CommandContext<Context>, store: MonitorStore): Promise<void> {
  const services = store.getServices();
  if (services.length === 0) {
    await ctx.reply('No services currently monitored in database.');
    return;
  }

  const healthyCount = services.filter((s) => s.status === 'HEALTHY').length;
  const degradedCount = services.filter((s) => s.status === 'DEGRADED').length;
  const downCount = services.filter((s) => s.status === 'DOWN').length;

  let report = `📊 *Cluster Status Overview*\n\n`;
  report += `Health: ${healthyCount}/${services.length} Healthy`;
  if (degradedCount > 0) report += ` | ⚠️ ${degradedCount} Degraded`;
  if (downCount > 0) report += ` | 🚨 ${downCount} Down`;
  report += `\n\n`;

  for (const s of services) {
    const icon = s.status === 'HEALTHY' ? '🟢' : s.status === 'DEGRADED' ? '🟡' : '🔴';
    report += `${icon} *${s.name}*\n`;
    report += `   Status: \`${s.status}\` | P95: \`${s.latencyP95}ms\`\n`;
    if (s.silencedUntil && s.silencedUntil > Date.now()) {
      report += `   🔕 Silenced until ${new Date(s.silencedUntil).toLocaleTimeString()}\n`;
    }
  }

  await ctx.reply(report, { parse_mode: 'Markdown' });
}
