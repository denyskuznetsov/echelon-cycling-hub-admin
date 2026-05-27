export function validatePassword(password: string): {
  isValid: boolean;
  errorMessage: string;
} {
  if (password.length < 6) {
    return {
      isValid: false,
      errorMessage: "Password must be at least 6 characters long.",
    };
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    return {
      isValid: false,
      errorMessage: "Password must include at least one uppercase letter.",
    };
  }

  if (!/(?=.*[^a-zA-Z0-9])/.test(password)) {
    return {
      isValid: false,
      errorMessage: "Password must include at least one special symbol.",
    };
  }

  return {
    isValid: true,
    errorMessage: "",
  };
}

const UNSAFE_TEXT_PATTERN =
  /<[^>]*>|javascript:|data:text\/html|on[a-z]+\s*=|<\/script/i;

export const SAFE_TEXT_VALIDATION_MESSAGE =
  "This field contains unsupported content.";

/** Rejects common HTML/script injection patterns in free-text inputs. */
export function validateSafeText(value: unknown): true | string {
  if (typeof value !== "string" || !value.trim()) return true;
  return UNSAFE_TEXT_PATTERN.test(value) ? SAFE_TEXT_VALIDATION_MESSAGE : true;
}

export const safeTextFieldRules = {
  validate: validateSafeText,
} as const;
