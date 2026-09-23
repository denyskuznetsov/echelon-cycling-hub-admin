import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafeExternalLink, resolveDeliveryDestination } from "./lib/delivery.ts";

test("delivery destination prefers a nonblank address, then a maps link", () => {
  assert.deepEqual(
    resolveDeliveryDestination("  12 Cycling Way  ", "https://maps.example.test/fallback"),
    { kind: "address", value: "12 Cycling Way" },
  );
  assert.deepEqual(
    resolveDeliveryDestination("  ", " https://maps.example.test/fallback "),
    { kind: "maps", value: "https://maps.example.test/fallback" },
  );
  assert.deepEqual(resolveDeliveryDestination(" ", null), { kind: "missing", value: null });
  assert.deepEqual(resolveDeliveryDestination("\t\n\r\f\v", "\tMap link\v"), { kind: "maps", value: "Map link" });
  assert.deepEqual(resolveDeliveryDestination("\u00a0", "Fallback"), { kind: "address", value: "\u00a0" });
  assert.deepEqual(resolveDeliveryDestination(" \u00a0 ", "Fallback"), { kind: "address", value: "\u00a0" });
});

test("only HTTP(S) map destinations become external drawer links", () => {
  assert.equal(isSafeExternalLink("https://maps.example.test/destination"), true);
  assert.equal(isSafeExternalLink("javascript:alert(1)"), false);
});
