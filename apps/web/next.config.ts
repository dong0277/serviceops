import createNextIntlPlugin from "next-intl/plugin";
import type {NextConfig} from "next";
import path from "node:path";

const withNextIntl = createNextIntlPlugin();

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  poweredByHeader: false,
} satisfies NextConfig;

export default withNextIntl(nextConfig);
