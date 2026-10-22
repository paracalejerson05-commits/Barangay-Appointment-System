export const firebaseConfig = {};

export const auth = null;
export const db = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: undefined, email: null },
    operationType,
    path
  };

  console.warn('[Supabase migration] Firebase imports are intentionally removed. This app uses Supabase only.', errInfo);
  return errInfo;
}

export async function initializeFirebaseCompat() {
  console.warn('[Supabase migration] Firebase integration is disabled. This app uses Supabase only.');
  return null;
}
