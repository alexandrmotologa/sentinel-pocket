import { InlineKeyboard } from 'grammy';

export function createWelcomeKeyboard(webAppUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('⚡ Launch Sentinel Pocket', webAppUrl)
    .row()
    .text('📊 Cluster Status', 'cmd_status')
    .text('🚨 Active Alerts', 'cmd_alerts');
}

export function createAlertTriageKeyboard(webAppUrl: string, serviceId: string, incidentId: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp('🔍 Open Incident Cockpit', `${webAppUrl}?incident=${incidentId}`)
    .row()
    .text('🔄 Restart Container', `runbook:restart_container:${serviceId}`)
    .text('⏪ Rollback Canary', `runbook:rollback_canary:${serviceId}`)
    .row()
    .text('🔕 Silence 1 Hour', `silence:1h:${serviceId}`)
    .text('✅ Acknowledge', `ack:${incidentId}`);
}
