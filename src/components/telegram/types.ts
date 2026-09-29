/** Minimal typings for https://telegram.org/js/telegram-web-app.js (Bot API 8+). */
export type TgThemeParams = Partial<
  Record<
    | "bg_color"
    | "text_color"
    | "hint_color"
    | "link_color"
    | "button_color"
    | "button_text_color"
    | "secondary_bg_color"
    | "header_bg_color"
    | "bottom_bar_bg_color"
    | "accent_text_color"
    | "section_bg_color"
    | "section_header_text_color"
    | "section_separator_color"
    | "subtitle_text_color"
    | "destructive_text_color",
    string
  >
>;

export type TgInsets = { top: number; bottom: number; left: number; right: number };

export type TgButton = {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setText(t: string): TgButton;
  setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean; has_shine_effect?: boolean }): TgButton;
  onClick(cb: () => void): TgButton;
  offClick(cb: () => void): TgButton;
  show(): TgButton;
  hide(): TgButton;
  enable(): TgButton;
  disable(): TgButton;
  showProgress(leaveActive?: boolean): TgButton;
  hideProgress(): TgButton;
};

export type TgWebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string }; start_param?: string };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: TgThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: TgInsets;
  contentSafeAreaInset?: TgInsets;
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(v: string): boolean;
  setHeaderColor(c: string): void;
  setBackgroundColor(c: string): void;
  setBottomBarColor?(c: string): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  onEvent(e: string, cb: (...a: unknown[]) => void): void;
  offEvent(e: string, cb: (...a: unknown[]) => void): void;
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  requestWriteAccess?(cb?: (granted: boolean) => void): void;
  requestContact?(cb?: (shared: boolean) => void): void;
  showAlert(msg: string, cb?: () => void): void;
  showConfirm(msg: string, cb?: (ok: boolean) => void): void;
  BackButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  MainButton: TgButton;
  SecondaryButton?: TgButton;
  HapticFeedback: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  LocationManager?: {
    isInited: boolean;
    isLocationAvailable: boolean;
    isAccessGranted: boolean;
    init(cb?: () => void): void;
    getLocation(cb: (loc: { latitude: number; longitude: number } | null) => void): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}
