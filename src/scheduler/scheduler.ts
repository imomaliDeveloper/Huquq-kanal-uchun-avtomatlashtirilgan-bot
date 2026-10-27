import cron from 'node-cron';
import { env } from '../config/env';
import { repository } from '../database/schema';
import { agent } from '../agent/agent';
import { logger } from '../utils/logger';
import { publishDailyStatsToChannels } from '../bot/monitoring';

export class SchedulerManager {
  private currentTask: cron.ScheduledTask | null = null;
  private dailyStatsTask: cron.ScheduledTask | null = null;

  async start(): Promise<void> {
    await this.syncScheduleFromDb();
    await this.syncDailyStatsScheduleFromDb();
  }

  async isQuietHours(): Promise<boolean> {
    const quietEnabledStr = await repository.getSetting('quiet_hours_enabled', String(env.QUIET_HOURS_ENABLED));
    if (quietEnabledStr.toLowerCase() !== 'true') {
      return false;
    }

    const startHour = parseInt(await repository.getSetting('quiet_hours_start', String(env.QUIET_HOURS_START)), 10) || 23;
    const endHour = parseInt(await repository.getSetting('quiet_hours_end', String(env.QUIET_HOURS_END)), 10) || 7;

    // Get current hour in Tashkent Timezone
    const nowTashkent = new Date(new Date().toLocaleString('en-US', { timeZone: env.TIMEZONE }));
    const currentHour = nowTashkent.getHours();

    if (startHour > endHour) {
      // Overnight range, e.g. 23:00 to 07:00
      return currentHour >= startHour || currentHour < endHour;
    } else {
      // Same day range, e.g. 01:00 to 06:00
      return currentHour >= startHour && currentHour < endHour;
    }
  }

  async syncScheduleFromDb(): Promise<void> {
    const autoEnabledStr = await repository.getSetting('auto_post_enabled', String(env.AUTO_POST));
    const intervalMinutesStr = await repository.getSetting('post_interval_minutes', '');
    const peakModeStr = await repository.getSetting('peak_hours_mode', String(env.PEAK_HOURS_MODE));

    const isEnabled = autoEnabledStr.toLowerCase() === 'true';
    const isPeakMode = peakModeStr.toLowerCase() === 'true';

    let intervalMinutes = parseInt(intervalMinutesStr, 10);
    if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
      const intervalHoursStr = await repository.getSetting('post_interval_hours', String(env.POST_INTERVAL_HOURS));
      const intervalHours = parseFloat(intervalHoursStr) || 1.0;
      intervalMinutes = Math.round(intervalHours * 60);
    }

    if (this.currentTask) {
      this.currentTask.stop();
      this.currentTask = null;
      logger.info('Stopped previous cron schedule.');
    }

    if (!isEnabled) {
      logger.info('Auto posting is currently DISABLED.');
      return;
    }

    let cronExpression = '0 * * * *'; // Default every hour

    if (isPeakMode) {
      // Peak Activity Hours (09:00, 13:00, 18:00, 21:00 Tashkent time)
      cronExpression = '0 9,13,18,21 * * *';
      logger.info('Scheduling node-cron PEAK HOURS MODE: 09:00, 13:00, 18:00, 21:00 Tashkent time');
    } else {
      // Minute-based or Hour-based interval schedules
      if (intervalMinutes === 1) {
        cronExpression = '* * * * *';
      } else if (intervalMinutes < 60) {
        cronExpression = `*/${intervalMinutes} * * * *`;
      } else {
        const hours = Math.round(intervalMinutes / 60);
        if (hours === 1) cronExpression = '0 * * * *';
        else if (hours === 24) cronExpression = '0 0 * * *';
        else cronExpression = `0 */${hours} * * *`;
      }

      logger.info(`Scheduling node-cron auto-post task: expression '${cronExpression}' (Every ${intervalMinutes} minutes)`);
    }

    this.currentTask = cron.schedule(
      cronExpression,
      async () => {
        logger.info('node-cron triggered auto post task execution...');

        // Check Night Quiet Hours Guard
        const inQuietHours = await this.isQuietHours();
        if (inQuietHours) {
          logger.info('🌙 Night Quiet Hours active (23:00 - 07:00 Tashkent time). Auto post skipped to avoid disturbing subscribers.');
          return;
        }

        try {
          const res = await agent.runPipeline({ isAuto: true });
          logger.info(`Scheduled auto post execution completed: ${res.message}`);
        } catch (error) {
          logger.error(`Error during scheduled auto post execution: ${(error as Error).message}`);
        }
      },
      {
        timezone: env.TIMEZONE,
      }
    );
  }

  // --- Daily Student Statistics Cron Schedule ---
  async syncDailyStatsScheduleFromDb(): Promise<void> {
    const dailyEnabledStr = await repository.getSetting('daily_stats_enabled', 'true');
    const isDailyEnabled = dailyEnabledStr.toLowerCase() === 'true';

    if (this.dailyStatsTask) {
      this.dailyStatsTask.stop();
      this.dailyStatsTask = null;
    }

    if (!isDailyEnabled) {
      logger.info('Daily student statistics auto-post is DISABLED.');
      return;
    }

    // Twice daily: Lunch time (13:00) and Evening (21:00) Tashkent time
    const cronExpr = '0 13,21 * * *';
    logger.info(`Scheduling Twice-Daily Student Statistics post at 13:00 (Lunch) & 21:00 (Evening) (${cronExpr}) in ${env.TIMEZONE}`);

    this.dailyStatsTask = cron.schedule(
      cronExpr,
      async () => {
        logger.info('node-cron triggered Twice-Daily Student Statistics posting...');
        try {
          const result = await publishDailyStatsToChannels();
          logger.info(`Student Statistics publish result: ${result.summary}`);
        } catch (err: any) {
          logger.error(`Error publishing student statistics: ${err?.message || err}`);
        }
      },
      {
        timezone: env.TIMEZONE,
      }
    );
  }

  async setDailyStatsStatus(enabled: boolean): Promise<void> {
    await repository.setSetting('daily_stats_enabled', String(enabled));
    await this.syncDailyStatsScheduleFromDb();
  }

  async setIntervalMinutes(minutes: number): Promise<void> {
    await repository.setSetting('post_interval_minutes', String(minutes));
    await repository.setSetting('post_interval_hours', String((minutes / 60).toFixed(2)));
    await repository.setSetting('peak_hours_mode', 'false');
    await this.syncScheduleFromDb();
  }

  async setInterval(hours: number): Promise<void> {
    await this.setIntervalMinutes(Math.round(hours * 60));
  }

  async setAutoStatus(enabled: boolean): Promise<void> {
    await repository.setSetting('auto_post_enabled', String(enabled));
    await this.syncScheduleFromDb();
  }

  async setQuietHoursStatus(enabled: boolean): Promise<void> {
    await repository.setSetting('quiet_hours_enabled', String(enabled));
  }

  async setPeakHoursMode(enabled: boolean): Promise<void> {
    await repository.setSetting('peak_hours_mode', String(enabled));
    await this.syncScheduleFromDb();
  }
}

export const scheduler = new SchedulerManager();
