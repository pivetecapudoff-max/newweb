type FarolDesktop = { app?: boolean };

export function isFarolDesktop(): boolean {
  return Boolean((window as Window & { farolDesktop?: FarolDesktop }).farolDesktop?.app);
}
