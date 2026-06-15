import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // only needs Node + that folder, not the whole node_modules tree.
  output: "standalone",
  // Load these as normal Node modules instead of bundling them — better-auth's
  // database adapter (kysely/pg) doesn't bundle cleanly under Turbopack.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/kysely-adapter",
    "kysely",
    "pg",
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
};

export default nextConfig;
