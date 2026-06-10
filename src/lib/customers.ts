"use server";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/server";
import { withAuth } from "@/src/utils/auth/with-auth";
import type {
  CustomerOption,
  CreateCustomerInput,
  CreateCustomerResult,
  SearchCustomersResult,
} from "./customers-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d][\d\s()+\-./]{6,}\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const createCustomer = withAuth("createCustomer", createCustomerAction);

async function createCustomerAction(
  _user: User,
  input: CreateCustomerInput,
): Promise<CreateCustomerResult> {
  const name = input.name?.trim();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  const email = input.email?.trim() ? input.email.trim() : null;
  if (email && !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Email is not a valid email address." };
  }

  const phone = input.phone?.trim() ? input.phone.trim() : null;
  if (phone && !PHONE_PATTERN.test(phone)) {
    return { ok: false, error: "Phone number format is invalid." };
  }

  const birthday = input.birthday?.trim() ? input.birthday.trim() : null;
  if (birthday && !ISO_DATE_PATTERN.test(birthday)) {
    return { ok: false, error: "Birthday must be in YYYY-MM-DD format." };
  }

  const sex = input.sex;
  if (sex !== null && sex !== "male" && sex !== "female") {
    return { ok: false, error: "Sex must be male, female, or unspecified." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      booqable_customer_id: null,
      name,
      email,
      phone,
      birthday,
      sex,
    })
    .select("id, name, email, phone")
    .single();

  if (error) {
    console.error("createCustomer:", error);
    return {
      ok: false,
      error: "Could not create customer. Please try again.",
    };
  }

  return {
    ok: true,
    customer: {
      id: data.id as string,
      name: (data.name as string | null)?.trim() || name,
      email: data.email as string | null,
      phone: data.phone as string | null,
    },
  };
}

const SEARCH_LIMIT = 20;

export const searchCustomers = withAuth(
  "searchCustomers",
  searchCustomersAction,
);

async function searchCustomersAction(
  _user: User,
  query: string,
): Promise<SearchCustomersResult> {
  const supabase = await createClient();
  const trimmed = query.trim();

  let dbQuery = supabase
    .from("customers")
    .select("id, name, email, phone")
    .order("name", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (trimmed) {
    const escaped = trimmed.replace(/[,()]/g, "");
    dbQuery = dbQuery.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("searchCustomers:", error);
    return { customers: [], error: error.message };
  }

  const customers: CustomerOption[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null)?.trim() || "Unknown",
    email: row.email as string | null,
    phone: row.phone as string | null,
  }));

  return { customers, error: null };
}
