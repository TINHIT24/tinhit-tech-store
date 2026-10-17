import crypto from 'crypto';

/**
 * Generate a cryptographically secure 6-digit OTP code
 */
export const generateOtp = (): string => {
  const number = crypto.randomInt(100000, 999999);
  return number.toString();
};
