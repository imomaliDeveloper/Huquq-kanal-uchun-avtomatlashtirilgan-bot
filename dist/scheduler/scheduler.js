"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduler = exports.SchedulerManager = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("../config/env");
const schema_1 = require("../database/schema");
const agent_1 = require("../agent/agent");
const logger_1 = require("../utils/logger");
class SchedulerManager {
    currentTask = null;
    async start() {
        await this.syncScheduleFromDb();
    }
    async isQuietHours() {
        const quietEnabledStr = await schema_1.repository.getSetting('quiet_hours_enabled', String(env_1.env.QUIET_HOURS_ENABLED));
        if (quietEnabledStr.toLowerCase() !== 'true') {
            return false;
        }
        const startHour = parseInt(await schema_1.repository.getSetting('quiet_hours_start', String(env_1.env.QUIET_HOURS_START)), 10) || 23;
        const endHour = parseInt(await schema_1.repository.getSetting('quiet_hours_end', String(env_1.env.QUIET_HOURS_END)), 10) || 7;
        // Get current hour in Tashkent Timezone
        const nowTashkent = new Date(new Date().toLocaleString('en-US', { timeZone: env_1.env.TIMEZONE }));
        const currentHour = nowTashkent.getHours();
        if (startHour > endHour) {
            // Overnight range, e.g. 23:00 to 07:00
            return currentHour >= startHour || currentHour < endHour;
        }
        else {
            // Same day range, e.g. 01:00 to 06:00
            return currentHour >= startHour && currentHour < endHour;
        }
    }
    async syncScheduleFromDb() {
        const autoEnabledStr = await schema_1.repository.getSetting('auto_post_enabled', String(env_1.env.AUTO_POST));
        const intervalHoursStr = await schema_1.repository.getSetting('post_interval_hours', String(env_1.env.POST_INTERVAL_HOURS));
        const peakModeStr = await schema_1.repository.getSetting('peak_hours_mode', String(env_1.env.PEAK_HOURS_MODE));
        const isEnabled = autoEnabledStr.toLowerCase() === 'true';
        const isPeakMode = peakModeStr.toLowerCase() === 'true';
        const intervalHours = parseFloat(intervalHoursStr) || 1.0;
        if (this.currentTask) {
            this.currentTask.stop();
            this.currentTask = null;
            logger_1.logger.info('Stopped previous cron schedule.');
        }
        if (!isEnabled) {
            logger_1.logger.info('Auto posting is currently DISABLED.');
            return;
        }
        let cronExpression = '0 * * * *'; // Default every hour
        if (isPeakMode) {
            // Peak Activity Hours (09:00, 13:00, 18:00, 21:00 Tashkent time)
            cronExpression = '0 9,13,18,21 * * *';
            logger_1.logger.info('Scheduling node-cron PEAK HOURS MODE: 09:00, 13:00, 18:00, 21:00 Tashkent time');
        }
        else {
            // Standard interval schedules
            if (intervalHours === 0.5)
                cronExpression = '*/30 * * * *';
            else if (intervalHours === 1.0)
                cronExpression = '0 * * * *';
            else if (intervalHours === 2.0)
                cronExpression = '0 */2 * * *';
            else if (intervalHours === 3.0)
                cronExpression = '0 */3 * * *';
            else if (intervalHours === 6.0)
                cronExpression = '0 */6 * * *';
            else if (intervalHours === 12.0)
                cronExpression = '0 */12 * * *';
            else if (intervalHours === 24.0)
                cronExpression = '0 0 * * *';
            logger_1.logger.info(`Scheduling node-cron auto-post task: expression '${cronExpression}' (Every ${intervalHours} hours)`);
        }
        this.currentTask = node_cron_1.default.schedule(cronExpression, async () => {
            logger_1.logger.info('node-cron triggered auto post task execution...');
            // Check Night Quiet Hours Guard
            const inQuietHours = await this.isQuietHours();
            if (inQuietHours) {
                logger_1.logger.info('🌙 Night Quiet Hours active (23:00 - 07:00 Tashkent time). Auto post skipped to avoid disturbing subscribers.');
                return;
            }
            try {
                const res = await agent_1.agent.runPipeline({ isAuto: true });
                logger_1.logger.info(`Scheduled auto post execution completed: ${res.message}`);
            }
            catch (error) {
                logger_1.logger.error(`Error during scheduled auto post execution: ${error.message}`);
            }
        }, {
            timezone: env_1.env.TIMEZONE,
        });
    }
    async setInterval(hours) {
        await schema_1.repository.setSetting('post_interval_hours', String(hours));
        await schema_1.repository.setSetting('peak_hours_mode', 'false');
        await this.syncScheduleFromDb();
    }
    async setAutoStatus(enabled) {
        await schema_1.repository.setSetting('auto_post_enabled', String(enabled));
        await this.syncScheduleFromDb();
    }
    async setQuietHoursStatus(enabled) {
        await schema_1.repository.setSetting('quiet_hours_enabled', String(enabled));
    }
    async setPeakHoursMode(enabled) {
        await schema_1.repository.setSetting('peak_hours_mode', String(enabled));
        await this.syncScheduleFromDb();
    }
}
exports.SchedulerManager = SchedulerManager;
exports.scheduler = new SchedulerManager();
