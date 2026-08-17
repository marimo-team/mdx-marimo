import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { antiSlopPluginRules } from "../index.ts";
import { antiSlopRules } from "../preset.ts";

describe("anti-slop catalog", () => {
  test("enables every registered rule at error severity", () => {
    assert.deepEqual(
      Object.keys(antiSlopRules).sort(),
      Object.keys(antiSlopPluginRules)
        .map((name) => `anti-slop/${name}`)
        .sort(),
    );
    assert.deepEqual(new Set(Object.values(antiSlopRules)), new Set(["error"]));
  });
});
