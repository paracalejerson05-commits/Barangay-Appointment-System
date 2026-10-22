export function getNotificationTargetUserIds(userId?: string, isAdmin = false): string[] {
  const target = isAdmin ? 'admin' : userId;
  if (!target) return [];
  return [target];
}
