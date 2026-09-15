import path from "node:path";
import type { NextConfig } from "next";

// web/ uygulaması, depo kökündeki çekirdek modülleri (src/domain.ts, src/discovery/parser.ts)
// doğrudan içe aktarır; bu yüzden Turbopack kökü ve dosya izleme kökü depo köküdür.
const repoRoot = path.resolve(typeof __dirname === "string" ? __dirname : process.cwd(), "..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  // firebase-admin yalnızca Node.js sunucu tarafında çalışır; paketlenmez, dış bağımlılık olarak yüklenir.
  serverExternalPackages: ["firebase-admin"],
  // CV yükleme (en fazla 4 MB dosya) sunucu eylemiyle yapılır; varsayılan 1 MB gövde sınırı yükseltilir.
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
