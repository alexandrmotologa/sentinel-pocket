import { LatencyTick, Service, SloMetrics } from '../types.js';

export class SloCalculator {
  private static readonly TARGET_UPTIME = 99.9; // 99.9% Three Nines
  private static readonly TOTAL_BUDGET_MINUTES_30D = 43.2; // 30 days * 24h * 60m * 0.1%

  public static calculate(service: Service, recentTicks: LatencyTick[]): SloMetrics {
    const totalChecks = Math.max(recentTicks.length, 1);
    const failedChecks = recentTicks.filter(
      (t) => (t.statusCode && t.statusCode >= 500) || t.latencyMs > 2000
    ).length;

    const actualUptime = Math.max(0, ((totalChecks - failedChecks) / totalChecks) * 100);

    // Approximate downtime in minutes based on check intervals (~4s per tick)
    const downtimeMinutes = (failedChecks * 4) / 60;
    const remainingBudget = Math.max(0, this.TOTAL_BUDGET_MINUTES_30D - downtimeMinutes);
    const budgetDepleted = Math.min(
      100,
      ((this.TOTAL_BUDGET_MINUTES_30D - remainingBudget) / this.TOTAL_BUDGET_MINUTES_30D) * 100
    );

    // Burn rate calculation:
    // 1x = standard nominal rate
    // 14.4x = consumes 100% of 30-day budget in 2 days
    let burnRateMultiplier = 1.0;
    if (service.status === 'DOWN') {
      burnRateMultiplier = 14.4;
    } else if (service.status === 'DEGRADED') {
      burnRateMultiplier = 4.2;
    }

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (burnRateMultiplier >= 10 || budgetDepleted > 80) {
      status = 'CRITICAL';
    } else if (burnRateMultiplier > 2 || budgetDepleted > 40) {
      status = 'WARNING';
    }

    return {
      serviceId: service.id,
      uptimeTarget: this.TARGET_UPTIME,
      actualUptimePercentage: Number(actualUptime.toFixed(3)),
      totalChecks,
      failedChecks,
      totalErrorBudgetMinutes: this.TOTAL_BUDGET_MINUTES_30D,
      remainingBudgetMinutes: Number(remainingBudget.toFixed(1)),
      budgetDepletedPercentage: Number(budgetDepleted.toFixed(1)),
      burnRateMultiplier,
      status,
    };
  }
}
