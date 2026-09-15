import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const APP_NAME = "job-discovery-cli";

// CLI, web ile aynı servis hesabı ortam değişkenlerini kullanır (.env.local; Git dışıdır).
export function loadFirebaseAdminConfig(env: NodeJS.ProcessEnv = process.env): FirebaseAdminConfig {
  const read = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} ortam değişkeni eksik (Firestore deposu için gerekli).`);
    return value;
  };
  return {
    projectId: read("FIREBASE_PROJECT_ID"),
    clientEmail: read("FIREBASE_CLIENT_EMAIL"),
    // .env dosyalarında satır sonları "\n" olarak kaçırılmış olabilir.
    privateKey: read("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

function getAdminApp(config: FirebaseAdminConfig): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;
  const app = initializeApp(
    { credential: cert({ projectId: config.projectId, clientEmail: config.clientEmail, privateKey: config.privateKey }), projectId: config.projectId },
    APP_NAME,
  );
  initializeFirestore(app, { preferRest: true });
  return app;
}

export function getAdminFirestore(config: FirebaseAdminConfig): Firestore {
  return getFirestore(getAdminApp(config));
}

// Sahip kimliği e-postadan çözülür; uid'nin elle kopyalanması gerekmez.
export async function resolveOwnerId(config: FirebaseAdminConfig, ownerEmail: string): Promise<string> {
  const user = await getAuth(getAdminApp(config)).getUserByEmail(ownerEmail);
  return user.uid;
}
