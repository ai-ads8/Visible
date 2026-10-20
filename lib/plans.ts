/* Plans and prices. Change prices here; Stripe price IDs come from the environment. Pure (client + server). */

export type PlanId = "free" | "starter" | "growth" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceEur: number;
  businesses: number;
  questions: number;
  /** How often an official check may run per business. */
  cadence: "once" | "weekly" | "daily";
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free scan",
    priceEur: 0,
    businesses: 1,
    questions: 5,
    cadence: "once",
    blurb: "See where you stand.",
    features: ["Your AI visibility score", "5 real customer questions", "Your top 3 competitors", "Your biggest fix"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceEur: 19,
    businesses: 1,
    questions: 10,
    cadence: "weekly",
    blurb: "Keep an eye on it every week.",
    features: ["10 customer questions", "Weekly check", "Every AI answer, in full", "All competitors", "Full fix list"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceEur: 29,
    businesses: 1,
    questions: 20,
    cadence: "daily",
    blurb: "For owners who want to win.",
    features: ["20 customer questions", "Daily check", "Everything in Starter", "Progress chart", "Edit your questions"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceEur: 49,
    businesses: 3,
    questions: 20,
    cadence: "daily",
    blurb: "For more than one location.",
    features: ["3 businesses", "20 questions each", "Daily check", "Everything in Growth"],
  },
};

export const PAID: PlanId[] = ["starter", "growth", "pro"];
export const isPaid = (p?: PlanId) => !!p && p !== "free";
