import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const usersCollection = 'users';
const adminRole = 'admin';

const [, , targetUserId] = process.argv;

if (!targetUserId) {
  console.error('Usage: npm run bootstrap:initial-admin -- <firebase-auth-uid>');
  process.exit(1);
}

initializeApp();

const auth = getAuth();
const firestore = getFirestore();
const userRecord = await auth.getUser(targetUserId);
const userDocRef = firestore.collection(usersCollection).doc(targetUserId);
const [existingAdminsSnapshot, existingUserSnapshot] = await Promise.all([
  firestore.collection(usersCollection).where('role', '==', adminRole).limit(2).get(),
  userDocRef.get(),
]);

if (
  !existingAdminsSnapshot.empty &&
  !existingAdminsSnapshot.docs.some((documentSnapshot) => documentSnapshot.id === targetUserId)
) {
  console.error('An administrator is already provisioned. Refusing to replace the initial admin.');
  process.exit(1);
}

const now = new Date().toISOString();
const existingUserData = existingUserSnapshot.exists ? existingUserSnapshot.data() : null;

await userDocRef.set({
  uid: targetUserId,
  displayName: userRecord.displayName?.trim() || userRecord.email?.trim() || 'Bask learner',
  email: userRecord.email?.trim() || null,
  role: adminRole,
  createdAt: existingUserData?.createdAt ?? now,
  updatedAt: now,
});

console.log(`Admin access provisioned for ${targetUserId}.`);
