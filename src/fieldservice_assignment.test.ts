import assert from "node:assert/strict";
import { chooseAssignment } from "./fieldservice_assignment.ts";

assert.equal(chooseAssignment(false), "control");
assert.equal(chooseAssignment(true), "treatment");
console.log("assignment decision test passed");
