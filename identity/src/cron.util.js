import cron from 'node-cron';
export function isValidCron(expr) {
    try {
        return cron.validate(expr);
    }
    catch {
        return false;
    }
}
