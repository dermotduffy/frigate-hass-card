export const isCompanionApp = (userAgent: string): boolean => {
  return !!userAgent.match(/Home ?Assistant/);
};

export const isAndroidCompanionApp = (userAgent: string): boolean => {
  return !!userAgent.match(/(?=.*Home ?Assistant)(?=.*Android)/);
};

export const isIOSCompanionApp = (userAgent: string): boolean => {
  return !!userAgent.match(/(?=.*Home ?Assistant)(?=.*iOS)/);
};
