export interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CreateCustomerInput {
  name: string;
  email: string | null;
  phone: string | null;
  /** ISO YYYY-MM-DD, or null. */
  birthday: string | null;
  sex: "male" | "female" | null;
}

export type CreateCustomerResult =
  | { ok: true; customer: CustomerOption }
  | { ok: false; error: string };
