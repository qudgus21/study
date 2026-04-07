/**
 * Firestore topics 컬렉션의 source_type 마이그레이션
 * generated → ai, gap → jd, rss → article, manual → ai
 * difficulty, category_id 필드 제거
 *
 * 실행: npx tsx scripts/migrate-source-types.ts
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

const SOURCE_MAP: Record<string, string> = {
  generated: "ai",
  gap: "jd",
  rss: "article",
  manual: "ai",
  github: "ai", // 혹시 남아있을 경우
};

async function migrate() {
  const snap = await db.collection("topics").get();
  console.log(`Total topics: ${snap.size}`);

  const batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const oldSource = data.source_type as string;
    const newSource = SOURCE_MAP[oldSource];

    const updates: Record<string, unknown> = {};

    if (newSource && newSource !== oldSource) {
      updates.source_type = newSource;
    }

    // difficulty, category_id 필드 제거
    if ("difficulty" in data) {
      updates.difficulty = FieldValue.delete();
    }
    if ("category_id" in data) {
      updates.category_id = FieldValue.delete();
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Migrated ${count} documents`);
  } else {
    console.log("No documents to migrate");
  }
}

migrate().catch(console.error);
