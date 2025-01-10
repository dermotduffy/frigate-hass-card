export const isCompanionApp = (userAgent: string): boolean => {
  return !!userAgent.match(/Home ?Assistant/);
};
