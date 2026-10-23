/* The three agents: names and copy shared by the homepage and the result page. */
export const ICON: Record<string, React.ReactNode> = {
  geo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><path d="M9.5 9.6l1.6 1.6 3.4-3.4" /></svg>,
  seo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.6-4.6" /><path d="M8 11.5l1.8-2 1.7 1.5 2-2.5" /></svg>,
  social: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></svg>,
};

export const AGENTS = [
  { id: "geo", name: "GEO agent", role: "Gets you recommended by AI", what: "Collects your real Google reviews, builds a review block for your website, and writes the business details, FAQ and AI summary file that AI assistants read.", does: ["Collects your real Google reviews", "Review block to paste on your site, with links", "Business details for AI (schema), FAQ and llms.txt"] },
  { id: "seo", name: "SEO agent", role: "Gets you found in Google", what: "Looks up what people in your area really type into Google, and writes a blog for the search you pick, from your own website.", does: ["Real Google search suggestions from your area", "A ready-to-post blog for the search you pick", "Page title and description that get clicks"] },
  { id: "social", name: "Social agent", role: "Turns reviews into posts", what: "Picks your best reviews and turns them into Instagram and TikTok posts: the image and the caption.", does: ["Post images made from real reviews", "Caption and hashtags in your customers' language", "Download and post, in under a minute"] },
] as const;

