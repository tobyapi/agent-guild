export interface AppearancePersistence {
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  warn: (message: string) => void;
}
