import assert from "node:assert/strict";
import test from "node:test";
import { inspectAccessoryFile } from "./ugcAccessory.js";

const rbxmx = Buffer.from(`<?xml version="1.0"?>
<roblox version="4">
  <Item class="Accessory">
    <Properties>
      <token name="AccessoryType">Hair</token>
      <string name="Name">My Hair</string>
    </Properties>
  </Item>
</roblox>`);

test("reads AccessoryType from rbxmx", () => {
  const inspected = inspectAccessoryFile(rbxmx, "my-hair.rbxmx");
  assert.equal(inspected.format, "rbxmx");
  assert.equal(inspected.accessoryType, "Hair");
  assert.equal(inspected.suggestedName, "my hair");
});

test("rejects mesh-only files", () => {
  assert.throws(
    () => inspectAccessoryFile(Buffer.from("solid"), "hat.obj"),
    /Accessory Fitting Tool/
  );
});

test("rejects models without Accessory", () => {
  const model = Buffer.from(`<roblox><Item class="Model"></Item></roblox>`);
  assert.throws(() => inspectAccessoryFile(model, "prop.rbxmx"), /não é um Accessory/);
});
