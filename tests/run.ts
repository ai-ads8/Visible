/* Offline tests: no network, no paid calls. Run with `npm test`. */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { blockedBots } from "../lib/engine/readiness";
import { detectMention, sameBusiness } from "../lib/engine/mentions";
import { splitBusinesses } from "../lib/engine/ai";
import { buildQuestions } from "../lib/engine/questions";
import { verifyStripe } from "../lib/billing";
import { clampQuestions, HARD_MAX_QUESTIONS } from "../lib/guard";
import { parsePage } from "../lib/engine/extract";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log("ok", name);
};

t("robots: wildcard block blocks every AI bot", () => assert.equal(blockedBots("User-agent: *\nDisallow: /").length, 7));
t("robots: GPTBot-only block", () => assert.deepEqual(blockedBots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /"), ["GPTBot"]));
t("robots: partial disallow is not a block", () => assert.deepEqual(blockedBots("User-agent: *\nDisallow: /admin"), []));
t("robots: own group overrides wildcard", () => assert.deepEqual(blockedBots("User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /").includes("OAI-SearchBot"), false));

t("names: legal forms ignored", () => assert.ok(sameBusiness("Lakeside Dental Studio LLC", "Lakeside Dental Studio")));
t("names: different businesses differ", () => assert.ok(!sameBusiness("Lakeside Dental", "Riverside Dental")));
t("mention: named in list with position", () => {
  const m = detectMention({ name: "Lakeside Dental Studio", domain: "lakeside.com" }, { text: "x", sources: [], businesses: [{ name: "A" }, { name: "Lakeside Dental Studio" }] });
  assert.deepEqual(m, { mention: "named", position: 2 });
});
t("mention: only in sources = linked", () => {
  const m = detectMention({ name: "Lakeside", domain: "lakeside.com" }, { text: "Try Oak Dental.", sources: ["https://www.lakeside.com/x"], businesses: [] });
  assert.equal(m.mention, "linked");
});
t("mention: absent", () => assert.equal(detectMention({ name: "Lakeside Dental", domain: "lakeside.com" }, { text: "Try Oak Dental.", sources: [], businesses: [{ name: "Oak Dental" }] }).mention, "absent"));

t("answer: business line is split off", () => {
  const r = splitBusinesses('Go to Oak.\n@@BUSINESSES [{"name":"Oak Dental","website":"oak.com"}]');
  assert.equal(r.text, "Go to Oak.");
  assert.deepEqual(r.businesses, [{ name: "Oak Dental", website: "oak.com" }]);
});
t("answer: broken list is ignored, text kept", () => assert.deepEqual(splitBusinesses("Hi\n@@BUSINESSES [oops"), { text: "Hi", businesses: [] }));

t("questions: never more than 20, never name the business, stable ids", () => {
  const p = { name: "Lakeside", website: "", domain: "", category: "dentist", service: "whitening", city: "Austin", country: "US", reach: "local" as const, confirmed: true };
  const a = buildQuestions(p, 99);
  assert.ok(a.length <= 20 && a.length >= 10);
  assert.ok(a.every((q) => !q.text.includes("Lakeside")));
  assert.deepEqual(a.map((q) => q.id), buildQuestions(p, 99).map((q) => q.id));
});
t("guard: hard cap of 20 questions", () => {
  assert.equal(HARD_MAX_QUESTIONS, 20);
  assert.equal(clampQuestions(500), 20);
  assert.equal(clampQuestions(0), 1);
});

t("stripe: valid signature accepted, tampered rejected", () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_1"}';
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  assert.ok(verifyStripe(payload, `t=${ts},v1=${sig}`, secret));
  assert.ok(!verifyStripe(payload + " ", `t=${ts},v1=${sig}`, secret));
  assert.ok(!verifyStripe(payload, `t=${ts - 3600},v1=${createHmac("sha256", secret).update(`${ts - 3600}.${payload}`).digest("hex")}`, secret));
});

t("extract: page facts", () => {
  const p = parsePage("https://x.com/contact", 200, '<html lang="en"><title>Contact</title><h1>Hi</h1><p>Do you deliver?</p><a href="tel:1">c</a><script type="application/ld+json">{"@type":"Dentist","name":"X"}</script></html>');
  assert.equal(p.kind, "contact");
  assert.equal(p.jsonld[0]["@type"], "Dentist");
  assert.ok(p.questions.includes("Do you deliver?"));
});

console.log(`\n${n} tests passed`);
