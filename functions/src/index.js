const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const usersCollection = 'users';
const adminRole = 'admin';
const learnerRole = 'learner';

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

function createUserDocRef(userId) {
  return admin.firestore().collection(usersCollection).doc(userId);
}

exports.setUserRole = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const targetUserId = request.data?.targetUserId;
  const nextRole = request.data?.role;

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to manage administrator access.');
  }

  if (targetUserId === callerUid) {
    throw new HttpsError(
      'failed-precondition',
      'Administrators cannot change their own role through the app.',
    );
  }

  if (nextRole !== adminRole && nextRole !== learnerRole) {
    throw new HttpsError('invalid-argument', 'The requested role is not supported.');
  }

  await admin.firestore().runTransaction(async (transaction) => {
    const callerRef = createUserDocRef(callerUid);
    const targetRef = createUserDocRef(targetUserId);
    const callerSnapshot = await transaction.get(callerRef);
    const targetSnapshot = await transaction.get(targetRef);

    if (!callerSnapshot.exists || callerSnapshot.data()?.role !== adminRole) {
      throw new HttpsError('permission-denied', 'Only administrators can manage administrator access.');
    }

    if (!targetSnapshot.exists) {
      throw new HttpsError('not-found', 'The selected user profile does not exist yet.');
    }

    const currentRole = targetSnapshot.data()?.role;

    if (currentRole === nextRole) {
      return;
    }

    if (currentRole === adminRole && nextRole === learnerRole) {
      const currentAdmins = await transaction.get(
        admin.firestore().collection(usersCollection).where('role', '==', adminRole).limit(2),
      );

      if (currentAdmins.size <= 1) {
        throw new HttpsError(
          'failed-precondition',
          'You cannot remove administrator access from the last remaining admin.',
        );
      }
    }

    transaction.update(targetRef, {
      role: nextRole,
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    success: true,
  };
});
