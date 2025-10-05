import cron from 'node-cron';

export function isValidCron(expr: string) {
  try {
    return cron.validate(expr);
  } catch {
    return false;
  }
}
