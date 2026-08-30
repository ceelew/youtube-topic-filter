function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get YOUTUBE_API_KEY() {
    return required("YOUTUBE_API_KEY");
  },
  get ADMIN_PASSWORD_HASH() {
    return required("ADMIN_PASSWORD_HASH");
  },
  get SESSION_SECRET() {
    return required("SESSION_SECRET");
  },
  get CRON_SECRET() {
    return required("CRON_SECRET");
  },
};
