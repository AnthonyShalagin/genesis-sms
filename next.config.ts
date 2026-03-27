import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "nodemailer", "bluelinky", "better-sqlite3"],
};

export default nextConfig;
