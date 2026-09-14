const PHONE_PATTERN = /^[0-9]{8,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

export function isValidEmail(email: string): boolean {
  return !email || EMAIL_PATTERN.test(email);
}
