/**
 * Date utility for getting the current date.
 * In development/test environments, you can set SIMULATED_DATE in .env
 * to override the current date (format: YYYY-MM-DD).
 *
 * Example:
 * // .env
 * EXPO_PUBLIC_SIMULATED_DATE=2026-07-17
 */

// Get simulated date from environment variable (Expo public env vars)
// For web, use process.env directly. For native, expo-constants may also work.
const getSimulatedDate = (): Date | null => {
  // Try expo-constants first (for native)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require("expo-constants").default;
    if (Constants?.expoConfig?.extra?.simulatedDate) {
      const parsed = new Date(Constants.expoConfig.extra.simulatedDate);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      console.warn(
        `Invalid simulatedDate format: ${Constants.expoConfig.extra.simulatedDate}. Using current date.`,
      );
    }
  } catch (e) {
    // expo-constants not available (web), fallback to env vars
  }

  // Fallback to environment variables (works for both web and native)
  const simulatedDateStr = process.env.EXPO_PUBLIC_SIMULATED_DATE;
  if (simulatedDateStr) {
    const parsed = new Date(simulatedDateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    console.warn(
      `Invalid EXPO_PUBLIC_SIMULATED_DATE format: ${simulatedDateStr}. Using current date.`,
    );
  }
  return null;
};

// Get today's date (simulated or real)
export const getToday = (): Date => {
  return getSimulatedDate() || new Date();
};

// Get the current day of week (월~일)
export const getRealDayOfWeek = ():
  | "월"
  | "화"
  | "수"
  | "목"
  | "금"
  | "토"
  | "일" => {
  const day = getToday().getDay(); // 0 is Sunday, 1 is Monday ...
  const DAYS_OF_WEEK: ("월" | "화" | "수" | "목" | "금" | "토" | "일")[] = [
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
    "일",
  ];
  if (day === 0) return "일";
  return DAYS_OF_WEEK[day - 1];
};
