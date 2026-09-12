import "server-only";

export interface FirebaseServerEnv {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  webApiKey: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ortam değişkeni eksik.`);
  return value;
}

// Tüm Firebase yapılandırması yalnızca sunucuda okunur; tarayıcıya hiçbir değer gönderilmez.
// Servis hesabı anahtarı Vercel proje ayarlarında / yerel web/.env.local içinde tutulur, Git'e girmez.
export function readFirebaseServerEnv(): FirebaseServerEnv {
  return {
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    // Vercel/.env dosyalarında satır sonları "\n" olarak kaçırılmış olabilir.
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\n/g, "\n"),
    webApiKey: required("FIREBASE_WEB_API_KEY"),
  };
}
