import { invoke } from '@/shared/api';
export const getDesktopNotifications = () => invoke('get_desktop_notifications');
export const setDesktopNotifications = (enabled: boolean) => invoke('set_desktop_notifications', { enabled });
