import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const bundled = fileURLToPath(new URL("../.runtime/ollama/ollama", import.meta.url));
const useBundled = existsSync(bundled);
const args = process.argv.slice(2);
if (!(args.length === 1 && args[0] === "serve") &&
    !(args.length === 2 && args[0] === "pull" && args[1] === "qwen3:4b")) {
  console.error("Use npm run ai or npm run model:pull.");
  process.exit(1);
}
const child = spawn(useBundled ? bundled : "ollama", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    OLLAMA_HOST: "127.0.0.1:11434",
    OLLAMA_NO_CLOUD: "1",
    OLLAMA_KEEP_ALIVE: "2m",
    ...(useBundled ? {
      OLLAMA_MODELS: fileURLToPath(new URL("../.runtime/models", import.meta.url)),
    } : {}),
  },
});
child.on("error", () => {
  console.error("Ollama was not found. Install it from https://ollama.com/download first.");
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
