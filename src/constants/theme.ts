/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * Instagram-inspired modern design with gradient colors and soft aesthetics.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#0F172A",
    background: "#F8FAFC",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#E2E8F0",
    textSecondary: "#64748B",
    // Instagram gradient colors
    instagramGradientStart: "#833AB4",
    instagramGradientEnd: "#FD1D1D",
    instagramGradientMid: "#FCB045",
    // Accent colors
    accentPurple: "#8B5CF6",
    accentPink: "#EC4899",
    accentBlue: "#3B82F6",
    accentGreen: "#10B981",
  },
  dark: {
    text: "#F8FAFC",
    background: "#0B0F19",
    backgroundElement: "#161F30",
    backgroundSelected: "#222F47",
    textSecondary: "#94A3B8",
    // Instagram gradient colors
    instagramGradientStart: "#833AB4",
    instagramGradientEnd: "#FD1D1D",
    instagramGradientMid: "#FCB045",
    // Accent colors
    accentPurple: "#A78BFA",
    accentPink: "#F472B6",
    accentBlue: "#60A5FA",
    accentGreen: "#34D399",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Instagram-style shadow presets
export const Shadows = {
  small:
    Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      },
    }) ?? {},
  medium:
    Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
      },
    }) ?? {},
  large:
    Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
      },
    }) ?? {},
};

// Border radius presets
export const BorderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 20,
  round: 9999,
};

// Animation durations
export const Durations = {
  fast: 150,
  medium: 300,
  slow: 500,
};
