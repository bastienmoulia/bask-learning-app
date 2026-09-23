import { User } from 'firebase/auth';

export const usersCollection = 'users';

export type UserRole = 'learner' | 'admin';

export interface UserProfileDocument {
  uid: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export function createUserDisplayName(user: Pick<User, 'displayName' | 'email'>) {
  return user.displayName?.trim() || user.email?.trim() || 'Bask learner';
}

export function createDefaultUserProfile(user: Pick<User, 'uid' | 'displayName' | 'email'>) {
  const now = new Date().toISOString();

  return {
    uid: user.uid,
    displayName: createUserDisplayName(user),
    email: user.email?.trim() || null,
    role: 'learner',
    createdAt: now,
    updatedAt: now,
  } satisfies UserProfileDocument;
}

export function syncUserProfileIdentity(
  currentProfile: UserProfileDocument,
  user: Pick<User, 'uid' | 'displayName' | 'email'>,
) {
  const nextDisplayName = createUserDisplayName(user);
  const nextEmail = user.email?.trim() || null;

  if (
    currentProfile.uid === user.uid &&
    currentProfile.displayName === nextDisplayName &&
    currentProfile.email === nextEmail
  ) {
    return currentProfile;
  }

  return {
    ...currentProfile,
    uid: user.uid,
    displayName: nextDisplayName,
    email: nextEmail,
    updatedAt: new Date().toISOString(),
  } satisfies UserProfileDocument;
}

export function parseUserProfileDocument(data: unknown, userId: string) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidate = data as Partial<UserProfileDocument>;

  if (
    candidate.uid !== userId ||
    typeof candidate.displayName !== 'string' ||
    !candidate.displayName.trim() ||
    (candidate.email !== null && candidate.email !== undefined && typeof candidate.email !== 'string') ||
    (candidate.role !== 'learner' && candidate.role !== 'admin') ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    uid: candidate.uid,
    displayName: candidate.displayName.trim(),
    email: candidate.email?.trim() || null,
    role: candidate.role,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  } satisfies UserProfileDocument;
}
