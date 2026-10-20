/* Validates the configuration when the server starts, so a missing secret stops the app instead of failing later. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("./server/env");
    env();
  }
}
