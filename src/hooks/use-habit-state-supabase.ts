import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useAuth } from "./use-auth";

export type DayOfWeek = "월" | "화" | "수" | "목" | "금" | "토" | "일";
export type TaskCategory = "생활" | "가사" | "태도" | "건강" | "특별";
export type TaskStatus =
  | "unchecked"
  | "pending"
  | "approved"
  | "partially_approved"
  | "rejected";

export interface TaskItem {
  id: string;
  name: string;
  category: TaskCategory;
  points: number;
  status: TaskStatus;
  checkedAt?: string;
  approvedAt?: string;
  approvedPoints?: number;
}

export interface CurrentWeekData {
  weekId: string;
  startDate: string;
  endDate: string;
  days: { [key in DayOfWeek]: TaskItem[] };
}

export interface ArchiveEntry {
  id: string;
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

export function getWeekRange(date: Date) {
  const currentDay = date.getDay();
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
  if (score >= 280) return { grade: "S" as const, reward: 15000 };
  if (score >= 245) return { grade: "A+" as const, reward: 12000 };
  if (score >= 210) return { grade: "A" as const, reward: 9000 };
  if (score >= 175) return { grade: "B" as const, reward: 6000 };
  return { grade: "C" as const, reward: 3000 };
}

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
  const day = new Date().getDay();
  if (day === 0) return "일";
  return DAYS_OF_WEEK[day - 1];
};

export function useHabitState() {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState<CurrentWeekData | null>(null);
  const [history, setHistory] = useState<ArchiveEntry[]>([]);
  const [simulatedDay, setSimulatedDayState] = useState<DayOfWeek>("월");
  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [settledWeekSnapshot, setSettledWeekSnapshot] =
    useState<CurrentWeekData | null>(null);

  const appStateRef = useRef(AppState.currentState);
  const isLoadingRef = useRef(false);

  // Load data from Supabase
  const loadData = async () => {
    if (isLoadingRef.current || !user) return;
    isLoadingRef.current = true;

    try {
      // Load current week
      const { data: weekData, error: weekError } = await supabase
        .from("weeks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (weekError) {
        console.error("Error loading week:", weekError);
      }

      if (weekData) {
        let parsedWeek = weekData.days as CurrentWeekData;

        // Ensure all days exist in the data
        if (!parsedWeek.days) {
          parsedWeek.days = createInitialWeekData(new Date()).days;
        } else {
          // Fill in any missing days
          const defaultDays = createInitialWeekData(new Date()).days;
          DAYS_OF_WEEK.forEach((day) => {
            if (!parsedWeek.days[day]) {
              parsedWeek.days[day] = defaultDays[day];
            }
          });
        }

        setCurrentWeek(parsedWeek);

        // Check if this week is in the past and needs auto-archive
        const today = new Date();
        const currentRange = getWeekRange(today);
        if (parsedWeek.startDate < currentRange.startDate) {
          // Auto-archive past week
          await archiveWeek(parsedWeek);
          const freshWeek = createInitialWeekData(today);
          setCurrentWeek(freshWeek);
          await saveWeekToSupabase(freshWeek);
        }
      } else {
        // First time - create new week
        const freshWeek = createInitialWeekData(new Date());
        setCurrentWeek(freshWeek);
        await saveWeekToSupabase(freshWeek);
      }

      // Load history
      const { data: archiveData, error: archiveError } = await supabase
        .from("archive")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (archiveError) {
        console.error("Error loading archive:", archiveError);
      } else if (archiveData) {
        const parsedHistory: ArchiveEntry[] = archiveData.map((item) => ({
          id: item.week_id,
          startDate: item.start_date,
          endDate: item.end_date,
          score: item.score,
          grade: item.grade as ArchiveEntry["grade"],
          reward: item.reward,
          approvedCount: item.approved_count,
          totalCount: item.total_count,
        }));
        setHistory(parsedHistory);
      }

      // Load simulated day from localStorage (client-side only)
      if (Platform.OS === "web") {
        const storedSimDay = localStorage.getItem(
          "@habit_tracker_simulated_day",
        );
        if (storedSimDay) {
          setSimulatedDayState(storedSimDay as DayOfWeek);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Save week to Supabase
  const saveWeekToSupabase = async (week: CurrentWeekData) => {
    if (!user) return;

    const { error } = await supabase.from("weeks").upsert({
      user_id: user.id,
      week_id: week.weekId,
      start_date: week.startDate,
      end_date: week.endDate,
      days: week.days,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving week:", error);
    }
  };

  // Archive a week
  const archiveWeek = async (week: CurrentWeekData) => {
    if (!user) return;

    const score = calculateWeekScore(week);
    const { grade, reward } = calculateGradeAndReward(score);
    const approvedCount = getApprovedCount(week);
    const totalCount = getTotalCount(week);

    const { error } = await supabase.from("archive").upsert({
      user_id: user.id,
      week_id: week.weekId,
      start_date: week.startDate,
      end_date: week.endDate,
      score,
      grade,
      reward,
      approved_count: approvedCount,
      total_count: totalCount,
    });

    if (error) {
      console.error("Error archiving week:", error);
    }
  };

  // Note: Realtime subscription removed to prevent "cannot add callbacks after subscribe" error
  // Data sync is handled by:
  // 1. AppState listener (foreground/background transitions)
  // 2. 30-second periodic sync interval
  // 3. BroadcastChannel for web cross-tab sync

  // Load data on mount and auth change
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // App focus listener
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
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

  const setSimulatedDay = async (day: DayOfWeek) => {
    setSimulatedDayState(day);
    if (Platform.OS === "web") {
      localStorage.setItem("@habit_tracker_simulated_day", day);
    }
  };

  const calculateWeekScore = (
    week: CurrentWeekData | null = currentWeek,
  ): number => {
    if (!week || !week.days || typeof week.days !== "object") return 0;
    let total = 0;
    DAYS_OF_WEEK.forEach((day) => {
      try {
        const dayTasks = week.days[day];
        if (!dayTasks || !Array.isArray(dayTasks)) return;
        dayTasks.forEach((task) => {
          if (task.status === "approved") {
            total += task.approvedPoints ?? task.points;
          } else if (task.status === "partially_approved") {
            total += task.approvedPoints ?? 2;
          }
        });
      } catch (e) {
        // Skip if day access fails
        console.warn(`Failed to access day ${day}:`, e);
      }
    });
    return total;
  };

  const getApprovedCount = (week: CurrentWeekData): number => {
    let count = 0;
    DAYS_OF_WEEK.forEach((day) => {
      const dayTasks = week.days[day];
      if (!dayTasks) return;
      count += dayTasks.filter(
        (t) => t.status === "approved" || t.status === "partially_approved",
      ).length;
    });
    return count;
  };

  const getTotalCount = (week: CurrentWeekData): number => {
    let count = 0;
    DAYS_OF_WEEK.forEach((day) => {
      const dayTasks = week.days[day];
      if (!dayTasks) return;
      count += dayTasks.length;
    });
    return count;
  };

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

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
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

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
  };

  const approveTask = async (
    day: DayOfWeek,
    taskId: string,
    points?: number,
  ) => {
    if (!currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: "approved",
          approvedAt: new Date().toISOString(),
          approvedPoints: points ?? task.points,
        };
      }
      return task;
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
  };

  const partialApproveTask = async (
    day: DayOfWeek,
    taskId: string,
    points: number,
  ) => {
    if (!currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: "partially_approved",
          approvedAt: new Date().toISOString(),
          approvedPoints: points,
        };
      }
      return task;
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
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
          approvedPoints: undefined,
        };
      }
      return task;
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
  };

  const updateMultipleTasks = async (
    updates: Array<{
      day: DayOfWeek;
      taskId: string;
      status: TaskStatus;
      approvedPoints?: number;
    }>,
  ) => {
    if (!currentWeek) return;

    const updatedDays = { ...currentWeek.days };
    updates.forEach(({ day, taskId, status, approvedPoints }) => {
      updatedDays[day] = updatedDays[day].map((task) => {
        if (task.id === taskId) {
          const updatedTask = { ...task, status };
          if (status === "approved" || status === "partially_approved") {
            (updatedTask as any).approvedAt = new Date().toISOString();
            (updatedTask as any).approvedPoints = approvedPoints ?? task.points;
          } else if (status === "rejected") {
            (updatedTask as any).approvedAt = undefined;
            (updatedTask as any).approvedPoints = undefined;
          }
          return updatedTask;
        }
        return task;
      });
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
  };

  const addSpecialTask = async (day: DayOfWeek, name: string) => {
    if (isReadOnly || !currentWeek || !name.trim()) return;
    const updatedDays = { ...currentWeek.days };
    const newId = `special_${Date.now()}`;
    const newTask: TaskItem = {
      id: newId,
      name: name.trim(),
      category: "특별",
      points: 5,
      status: "pending",
      checkedAt: new Date().toISOString(),
    };

    updatedDays[day] = [...updatedDays[day], newTask];
    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
  };

  const deleteSpecialTask = async (day: DayOfWeek, taskId: string) => {
    if (isReadOnly || !currentWeek) return;
    const updatedDays = { ...currentWeek.days };
    updatedDays[day] = updatedDays[day].filter((task) => task.id !== taskId);

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    await saveWeekToSupabase(updatedWeek);
  };

  const forceWeeklyReset = async () => {
    if (!currentWeek) return;

    const finalScore = calculateWeekScore();
    const { grade, reward } = calculateGradeAndReward(finalScore);
    const approvedCount = getApprovedCount(currentWeek);
    const totalCount = getTotalCount(currentWeek);

    // Archive current week
    await archiveWeek(currentWeek);

    // Save snapshot for read-only view
    const snapshotData: CurrentWeekData = JSON.parse(
      JSON.stringify(currentWeek),
    );
    setSettledWeekSnapshot(snapshotData);
    setIsReadOnly(true);

    // Create new week
    const nextWeekDate = new Date();
    const currentStartDate = new Date(currentWeek.startDate);
    nextWeekDate.setTime(currentStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const freshWeek = createInitialWeekData(nextWeekDate);
    setCurrentWeek(freshWeek);
    await saveWeekToSupabase(freshWeek);
  };

  const clearAllData = async () => {
    if (!user) return;

    await supabase.from("weeks").delete().eq("user_id", user.id);
    await supabase.from("archive").delete().eq("user_id", user.id);

    const freshWeek = createInitialWeekData(new Date());
    setCurrentWeek(freshWeek);
    setHistory([]);
    setSimulatedDayState(getRealDayOfWeek());
    setSettledWeekSnapshot(null);
    setIsReadOnly(false);
  };

  const restoreSettledWeek = async () => {
    if (!settledWeekSnapshot) return;

    // Reset all approved tasks back to pending
    const resetDays: { [key in DayOfWeek]: TaskItem[] } = {
      월: [],
      화: [],
      수: [],
      목: [],
      금: [],
      토: [],
      일: [],
    };
    DAYS_OF_WEEK.forEach((day) => {
      resetDays[day] = settledWeekSnapshot.days[day].map((task) => {
        if (
          task.status === "approved" ||
          task.status === "partially_approved" ||
          task.status === "rejected"
        ) {
          return {
            ...task,
            status: "pending" as const,
            checkedAt: new Date().toISOString(),
            approvedAt: undefined,
            approvedPoints: undefined,
          };
        }
        return task;
      });
    });

    const restoredWeek: CurrentWeekData = {
      ...settledWeekSnapshot,
      days: resetDays,
    };

    setSettledWeekSnapshot(null);
    setIsReadOnly(false);
    setCurrentWeek(restoredWeek);
    await saveWeekToSupabase(restoredWeek);
  };

  const getPendingTasks = () => {
    if (!currentWeek || !currentWeek.days) return [];
    const pendingList: { day: DayOfWeek; task: TaskItem }[] = [];
    DAYS_OF_WEEK.forEach((day) => {
      const dayTasks = currentWeek.days[day];
      if (!dayTasks) return;
      dayTasks.forEach((task) => {
        if (task.status === "pending") {
          pendingList.push({ day, task });
        }
      });
    });
    return pendingList;
  };

  const currentScore = useMemo(() => calculateWeekScore(), [currentWeek]);
  const currentGradeInfo = calculateGradeAndReward(currentScore);

  const childViewWeek =
    isReadOnly && settledWeekSnapshot ? settledWeekSnapshot : currentWeek;
  const childScore = useMemo(
    () => calculateWeekScore(childViewWeek),
    [childViewWeek],
  );
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
    partialApproveTask,
    rejectTask,
    updateMultipleTasks,
    addSpecialTask,
    deleteSpecialTask,
    forceWeeklyReset,
    restoreSettledWeek,
    clearAllData,
    getPendingTasks,
  };
}
