/* Logs configuration problems at startup. The layout shows them on a setup page instead of crashing every page. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { envProblems } = await import("./server/env");
    const problems = envProblems();
    if (problems.length) console.error("Visible is not configured:\n- " + problems.join("\n- "));
  }
}
