import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// CRITICAL: Deduplicate tasks in a week's days to prevent duplicate buttons
const deduplicateWeekDays = (days: { [key in DayOfWeek]: TaskItem[] }) => {
  const deduped: { [key in DayOfWeek]: TaskItem[] } = {
    월: [],
    화: [],
    수: [],
    목: [],
    금: [],
    토: [],
    일: [],
  };

  DAYS_OF_WEEK.forEach((day) => {
    if (days[day] && Array.isArray(days[day])) {
      const seen = new Set<string>();
      deduped[day] = days[day].filter((task) => {
        if (seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      });
    }
  });

  return deduped;
};

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
  const [simulatedDay, setSimulatedDayState] =
    useState<DayOfWeek>(getRealDayOfWeek());
  const [isLoading, setIsLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [settledWeekSnapshot, setSettledWeekSnapshot] =
    useState<CurrentWeekData | null>(null);

  const appStateRef = useRef(AppState.currentState);
  const isLoadingRef = useRef(false);
  const isClearingDataRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const REFRESH_COOLDOWN = 3000; // 3초 이내 중복 조회 방지

  // Load data from Supabase (NO localStorage - all data from DB)
  const loadData = async (forceRefresh = false) => {
    // 중복 호출 방지: 쿨다운 시간 내 재조회 요청은 무시
    const now = Date.now();
    if (!forceRefresh && now - lastRefreshTimeRef.current < REFRESH_COOLDOWN) {
      return;
    }
    lastRefreshTimeRef.current = now;

    // When forceRefresh=true, allow bypassing the isLoadingRef guard
    if (!forceRefresh) {
      if (isLoadingRef.current || isClearingDataRef.current) return;
    }
    if (!user) return;

    isLoadingRef.current = true;

    // CRITICAL: Clear settled snapshot before loading to prevent duplicate display
    // This ensures only one source of truth (either DB or snapshot, not both)
    setSettledWeekSnapshot(null);
    setIsReadOnly(false);

    try {
      // === STEP 0: Clean up orphaned non-settled weeks ===
      // If there's a settled week, any non-settled week with a LATER start_date
      // is likely a buggy fresh week created by duplicate settlement.
      // These should be deleted to prevent duplicate buttons.
      const { data: allNonSettledWeeks, error: nonSettledError } =
        await supabase
          .from("weeks")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_settled", false)
          .order("created_at", { ascending: false });

      if (nonSettledError) {
        console.error("Error loading non-settled weeks:", nonSettledError);
      }

      // Delete any non-settled weeks that have start_date in the future
      // These are orphaned fresh weeks created by duplicate settlement
      if (allNonSettledWeeks && allNonSettledWeeks.length > 0) {
        const today = new Date();
        const currentRange = getWeekRange(today);
        for (const orphan of allNonSettledWeeks) {
          if (orphan.start_date > currentRange.startDate) {
            console.log(
              `[loadData] DELETING orphaned fresh week: weekId=${orphan.week_id}, start=${orphan.start_date}`,
            );
            await supabase
              .from("weeks")
              .delete()
              .eq("user_id", user.id)
              .eq("week_id", orphan.week_id);
          }
        }
      }

      // === STEP 1: Check if there's a SETTLED week in the DB ===
      // This handles cross-tab sync: parent tab may have settled a week,
      // and child tab needs to discover it via the database
      // We query ALL settled weeks and filter out empty ones (duplicate settlements)
      const { data: allSettledWeeks, error: settledWeekError } = await supabase
        .from("weeks")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_settled", true)
        .order("created_at", { ascending: false });

      if (settledWeekError) {
        console.error("Error loading settled weeks:", settledWeekError);
      }

      let settledWeekData = null;
      if (allSettledWeeks && allSettledWeeks.length > 0) {
        // Find the MOST RECENT settled week that actually has real task data
        // (not an empty fresh week created by accidental duplicate settlement)
        for (const candidate of allSettledWeeks) {
          const days = candidate.days;
          if (days && typeof days === "object") {
            let hasRealTasks = false;
            for (const day of DAYS_OF_WEEK) {
              const tasks = days[day];
              if (tasks && Array.isArray(tasks) && tasks.length > 0) {
                // Check if at least one task has a non-"unchecked" status
                const nonDefaultTask = tasks.find(
                  (t: any) => t.status && t.status !== "unchecked",
                );
                if (nonDefaultTask) {
                  hasRealTasks = true;
                  break;
                }
              }
            }
            if (hasRealTasks) {
              settledWeekData = candidate;
              break;
            }
          }
        }
        // Fallback: if no real settled week found, use the most recent one
        if (!settledWeekData) {
          settledWeekData = allSettledWeeks[0];
        }
      }

      if (settledWeekData) {
        // Found a settled week in DB - restore it as the snapshot
        console.log(
          `[loadData] FOUND settled week from DB: weekId=${settledWeekData.week_id}, start=${settledWeekData.start_date}, end=${settledWeekData.end_date}`,
        );

        let settledParsed: CurrentWeekData = {
          weekId: settledWeekData.week_id,
          startDate: settledWeekData.start_date,
          endDate: settledWeekData.end_date,
          days: settledWeekData.days || createInitialWeekData(new Date()).days,
        };

        // Ensure all days exist
        if (!settledParsed.days) {
          settledParsed.days = createInitialWeekData(new Date()).days;
        } else {
          const defaultDays = createInitialWeekData(new Date()).days;
          DAYS_OF_WEEK.forEach((day) => {
            if (!settledParsed.days[day]) {
              settledParsed.days[day] = defaultDays[day];
            }
          });
        }

        // CRITICAL: Deduplicate tasks to prevent duplicate buttons
        settledParsed.days = deduplicateWeekDays(settledParsed.days);

        // CRITICAL: Save deduped data back to DB to clean up existing duplicates
        await supabase
          .from("weeks")
          .update({ days: settledParsed.days })
          .eq("user_id", user.id)
          .eq("week_id", settledWeekData.week_id);

        const snapshotData: CurrentWeekData = JSON.parse(
          JSON.stringify(settledParsed),
        );
        setSettledWeekSnapshot(snapshotData);
        setIsReadOnly(true);
        setCurrentWeek(snapshotData);
      }

      // === STEP 2: Load current (latest, non-settled) week ===
      // Only load this if we DON'T already have a settled week to show
      // This prevents overwriting the settled snapshot
      if (!settledWeekData) {
        const { data: weekData, error: weekError } = await supabase
          .from("weeks")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_settled", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (weekError) {
          console.error("Error loading week:", weekError);
        }

        if (weekData) {
          console.log(
            `[loadData] loading current week: weekId=${weekData.week_id}`,
          );

          let parsedWeek: CurrentWeekData = {
            weekId: weekData.week_id,
            startDate: weekData.start_date,
            endDate: weekData.end_date,
            days: weekData.days || createInitialWeekData(new Date()).days,
          };

          if (!parsedWeek.days) {
            parsedWeek.days = createInitialWeekData(new Date()).days;
          } else {
            const defaultDays = createInitialWeekData(new Date()).days;
            DAYS_OF_WEEK.forEach((day) => {
              if (!parsedWeek.days[day]) {
                parsedWeek.days[day] = defaultDays[day];
              }
            });
          }

          // CRITICAL: Deduplicate tasks BEFORE setting state to prevent duplicate buttons
          parsedWeek.days = deduplicateWeekDays(parsedWeek.days);

          // CRITICAL: Save deduped data back to DB to clean up existing duplicates
          await supabase
            .from("weeks")
            .update({ days: parsedWeek.days })
            .eq("user_id", user.id)
            .eq("week_id", weekData.week_id);

          console.log(
            `[loadData] setting currentWeek from fetched data (deduplicated and cleaned up DB)`,
          );
          setCurrentWeek(parsedWeek);

          // Check if this week is in the past and needs auto-archive
          const today = new Date();
          const currentRange = getWeekRange(today);
          if (parsedWeek.startDate < currentRange.startDate) {
            await archiveWeek(parsedWeek);
            const freshWeek = createInitialWeekData(today);
            setCurrentWeek(freshWeek);
            await saveWeekToSupabase(freshWeek, false);
          }
        } else {
          // First time - create new week
          const freshWeek = createInitialWeekData(new Date());
          setCurrentWeek(freshWeek);
          await saveWeekToSupabase(freshWeek, false);
        }
      } else {
        console.log(
          `[loadData] SKIPPING current week fetch - settled week is being displayed`,
        );
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
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Save week to Supabase with optional is_settled flag
  const saveWeekToSupabase = async (
    week: CurrentWeekData,
    isSettled?: boolean,
  ) => {
    if (!user) return;

    // CRITICAL: Deduplicate tasks before saving to prevent duplicate entries in DB
    const dedupedWeek = {
      ...week,
      days: Object.fromEntries(
        Object.entries(week.days).map(([day, tasks]) => [
          day,
          tasks.filter(
            (task, index, self) =>
              index === self.findIndex((t) => t.id === task.id),
          ),
        ]),
      ),
    };

    const updatePayload: Record<string, any> = {
      start_date: dedupedWeek.startDate,
      end_date: dedupedWeek.endDate,
      days: dedupedWeek.days,
      updated_at: new Date().toISOString(),
    };
    if (isSettled !== undefined) {
      updatePayload.is_settled = isSettled;
    }

    // Try to update first
    const { data: updateData, error: updateError } = await supabase
      .from("weeks")
      .update(updatePayload)
      .eq("user_id", user.id)
      .eq("week_id", week.weekId)
      .select();

    // If no rows were updated, insert new record
    if (updateError || !updateData || updateData.length === 0) {
      const insertPayload: Record<string, any> = {
        user_id: user.id,
        week_id: dedupedWeek.weekId,
        start_date: dedupedWeek.startDate,
        end_date: dedupedWeek.endDate,
        days: dedupedWeek.days,
        updated_at: new Date().toISOString(),
      };
      if (isSettled !== undefined) {
        insertPayload.is_settled = isSettled;
      }

      const { error: insertError } = await supabase
        .from("weeks")
        .insert(insertPayload);

      if (insertError) {
        console.error("Error saving week:", insertError);
        throw insertError;
      }
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
  // Data sync is handled by AppState listener and tab focus

  // Load data on mount and auth change (only once)
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (user && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadData();
    }
  }, [user]);

  // Create a stable ref to loadData so that child screen's useFocusEffect doesn't loop infinitely
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Stable refresh function: always calls the latest loadData via ref
  const refreshData = useCallback(async (forceRefresh = false) => {
    await loadDataRef.current(forceRefresh);
  }, []);

  // App focus listener
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        if (!isClearingDataRef.current) {
          await loadData();
        }
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

  const setSimulatedDay = (day: DayOfWeek) => {
    setSimulatedDayState(day);
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

    // CRITICAL: Deduplicate first to prevent duplicate buttons
    const dedupedDays = deduplicateWeekDays(currentWeek.days);
    const updatedDays = { ...dedupedDays };
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

    // CRITICAL: Deduplicate first to prevent duplicate buttons
    const dedupedDays = deduplicateWeekDays(currentWeek.days);
    const updatedDays = { ...dedupedDays };
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

    // CRITICAL: Deduplicate first to prevent duplicate buttons
    const dedupedDays = deduplicateWeekDays(currentWeek.days);
    const updatedDays = { ...dedupedDays };
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

    // CRITICAL: Deduplicate first to prevent duplicate buttons
    const dedupedDays = deduplicateWeekDays(currentWeek.days);
    const updatedDays = { ...dedupedDays };
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

    // CRITICAL: Deduplicate first to prevent duplicate buttons
    const dedupedDays = deduplicateWeekDays(currentWeek.days);
    const updatedDays = { ...dedupedDays };
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

    // CRITICAL: Deduplicate first to prevent duplicate buttons
    const dedupedDays = deduplicateWeekDays(currentWeek.days);
    const updatedDays = { ...dedupedDays };
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

    // CRITICAL: If snapshot is already set, we're already in settled state
    // This prevents duplicate settlement from creating extra weeks
    if (settledWeekSnapshot) {
      console.log(
        `[forceWeeklyReset] Already in settled state (snapshot exists), skipping`,
      );
      return;
    }

    // CRITICAL: Check if this week is already settled in DB
    // Prevents duplicate settlements on repeated calls
    const { data: existingSettled } = await supabase
      .from("weeks")
      .select("week_id")
      .eq("user_id", user!.id)
      .eq("week_id", currentWeek.weekId)
      .eq("is_settled", true)
      .maybeSingle();

    if (existingSettled) {
      console.log(
        `[forceWeeklyReset] Week ${currentWeek.weekId} already settled in DB, skipping duplicate settlement`,
      );

      // CRITICAL: Clear stale snapshot to prevent duplicate display
      setSettledWeekSnapshot(null);
      setIsReadOnly(false);

      // Trigger a fresh load from DB to get the correct settled week data
      await loadData(true);
      return;
    }

    const finalScore = calculateWeekScore();
    const { grade, reward } = calculateGradeAndReward(finalScore);
    const approvedCount = getApprovedCount(currentWeek);
    const totalCount = getTotalCount(currentWeek);

    // Archive current week
    await archiveWeek(currentWeek);

    // Reload history to show the newly archived week
    if (user) {
      const { data: archiveData, error: archiveError } = await supabase
        .from("archive")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (archiveError) {
        console.error("Error reloading archive:", archiveError);
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
    }

    // Mark current week as settled IN THE DATABASE
    const snapshotData: CurrentWeekData = JSON.parse(
      JSON.stringify(currentWeek),
    );
    setSettledWeekSnapshot(snapshotData);
    setIsReadOnly(true);

    // Update the week's is_settled flag in DB
    await saveWeekToSupabase(currentWeek, true);

    // Create new week (ONLY save to local state, NOT to DB yet)
    // This prevents the fresh week from being inserted into DB prematurely
    // When the user loads the app next time, a new week will be created from scratch
    const nextWeekDate = new Date();
    const currentStartDate = new Date(currentWeek.startDate);
    nextWeekDate.setTime(currentStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const freshWeek = createInitialWeekData(nextWeekDate);
    setCurrentWeek(freshWeek);
  };

  const clearAllData = async () => {
    if (!user) return;

    try {
      isClearingDataRef.current = true;

      // Delete all weeks
      const { error: weeksError } = await supabase
        .from("weeks")
        .delete()
        .eq("user_id", user.id);

      if (weeksError) {
        console.error("Error deleting weeks:", weeksError);
        alert("주간 데이터 삭제 중 오류가 발생했습니다.");
        isClearingDataRef.current = false;
        return;
      }

      // Delete all archives
      const { error: archiveError } = await supabase
        .from("archive")
        .delete()
        .eq("user_id", user.id);

      if (archiveError) {
        console.error("Error deleting archives:", archiveError);
        alert("정산 기록 삭제 중 오류가 발생했습니다.");
        isClearingDataRef.current = false;
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      // Reset all state
      const freshWeek = createInitialWeekData(new Date());
      setCurrentWeek(freshWeek);
      setHistory([]);
      setSimulatedDayState(getRealDayOfWeek());
      setSettledWeekSnapshot(null);
      setIsReadOnly(false);
      setIsLoading(false);
      isLoadingRef.current = false;
      isClearingDataRef.current = false;

      console.log("All data cleared successfully");
      alert("모든 데이터가 초기화되었습니다.");
    } catch (error) {
      console.error("Error clearing all data:", error);
      isClearingDataRef.current = false;
      alert("데이터 초기화 중 오류가 발생했습니다.");
    }
  };

  const restoreSettledWeek = async () => {
    if (!settledWeekSnapshot || !user) return;

    try {
      // CRITICAL: Restore only tasks that the child actually checked
      // Tasks with status "unchecked" before settlement should remain unchecked
      // Only tasks that had some status (pending/approved/rejected) should be reset to pending
      const freshDays: { [key in DayOfWeek]: TaskItem[] } = {
        월: [],
        화: [],
        수: [],
        목: [],
        금: [],
        토: [],
        일: [],
      };

      // Deduplicate the entire settledWeekSnapshot
      const dedupedSnapshot = deduplicateWeekDays(settledWeekSnapshot.days);
      DAYS_OF_WEEK.forEach((day) => {
        const snapshotDayTasks = dedupedSnapshot[day] || [];
        // Use snapshot's tasks if available, otherwise create default unchecked tasks
        if (snapshotDayTasks.length > 0) {
          freshDays[day] = snapshotDayTasks.map((task) => {
            if (task.status === "unchecked") {
              // Child never interacted with this task - keep unchecked
              return { ...task, status: "unchecked" as const };
            }
            // Child DID interact with this task (pending/approved/rejected/partially_approved)
            // Reset to "pending" so it appears in parent's inbox for re-approval
            return {
              ...task,
              status: "pending" as const,
              checkedAt: new Date().toISOString(),
              approvedAt: undefined,
              approvedPoints: undefined,
            };
          });
        } else {
          // No data for this day - create default unchecked tasks
          freshDays[day] = DEFAULT_TASKS.map((task) => ({
            ...task,
            status: "unchecked" as const,
          }));
        }
      });

      const restoredWeek: CurrentWeekData = {
        weekId: settledWeekSnapshot.weekId,
        startDate: settledWeekSnapshot.startDate,
        endDate: settledWeekSnapshot.endDate,
        days: freshDays,
      };

      // CRITICAL: Clear snapshot FIRST before any DB operations
      // This prevents the useEffect from re-restoring the old snapshot
      setSettledWeekSnapshot(null);
      setIsReadOnly(false);

      // Delete the archive entry for ONLY this specific week
      console.log(
        `[restoreSettledWeek] Deleting archive entry for weekId=${settledWeekSnapshot.weekId}`,
      );
      const { data: deleteData, error: deleteError } = await supabase
        .from("archive")
        .delete()
        .eq("user_id", user.id)
        .eq("week_id", settledWeekSnapshot.weekId)
        .select();

      if (deleteError) {
        console.error("Error deleting archive:", deleteError);
      } else {
        console.log(`[restoreSettledWeek] Archive delete result:`, deleteData);
      }

      // CRITICAL: Explicitly clear the is_settled flag in DB
      const { error: clearSettledError } = await supabase
        .from("weeks")
        .update({ is_settled: false })
        .eq("user_id", user.id)
        .eq("week_id", restoredWeek.weekId);

      if (clearSettledError) {
        console.error("Error clearing is_settled flag:", clearSettledError);
      }

      // Update the week in the DB: restore data AND clear is_settled flag
      await saveWeekToSupabase(restoredWeek, false);

      // Set the restored week as current (don't reload from DB to avoid stale data)
      setCurrentWeek(restoredWeek);

      console.log("Week restored successfully");
    } catch (error) {
      console.error("Error restoring week:", error);
      alert("정산 취소 중 오류가 발생했습니다.");
    }
  };

  const pendingInbox = useMemo(() => {
    if (!currentWeek || !currentWeek.days) return [];
    const pendingList: { day: DayOfWeek; task: TaskItem }[] = [];

    DAYS_OF_WEEK.forEach((day) => {
      const dayTasks = currentWeek.days[day];
      if (!dayTasks) return;

      // CRITICAL: Deduplicate tasks to prevent duplicate buttons in parent inbox
      const seen = new Set<string>();
      dayTasks.forEach((task) => {
        if (seen.has(task.id)) return; // Skip duplicate
        seen.add(task.id);

        if (task.status === "pending") {
          pendingList.push({ day, task });
        }
      });
    });

    return pendingList;
  }, [currentWeek]);

  const currentScore = useMemo(() => calculateWeekScore(), [currentWeek]);
  const currentGradeInfo = calculateGradeAndReward(currentScore);

  const childViewWeek = useMemo(() => {
    const source =
      isReadOnly && settledWeekSnapshot ? settledWeekSnapshot : currentWeek;
    if (!source) return null;
    // CRITICAL: Deduplicate before rendering to prevent duplicate buttons
    return {
      ...source,
      days: deduplicateWeekDays(source.days),
    };
  }, [isReadOnly, settledWeekSnapshot, currentWeek]);

  const childScore = useMemo(
    () => calculateWeekScore(childViewWeek),
    [childViewWeek],
  );
  const childGradeInfo = calculateGradeAndReward(childScore);

  return {
    currentWeek,
    childViewWeek,
    history,
    pendingInbox,
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
    refreshData,
  };
}
