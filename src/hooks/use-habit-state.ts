import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

export type DayOfWeek = "월" | "화" | "수" | "목" | "금" | "토" | "일";
export type TaskCategory = "생활" | "가사" | "태도" | "건강" | "특별";
export type TaskStatus = "unchecked" | "pending" | "approved" | "rejected";

export interface TaskItem {
  id: string;
  name: string;
  category: TaskCategory;
  points: number;
  status: TaskStatus;
  checkedAt?: string;
  approvedAt?: string;
}

export interface CurrentWeekData {
  weekId: string; // e.g., "2026-W28"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: { [key in DayOfWeek]: TaskItem[] };
}

export interface ArchiveEntry {
  id: string; // weekId
  startDate: string;
  endDate: string;
  score: number;
  grade: "S" | "A+" | "A" | "B" | "C";
  reward: number;
  approvedCount: number;
  totalCount: number;
}

const DAYS_OF_WEEK: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

const DEFAULT_TASKS: Omit<TaskItem, "status">[] = [
  { id: "bed_making", name: "이불·침대정리", category: "생활", points: 5 },
  { id: "bag_tidying", name: "가방 정리", category: "생활", points: 5 },
  { id: "shoes_tidying", name: "신발 정리", category: "생활", points: 5 },
  {
    id: "clothes_organizing",
    name: "옷·행거정리",
    category: "생활",
    points: 5,
  },
  {
    id: "dish_prep",
    name: "그릇 정리·물 담궈놓기",
    category: "가사",
    points: 5,
  },
  {
    id: "bathroom_drying",
    name: "화장실 물기 닦기·수건정리",
    category: "가사",
    points: 5,
  },
  {
    id: "trash_emptying",
    name: "분리수거 도움·쓰레기 정리",
    category: "가사",
    points: 5,
  },
  {
    id: "emotion_control",
    name: "짜증 안 내기",
    category: "태도",
    points: 5,
  },
  { id: "greeting_politely", name: "인사 잘하기", category: "태도", points: 5 },
  { id: "sleep_early", name: "12시 이전 취침", category: "건강", points: 5 },
];

// Helper to calculate the ISO week number
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return weekNo;
}

// Helper to get current week info (dates and ID)
export function getWeekRange(date: Date) {
  const currentDay = date.getDay(); // 0 is Sunday, 1 is Monday ...
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

  const monday = new Date(date);
  monday.setDate(date.getDate() + distanceToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const weekId = `${monday.getFullYear()}-W${String(getWeekNumber(monday)).padStart(2, "0")}`;
  return {
    weekId,
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
  };
}

export function calculateGradeAndReward(score: number) {
  // 주간 점수 기준 (만점 350점 = 10항목 × 5점 × 7일)
  if (score >= 280) return { grade: "S" as const, reward: 15000 };
  if (score >= 245) return { grade: "A+" as const, reward: 12000 };
  if (score >= 210) return { grade: "A" as const, reward: 9000 };
  if (score >= 175) return { grade: "B" as const, reward: 6000 };
  return { grade: "C" as const, reward: 3000 };
}

// Initial structure for a blank week
export function createInitialWeekData(date: Date): CurrentWeekData {
  const range = getWeekRange(date);

  const days: { [key in DayOfWeek]: TaskItem[] } = {
    월: [],
    화: [],
    수: [],
    목: [],
    금: [],
    토: [],
    일: [],
  };

  DAYS_OF_WEEK.forEach((day) => {
    days[day] = DEFAULT_TASKS.map((task) => ({
      ...task,
      status: "unchecked",
    }));
  });

  return {
    weekId: range.weekId,
    startDate: range.startDate,
    endDate: range.endDate,
    days,
  };
}

export const getRealDayOfWeek = (): DayOfWeek => {
  const day = new Date().getDay(); // 0 is Sunday, 1 is Monday ...
  if (day === 0) return "일";
  return DAYS_OF_WEEK[day - 1];
};

const STORAGE_KEYS = {
  CURRENT_WEEK: "@habit_tracker_current_week",
  HISTORY: "@habit_tracker_history",
  SIMULATED_DAY: "@habit_tracker_simulated_day",
  LAST_SETTLED_WEEK: "@habit_tracker_last_settled_week",
  SETTLED_WEEK_SNAPSHOT: "@habit_tracker_settled_week_snapshot",
};

function dedupeHistory(history: ArchiveEntry[]): ArchiveEntry[] {
  const seen = new Set<string>();
  return history.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function prependArchiveEntry(
  history: ArchiveEntry[],
  entry: ArchiveEntry,
): ArchiveEntry[] {
  const withoutDuplicate = history.filter((item) => item.id !== entry.id);
  return dedupeHistory([entry, ...withoutDuplicate]);
}

export function useHabitState() {
  const [currentWeek, setCurrentWeek] = useState<CurrentWeekData | null>(null);
  const [history, setHistory] = useState<ArchiveEntry[]>([]);
  const [simulatedDay, setSimulatedDayState] = useState<DayOfWeek>("월");
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [settledWeekSnapshot, setSettledWeekSnapshot] =
    useState<CurrentWeekData | null>(null);

  // For cross-tab sync
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const isLoadingRef = useRef(false);

  // Load state on mount (plain function, not useCallback)
  const loadData = async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const storedWeek = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_WEEK);
      const storedHistory = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
      const storedSimDay = await AsyncStorage.getItem(
        STORAGE_KEYS.SIMULATED_DAY,
      );
      const storedSnapshot = await AsyncStorage.getItem(
        STORAGE_KEYS.SETTLED_WEEK_SNAPSHOT,
      );
      let snapshot: CurrentWeekData | null = storedSnapshot
        ? JSON.parse(storedSnapshot)
        : null;

      // Load history (dedupe in case of legacy duplicate entries)
      let parsedHistory: ArchiveEntry[] = [];
      if (storedHistory) {
        const rawHistory: ArchiveEntry[] = JSON.parse(storedHistory);
        parsedHistory = dedupeHistory(rawHistory);
        setHistory(parsedHistory);
        if (parsedHistory.length !== rawHistory.length) {
          await AsyncStorage.setItem(
            STORAGE_KEYS.HISTORY,
            JSON.stringify(parsedHistory),
          );
        }
      }

      // Load simulated day (or default to current real day)
      const realDay = getRealDayOfWeek();
      if (storedSimDay) {
        setSimulatedDayState(storedSimDay as DayOfWeek);
      } else {
        setSimulatedDayState(realDay);
      }

      // Load current week
      const today = new Date();
      const currentRange = getWeekRange(today);
      let activeWeek: CurrentWeekData | null = null;

      if (storedWeek) {
        const parsedWeek: CurrentWeekData = JSON.parse(storedWeek);

        // Only auto-archive weeks that are behind the real calendar week.
        // Future weeks (from forceWeeklyReset simulation) should stay as-is.
        const isPastWeek = parsedWeek.startDate < currentRange.startDate;

        if (isPastWeek) {
          // Archive old week automatically if there was progress
          const oldScore = calculateWeekScore(parsedWeek);
          if (oldScore > 0) {
            const { grade, reward } = calculateGradeAndReward(oldScore);
            const approvedCount = getApprovedCount(parsedWeek);
            const totalCount = getTotalCount(parsedWeek);
            const newArchiveEntry: ArchiveEntry = {
              id: parsedWeek.weekId,
              startDate: parsedWeek.startDate,
              endDate: parsedWeek.endDate,
              score: oldScore,
              grade,
              reward,
              approvedCount,
              totalCount,
            };

            const updatedHistory = prependArchiveEntry(
              parsedHistory,
              newArchiveEntry,
            );
            parsedHistory = updatedHistory;
            setHistory(updatedHistory);
            await AsyncStorage.setItem(
              STORAGE_KEYS.HISTORY,
              JSON.stringify(updatedHistory),
            );
          }

          // Start fresh week for the current calendar week
          activeWeek = createInitialWeekData(today);
          setCurrentWeek(activeWeek);
          await AsyncStorage.setItem(
            STORAGE_KEYS.CURRENT_WEEK,
            JSON.stringify(activeWeek),
          );
        } else {
          activeWeek = parsedWeek;
          setCurrentWeek(parsedWeek);
        }
      } else {
        // First time opening the app
        activeWeek = createInitialWeekData(today);
        setCurrentWeek(activeWeek);
        await AsyncStorage.setItem(
          STORAGE_KEYS.CURRENT_WEEK,
          JSON.stringify(activeWeek),
        );
      }

      // Child read-only view: keep settled snapshot until the real calendar
      // reaches the new active week (e.g. after parent forceWeeklyReset).
      if (snapshot && activeWeek && currentRange.weekId === activeWeek.weekId) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SETTLED_WEEK_SNAPSHOT);
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SETTLED_WEEK);
        snapshot = null;
      }

      setSettledWeekSnapshot(snapshot);
      setIsReadOnly(!!snapshot);
    } catch (error) {
      console.error("Failed to load habit tracker data:", error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Initialize on mount only (no dependency array issues)
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      loadData();
    }
  }, [isInitialized]);

  // Broadcast channel for web cross-tab communication
  useEffect(() => {
    if (Platform.OS === "web" && typeof BroadcastChannel !== "undefined") {
      try {
        broadcastChannelRef.current = new BroadcastChannel(
          "habit_tracker_updates",
        );

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === "data_updated") {
            // Reload data when another tab updates
            loadData();
          }
        };

        broadcastChannelRef.current.addEventListener("message", handleMessage);

        return () => {
          if (broadcastChannelRef.current) {
            broadcastChannelRef.current.removeEventListener(
              "message",
              handleMessage,
            );
            broadcastChannelRef.current.close();
          }
        };
      } catch (error) {
        console.log("BroadcastChannel not supported:", error);
      }
    }
  }, []);

  // App focus/blur listener for native platforms only
  useEffect(() => {
    if (Platform.OS === "web") return; // Skip on web

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App has come to foreground - reload data
        await loadData();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Periodic sync for extra reliability (every 30 seconds)
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadData();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  const notifyOtherTabs = () => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: "data_updated" });
      } catch (error) {
        console.log("Failed to post to BroadcastChannel:", error);
      }
    }
  };

  // Helper functions to write back to storage
  const saveCurrentWeek = async (data: CurrentWeekData) => {
    setCurrentWeek(data);
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_WEEK, JSON.stringify(data));

    // Notify other tabs
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: "data_updated" });
      } catch (error) {
        console.log("Failed to post to BroadcastChannel:", error);
      }
    }
  };

  const saveHistory = async (data: ArchiveEntry[]) => {
    const deduped = dedupeHistory(data);
    setHistory(deduped);
    await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(deduped));

    // Notify other tabs
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: "data_updated" });
      } catch (error) {
        console.log("Failed to post to BroadcastChannel:", error);
      }
    }
  };

  const setSimulatedDay = async (day: DayOfWeek) => {
    setSimulatedDayState(day);
    await AsyncStorage.setItem(STORAGE_KEYS.SIMULATED_DAY, day);
  };

  // Score Calculations
  const calculateWeekScore = (
    week: CurrentWeekData | null = currentWeek,
  ): number => {
    if (!week) return 0;
    let total = 0;
    DAYS_OF_WEEK.forEach((day) => {
      week.days[day].forEach((task) => {
        if (task.status === "approved") {
          total += task.points;
        }
      });
    });
    return total;
  };

  const getApprovedCount = (week: CurrentWeekData): number => {
    let count = 0;
    DAYS_OF_WEEK.forEach((day) => {
      count += week.days[day].filter((t) => t.status === "approved").length;
    });
    return count;
  };

  const getTotalCount = (week: CurrentWeekData): number => {
    let count = 0;
    DAYS_OF_WEEK.forEach((day) => {
      count += week.days[day].length;
    });
    return count;
  };

  // Actions
  const checkTask = async (day: DayOfWeek, taskId: string) => {
    if (isReadOnly || !currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: "pending",
          checkedAt: new Date().toISOString(),
        };
      }
      return task;
    });

    await saveCurrentWeek({
      ...currentWeek,
      days: updatedDays,
    });
  };

  const uncheckTask = async (day: DayOfWeek, taskId: string) => {
    if (isReadOnly || !currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: "unchecked",
          checkedAt: undefined,
          approvedAt: undefined,
        };
      }
      return task;
    });

    await saveCurrentWeek({
      ...currentWeek,
      days: updatedDays,
    });
  };

  const approveTask = async (day: DayOfWeek, taskId: string) => {
    if (!currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: "approved",
          approvedAt: new Date().toISOString(),
        };
      }
      return task;
    });

    await saveCurrentWeek({
      ...currentWeek,
      days: updatedDays,
    });
  };

  const rejectTask = async (day: DayOfWeek, taskId: string) => {
    if (!currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: "rejected",
          approvedAt: undefined,
        };
      }
      return task;
    });

    await saveCurrentWeek({
      ...currentWeek,
      days: updatedDays,
    });
  };

  // Batch approve/reject multiple tasks at once to avoid race conditions
  const updateMultipleTasks = async (
    updates: Array<{ day: DayOfWeek; taskId: string; status: TaskStatus }>,
  ) => {
    // Reload latest data from storage first
    const latestWeekStr = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_WEEK);
    if (!latestWeekStr) return;

    let latestWeek: CurrentWeekData = JSON.parse(latestWeekStr);
    const updatedDays = { ...latestWeek.days };

    // Apply all updates in one pass
    updates.forEach(({ day, taskId, status }) => {
      updatedDays[day] = updatedDays[day].map((task) => {
        if (task.id === taskId) {
          const updatedTask = { ...task, status };
          if (status === "approved") {
            (updatedTask as any).approvedAt = new Date().toISOString();
          } else if (status === "rejected") {
            (updatedTask as any).approvedAt = undefined;
          }
          return updatedTask;
        }
        return task;
      });
    });

    await saveCurrentWeek({
      ...latestWeek,
      days: updatedDays,
    });
  };

  const addSpecialTask = async (day: DayOfWeek, name: string) => {
    if (isReadOnly || !currentWeek || !name.trim()) return;
    const updatedDays = { ...currentWeek.days };
    const newId = `special_${Date.now()}`;
    const newTask: TaskItem = {
      id: newId,
      name: name.trim(),
      category: "특별",
      points: 2,
      status: "pending", // Starts directly in pending so parents can see & approve it
      checkedAt: new Date().toISOString(),
    };

    updatedDays[day] = [...updatedDays[day], newTask];

    await saveCurrentWeek({
      ...currentWeek,
      days: updatedDays,
    });
  };

  const deleteSpecialTask = async (day: DayOfWeek, taskId: string) => {
    if (isReadOnly || !currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].filter((task) => task.id !== taskId);

    await saveCurrentWeek({
      ...currentWeek,
      days: updatedDays,
    });
  };

  // Simulations
  const forceWeeklyReset = async () => {
    if (!currentWeek) return;

    // Save the week ID that is being settled
    const settledWeekId = currentWeek.weekId;

    const finalScore = calculateWeekScore();
    const { grade, reward } = calculateGradeAndReward(finalScore);
    const approvedCount = getApprovedCount(currentWeek);
    const totalCount = getTotalCount(currentWeek);

    const newArchiveEntry: ArchiveEntry = {
      id: currentWeek.weekId,
      startDate: currentWeek.startDate,
      endDate: currentWeek.endDate,
      score: finalScore,
      grade,
      reward,
      approvedCount,
      totalCount,
    };

    const updatedHistory = prependArchiveEntry(history, newArchiveEntry);
    await saveHistory(updatedHistory);

    // Save settled week snapshot for child read-only final results view
    const snapshotData: CurrentWeekData = JSON.parse(
      JSON.stringify(currentWeek),
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.SETTLED_WEEK_SNAPSHOT,
      JSON.stringify(snapshotData),
    );
    setSettledWeekSnapshot(snapshotData);
    setIsReadOnly(true);

    // Create new week with next week's date (+7 days)
    const nextWeekDate = new Date();
    // Parse currentWeek's startDate to prevent resetting back to today in tests
    const currentStartDate = new Date(currentWeek.startDate);
    nextWeekDate.setTime(currentStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const freshWeek = createInitialWeekData(nextWeekDate);
    await saveCurrentWeek(freshWeek);

    // Mark this week as settled (for read-only mode on child's screen)
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SETTLED_WEEK, settledWeekId);
    notifyOtherTabs();
  };

  const clearAllData = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_WEEK);
    await AsyncStorage.removeItem(STORAGE_KEYS.HISTORY);
    await AsyncStorage.removeItem(STORAGE_KEYS.SIMULATED_DAY);
    await AsyncStorage.removeItem(STORAGE_KEYS.SETTLED_WEEK_SNAPSHOT);
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SETTLED_WEEK);

    const freshWeek = createInitialWeekData(new Date());
    setCurrentWeek(freshWeek);
    setHistory([]);
    setSimulatedDayState(getRealDayOfWeek());
    setSettledWeekSnapshot(null);
    setIsReadOnly(false);
  };

  // Find all pending tasks across the entire week (for the parent inbox)
  const getPendingTasks = () => {
    if (!currentWeek) return [];
    const pendingList: { day: DayOfWeek; task: TaskItem }[] = [];
    DAYS_OF_WEEK.forEach((day) => {
      currentWeek.days[day].forEach((task) => {
        if (task.status === "pending") {
          pendingList.push({ day, task });
        }
      });
    });
    return pendingList;
  };

  const currentScore = calculateWeekScore();
  const currentGradeInfo = calculateGradeAndReward(currentScore);

  const childViewWeek =
    isReadOnly && settledWeekSnapshot ? settledWeekSnapshot : currentWeek;
  const childScore = calculateWeekScore(childViewWeek);
  const childGradeInfo = calculateGradeAndReward(childScore);

  return {
    currentWeek,
    childViewWeek,
    history,
    simulatedDay,
    isLoading,
    isReadOnly,
    settledWeekSnapshot,
    currentScore,
    currentGrade: currentGradeInfo.grade,
    currentReward: currentGradeInfo.reward,
    childScore,
    childGrade: childGradeInfo.grade,
    childReward: childGradeInfo.reward,
    setSimulatedDay,
    checkTask,
    uncheckTask,
    approveTask,
    rejectTask,
    updateMultipleTasks,
    addSpecialTask,
    deleteSpecialTask,
    forceWeeklyReset,
    clearAllData,
    getPendingTasks,
  };
}
