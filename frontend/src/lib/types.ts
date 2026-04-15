
export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export type User = {
  id: number;
  email: string;
  full_name?: string;
  subscription_status?: string;
  role?: string;
};

export type Phase1Recommendation = {
  title: string;
  why: string;
  priority: string;
  action: string;
};
