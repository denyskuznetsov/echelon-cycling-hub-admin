import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSafeInternalNext, safeInternalNext } from "./utils/auth/safe-internal-next.ts";

test("safe internal next preserves paths and query state", () => {
  assert.equal(safeInternalNext("/dashboard?period=today&order=abc"), "/dashboard?period=today&order=abc");
});

test("unsafe or malformed destinations fall back to the trusted role route", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "\n/dashboard", "dashboard"]) {
    assert.equal(resolveSafeInternalNext(value, "/dashboard"), "/dashboard");
  }
});
