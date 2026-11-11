export type PermissionKey =
  'webSearch' | 'webFetch' | 'readFiles' | 'readAnywhere' | 'writeFiles' | 'writeAnywhere' | 'runCommands' | 'skills';
export type Permissions = Record<PermissionKey, boolean>;
