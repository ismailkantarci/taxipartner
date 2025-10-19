export const cx = (...classes: Array<string | null | false | undefined>) =>
  classes.filter(Boolean).join(' ');
