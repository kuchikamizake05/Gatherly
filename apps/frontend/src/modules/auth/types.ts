export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt: string;
};

export type Me = {
  user: User;
  organizerId: string | null;
  hasCommitteeAssignments: boolean;
  csrfToken: string;
};

/** Balasan register/login: kode OTP dikirim ke email. */
export type OtpChallenge = {
  challengeId: string;
  expiresAt: string;
  resendAt: string;
  emailMasked?: string;
};

export type RegisterInput = { name: string; email: string; password: string };
export type LoginInput = { email: string; password: string };
export type VerifyInput = { challengeId: string; code: string };
