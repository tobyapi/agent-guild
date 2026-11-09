export type PermissionKey =
  | 'webSearch'
  | 'webFetch'
  | 'readFiles'
  | 'writeFiles'
  | 'writeAnywhere'
  | 'runCommands'
  | 'skills';
export type Permissions = Record<PermissionKey, boolean>;
