import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";
import { readFirebaseServerEnv } from "./env";

const APP_NAME = "job-discovery-web";

// Tek bir Admin uygulaması; geliştirme sırasında modül yeniden yüklense de ikinci kez başlatılmaz.
function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;
  const env = readFirebaseServerEnv();
  const app = initializeApp(
    {
      credential: cert({ projectId: env.projectId, clientEmail: env.clientEmail, privateKey: env.privateKey }),
      projectId: env.projectId,
    },
    APP_NAME,
  );
  // Sunucusuz ortamda gRPC yerine REST: daha hızlı soğuk başlangıç.
  initializeFirestore(app, { preferRest: true });
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
