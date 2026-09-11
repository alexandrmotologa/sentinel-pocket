import { CommandContext, Context } from 'grammy';

export async function handleHelpCommand(ctx: CommandContext<Context>): Promise<void> {
  const helpText =
    `🛡️ *Sentinel Pocket Command Reference*\n\n` +
    `/start - Launch interactive cockpit button\n` +
    `/status - High-level cluster health and latency report\n` +
    `/alerts - View unacknowledged incidents with triage actions\n` +
    `/help - Display this command help guide\n\n` +
    `*Remediation Capabilities:*\n` +
    `When an alert arrives, use the inline buttons to restart the container, execute a CanaryMesh rollback, or silence notifications.`;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
}
