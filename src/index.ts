import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runBookBot } from "./bots/book/graph.js";

async function main() {
  console.log("Book Recommendation Bot - type a request, or 'exit' to quit.\n");

  const rl = createInterface({ input: stdin, output: stdout });
  // One thread per REPL session, so follow-ups ("what about 4.24") can use
  // earlier turns via the graph's MemorySaver checkpointer.
  const threadId = randomUUID();

  while (true) {
    const query = (await rl.question("> ")).trim();
    if (!query || query.toLowerCase() === "exit") break;

    try {
      const result = await runBookBot(query, threadId);
      console.log(`\n${result.finalAnswer}\n`);
    } catch (err) {
      console.error("[ERROR]", (err as Error).message);
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
