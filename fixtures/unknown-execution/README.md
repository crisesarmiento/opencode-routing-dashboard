# unknown-execution fixture

Synthetic data (fictional IDs, no real prompts): Jev records a route suggestion for each message, but no record carries an executing model. Use it to see the honest "unknown / not available" path: `ORD_STATE_DIR=fixtures/unknown-execution ORD_DEMO=true bun run dev`. The `model` field in observe records is the classifier model, not the executor.
