/* Plans and prices. Change prices here; Stripe price IDs come from the environment. Pure (client + server). */

export type PlanId = "free" | "starter" | "growth" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceEur: number;
  businesses: number;
  questions: number;
  /** Pages that win, written per business per calendar month. */
  pages: number;
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
    pages: 0,
    cadence: "once",
    blurb: "See where you stand.",
    features: ["Your AI visibility score", "5 real customer questions, won or lost", "Your top 3 competitors", "Your biggest fixes"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceEur: 19,
    businesses: 1,
    questions: 10,
    pages: 0,
    cadence: "weekly",
    blurb: "Keep an eye on it every week.",
    features: ["10 customer questions", "Weekly check", "Full scoreboard: every question, won or lost", "Every AI answer and competitor", "Full fix list"],
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceEur: 29,
    businesses: 1,
    questions: 20,
    pages: 4,
    cadence: "daily",
    blurb: "Win the questions you're losing.",
    features: ["20 customer questions, daily", "4 pages that win a month, published for you", "GEO, SEO and Social agents", "Everything in Starter"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceEur: 49,
    businesses: 3,
    questions: 20,
    pages: 12,
    cadence: "daily",
    blurb: "For more than one location.",
    features: ["3 businesses", "12 pages that win a month, per business", "All agents for each", "Everything in Growth"],
  },
};

export const PAID: PlanId[] = ["starter", "growth", "pro"];
export const isPaid = (p?: PlanId) => !!p && p !== "free";
