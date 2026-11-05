import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type LockscreenMode = 'activity' | 'fullScreenIntent';
export type PermissionState = 'granted' | 'denied' | 'unknown';
export type PermissionKind =
  | 'overlay'
  | 'notifications'
  | 'battery'
  | 'fullScreenIntent'
  | 'miui'
  | 'autostart';

export interface LockscreenStatus {
  running: boolean;
  enabled: boolean;
  mode: LockscreenMode;
  lastScreenOnAt: number;
  lastError: string | null;
  sdkInt: number;
  manufacturer: string;
}

export type LockscreenPermissions = Record<
  'overlay' | 'notifications' | 'battery' | 'fullScreenIntent' | 'miuiLockscreen' | 'miuiBackgroundPopup' | 'autostart',
  PermissionState
>;

interface NativeLockscreen {
  isSupported(): boolean;
  start(mode: LockscreenMode): void;
  stop(): void;
  isRunning(): boolean;
  getStatus(): LockscreenStatus;
  dismiss(): void;
  getPermissions(): LockscreenPermissions;
  requestNotificationPermission(): void;
  openPermissionSettings(kind: PermissionKind): boolean;
}

/** `null` in Expo Go, on web and in tests: the native module is not compiled in. */
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeLockscreen>('Lockscreen') : null;

export const Lockscreen = native;

export function isSupported(): boolean {
  return native?.isSupported() ?? false;
}
