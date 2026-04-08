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
