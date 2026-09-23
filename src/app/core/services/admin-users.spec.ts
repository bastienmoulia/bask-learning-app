import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from 'firebase/firestore';
import { Functions } from 'firebase/functions';
import { vi } from 'vitest';
import { FIREBASE_SERVICES, type FirebaseServices } from '../firebase/firebase';
import { AuthService } from './auth';
import { AdminUsersService } from './admin-users';

const firebaseFirestoreMocks = vi.hoisted(() => {
  let usersSnapshotCallback:
    | ((snapshot: { docs: { id: string; data: () => unknown }[] }) => void)
    | undefined;

  return {
    getFirestore: vi.fn(() => ({} as Firestore)),
    usersSnapshotCallback: () => usersSnapshotCallback,
    collection: vi.fn(),
    orderBy: vi.fn((field: string) => field),
    query: vi.fn((_collectionRef, ...constraints: string[]) => ({ constraints })),
    onSnapshot: vi.fn(
      (
        _queryRef,
        onNext: (snapshot: { docs: { id: string; data: () => unknown }[] }) => void,
      ) => {
        usersSnapshotCallback = onNext;
        return vi.fn();
      },
    ),
  };
});

const firebaseFunctionsMocks = vi.hoisted(() => {
  const callable = vi.fn().mockResolvedValue({ data: { success: true } });

  return {
    callable,
    httpsCallable: vi.fn(() => callable),
  };
});

vi.mock('firebase/firestore', () => firebaseFirestoreMocks);
vi.mock('firebase/functions', () => firebaseFunctionsMocks);

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    firebaseFirestoreMocks.collection.mockClear();
    firebaseFirestoreMocks.orderBy.mockClear();
    firebaseFirestoreMocks.query.mockClear();
    firebaseFirestoreMocks.onSnapshot.mockClear();
    firebaseFunctionsMocks.callable.mockReset().mockResolvedValue({ data: { success: true } });
    firebaseFunctionsMocks.httpsCallable.mockClear();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            learner: signal({
              id: 'admin-1',
              displayName: 'Admin',
              email: 'admin@example.com',
              role: 'admin',
            }).asReadonly(),
            isAdmin: signal(true).asReadonly(),
          },
        },
        {
          provide: FIREBASE_SERVICES,
          useValue: {
            app: null,
            appCheck: null,
            auth: null,
            firestore: {} as Firestore,
            functions: {} as Functions,
            appCheckEnabled: false,
            isConfigured: true,
          } satisfies FirebaseServices,
        },
      ],
    });

    service = TestBed.inject(AdminUsersService);
  });

  it('subscribes to the registered users list for admins and calls the backend role change function', async () => {
    await vi.waitFor(() => expect(firebaseFirestoreMocks.onSnapshot).toHaveBeenCalledTimes(1));

    firebaseFirestoreMocks.usersSnapshotCallback()?.({
      docs: [
        {
          id: 'admin-1',
          data: () => ({
            uid: 'admin-1',
            displayName: 'Admin',
            email: 'admin@example.com',
            role: 'admin',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        },
        {
          id: 'learner-2',
          data: () => ({
            uid: 'learner-2',
            displayName: 'Learner',
            email: 'learner@example.com',
            role: 'learner',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        },
      ],
    });

    expect(service.users()).toHaveLength(2);

    await service.setUserRole('learner-2', 'admin');

    expect(firebaseFunctionsMocks.httpsCallable).toHaveBeenCalledTimes(1);
    expect(firebaseFunctionsMocks.callable).toHaveBeenCalledWith({
      targetUserId: 'learner-2',
      role: 'admin',
    });
    expect(service.feedback()?.kind).toBe('success');
  });
});
