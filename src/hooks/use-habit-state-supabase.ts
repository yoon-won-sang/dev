import { getRealDayOfWeek, getToday } from "@/constants/date";
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

// Export DEFAULT_TASKS for use in other screens
export { DEFAULT_TASKS };

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

export { getRealDayOfWeek } from "@/constants/date";

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
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<
    Array<{ id: string; display_name: string; email: string }>
  >([]);

  // Load selected child from localStorage on mount
  useEffect(() => {
    if (user?.role === "parent") {
      const savedChildId = localStorage.getItem("selectedChildId");
      if (savedChildId) {
        setSelectedChildId(savedChildId);
        loadChildData(savedChildId, true);
      }
    }
  }, [user]);

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

    // CRITICAL: Only load own data - child data loading is handled separately by explore.tsx
    // This prevents other tabs (오늘의 습관, 퀘스트 관리) from getting stuck on child data

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
        const today = getToday();
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

      // === STEP 1: Load current (latest, non-settled) week FIRST ===
      // This ensures the parent can always edit the current week
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
          days: weekData.days || createInitialWeekData(getToday()).days,
        };

        if (!parsedWeek.days) {
          parsedWeek.days = createInitialWeekData(getToday()).days;
        } else {
          const defaultDays = createInitialWeekData(getToday()).days;
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
        const today = getToday();
        const currentRange = getWeekRange(today);
        if (parsedWeek.startDate < currentRange.startDate) {
          await archiveWeek(parsedWeek);
          const freshWeek = createInitialWeekData(today);
          setCurrentWeek(freshWeek);
          await saveWeekToSupabase(freshWeek, false);
        }
      } else {
        // === STEP 2: Check if there's a SETTLED week in the DB ===
        // This handles cross-tab sync: parent tab may have settled a week,
        // and child tab needs to discover it via the database
        // We query ALL settled weeks and filter out empty ones (duplicate settlements)
        const { data: allSettledWeeks, error: settledWeekError } =
          await supabase
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
            days:
              settledWeekData.days || createInitialWeekData(getToday()).days,
          };

          // Ensure all days exist
          if (!settledParsed.days) {
            settledParsed.days = createInitialWeekData(getToday()).days;
          } else {
            const defaultDays = createInitialWeekData(getToday()).days;
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
        } else {
          // First time - create new week
          const freshWeek = createInitialWeekData(getToday());
          setCurrentWeek(freshWeek);
          await saveWeekToSupabase(freshWeek, false);
        }
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
    targetUserId?: string, // Optional: specify which user's record to save to
  ) => {
    if (!user) return;

    // CRITICAL: Use targetUserId if provided (for parent approving child's tasks),
    // otherwise use the logged-in user's ID
    const userIdToSave = targetUserId || user.id;

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
      .eq("user_id", userIdToSave)
      .eq("week_id", week.weekId)
      .select();

    // If no rows were updated, insert new record
    if (updateError || !updateData || updateData.length === 0) {
      const insertPayload: Record<string, any> = {
        user_id: userIdToSave,
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

  // Archive a week - accepts optional targetUserId for child data
  const archiveWeek = async (week: CurrentWeekData, targetUserId?: string) => {
    if (!user) return;

    const userIdToArchive = targetUserId || user.id;
    const score = calculateWeekScore(week);
    const { grade, reward } = calculateGradeAndReward(score);
    const approvedCount = getApprovedCount(week);
    const totalCount = getTotalCount(week);

    const { error } = await supabase.from("archive").upsert({
      user_id: userIdToArchive,
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

  // Load data for a specific child (parent mode)
  const loadChildData = async (childId: string, forceRefresh = false) => {
    if (!user || user.role !== "parent") return;

    // CRITICAL: If we already have settledWeekSnapshot and not force refresh,
    // don't reload - this prevents the snapshot from being overwritten
    // However, we still need to check if the child's week is now unsettled
    // (e.g., after parent cancels settlement in another tab)
    if (!forceRefresh && settledWeekSnapshot) {
      // Check if the child's week is still settled in DB
      const { data: checkSettled } = await supabase
        .from("weeks")
        .select("is_settled")
        .eq("user_id", childId)
        .eq("week_id", settledWeekSnapshot.weekId)
        .eq("is_settled", true)
        .maybeSingle();

      if (checkSettled) {
        console.log(
          "[loadChildData] Child week still settled in DB, keeping snapshot",
        );
        setIsLoading(false);
        return;
      }
      // If not settled anymore, clear the snapshot and continue loading fresh data
      console.log(
        "[loadChildData] Child week no longer settled, clearing snapshot and reloading",
      );
      setSettledWeekSnapshot(null);
      setIsReadOnly(false);
    }

    setIsLoading(true);
    try {
      // Load child's current (non-settled) week FIRST
      const { data: weekData, error: weekError } = await supabase
        .from("weeks")
        .select("*")
        .eq("user_id", childId)
        .eq("is_settled", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Force refresh if needed
      if (forceRefresh && !weekData) {
        console.log(
          "[loadChildData] Force refresh - no data found, retrying...",
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        const { data: retryData } = await supabase
          .from("weeks")
          .select("*")
          .eq("user_id", childId)
          .eq("is_settled", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (retryData) {
          console.log("[loadChildData] Retry successful");
        }
      }

      if (weekError) {
        console.error("Error loading child's week:", weekError);
      }

      if (weekData) {
        let parsedWeek: CurrentWeekData = {
          weekId: weekData.week_id,
          startDate: weekData.start_date,
          endDate: weekData.end_date,
          days: weekData.days || createInitialWeekData(getToday()).days,
        };

        if (!parsedWeek.days) {
          parsedWeek.days = createInitialWeekData(getToday()).days;
        } else {
          const defaultDays = createInitialWeekData(getToday()).days;
          DAYS_OF_WEEK.forEach((day) => {
            if (!parsedWeek.days[day]) {
              parsedWeek.days[day] = defaultDays[day];
            }
          });
        }

        parsedWeek.days = deduplicateWeekDays(parsedWeek.days);
        setCurrentWeek(parsedWeek);
        // CRITICAL: Child's non-settled week - parent can see it as child sees it (editable)
        setIsReadOnly(false);
        setSettledWeekSnapshot(null);
      } else {
        // No non-settled week found - check if there's a SETTLED week
        const { data: settledWeekData, error: settledWeekError } =
          await supabase
            .from("weeks")
            .select("*")
            .eq("user_id", childId)
            .eq("is_settled", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (settledWeekError) {
          console.error(
            "Error loading child's settled week:",
            settledWeekError,
          );
        }

        if (settledWeekData) {
          // Child's week is settled - show as read-only
          let settledParsed: CurrentWeekData = {
            weekId: settledWeekData.week_id,
            startDate: settledWeekData.start_date,
            endDate: settledWeekData.end_date,
            days:
              settledWeekData.days || createInitialWeekData(getToday()).days,
          };

          if (!settledParsed.days) {
            settledParsed.days = createInitialWeekData(getToday()).days;
          } else {
            const defaultDays = createInitialWeekData(getToday()).days;
            DAYS_OF_WEEK.forEach((day) => {
              if (!settledParsed.days[day]) {
                settledParsed.days[day] = defaultDays[day];
              }
            });
          }

          settledParsed.days = deduplicateWeekDays(settledParsed.days);
          const snapshotData: CurrentWeekData = JSON.parse(
            JSON.stringify(settledParsed),
          );
          setSettledWeekSnapshot(snapshotData);
          setIsReadOnly(true);
          setCurrentWeek(snapshotData);
        } else {
          // No data at all for this child
          setCurrentWeek(null);
          setIsReadOnly(false);
          setSettledWeekSnapshot(null);
        }
      }

      // Load child's archive
      const { data: archiveData, error: archiveError } = await supabase
        .from("archive")
        .select("*")
        .eq("user_id", childId)
        .order("created_at", { ascending: false });

      if (archiveError) {
        console.error("Error loading child's archive:", archiveError);
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
      console.error("Failed to load child data:", error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Load children list for parent
  const loadChildrenList = useCallback(async () => {
    if (!user || user.role !== "parent") return;

    try {
      const { data, error } = await supabase.rpc("get_children");

      if (error) {
        console.error("Error loading children:", error);
        return;
      }

      if (data) {
        setChildren(
          data.map((child: any) => ({
            id: child.id,
            display_name: child.display_name,
            email: child.email,
          })),
        );
      }
    } catch (error) {
      console.error("Failed to load children list:", error);
    }
  }, [user]);

  // Select a child to view (parent mode)
  const selectChild = async (childId: string) => {
    setSelectedChildId(childId);
    localStorage.setItem("selectedChildId", childId); // Save to localStorage
    await loadChildData(childId, true); // Force refresh to get latest data
  };

  // Exit child view and return to parent's own data
  const exitChildView = async () => {
    setSelectedChildId(null);
    localStorage.removeItem("selectedChildId"); // Remove from localStorage
    setCurrentWeek(null);
    setHistory([]);
    setIsReadOnly(false);
    setSettledWeekSnapshot(null);

    // Reload parent's own data after exiting child view
    // This ensures parent sees their latest data, not stale cached data
    await loadData(true);
  };

  // Load data on mount and auth change (only once per user)
  const initialLoadDoneRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Reset the flag when user changes (different person logging in)
    if (user && user.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user.id;
      initialLoadDoneRef.current = false;
    }

    if (user && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;

      // If parent has a saved child, skip loadData (child data will be loaded by localStorage effect)
      // This prevents parent's own data from overwriting child data on initial load
      const savedChildId = localStorage.getItem("selectedChildId");
      if (user.role === "parent" && savedChildId) {
        // loadChildData is already called by the localStorage effect above
        // Only load children list
        loadChildrenList();
      } else {
        loadData();
        // If parent, load children list
        if (user.role === "parent") {
          loadChildrenList();
        }
      }
    }
  }, [user]);

  // Create a stable ref to loadData so that child screen's useFocusEffect doesn't loop infinitely
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Stable refresh function: always calls the latest loadData via ref
  const refreshData = useCallback(async (forceRefresh = false) => {
    await loadDataRef.current(forceRefresh);
  }, []);

  // Refresh child data when screen comes into focus
  const refreshChildData = useCallback(async () => {
    if (selectedChildId) {
      console.log(
        "[refreshChildData] Refreshing child data for:",
        selectedChildId,
      );
      await loadChildData(selectedChildId, true);
    }
  }, [selectedChildId]);

  // App focus listener
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        if (!isClearingDataRef.current) {
          // If viewing child data, refresh child data specifically
          if (selectedChildId) {
            await refreshChildData();
          } else {
            await loadData();
          }
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
  }, [selectedChildId, refreshChildData]);

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
    // CRITICAL: Save to child's record if parent is viewing child data
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
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
    // CRITICAL: Save to child's record if parent is viewing child data
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
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
    // CRITICAL: Save to child's record if parent is viewing child data
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
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
    // CRITICAL: Save to child's record if parent is viewing child data
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
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
    // CRITICAL: Save to child's record if parent is viewing child data
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
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
    // CRITICAL: Save to child's record if parent is viewing child data
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
  };

  const addSpecialTask = async (
    day: DayOfWeek,
    name: string,
    points?: number,
    category?: TaskCategory,
  ) => {
    if (isReadOnly || !currentWeek || !name.trim()) return;
    const updatedDays = { ...currentWeek.days };
    const newId = `special_${Date.now()}`;
    const newTask: TaskItem = {
      id: newId,
      name: name.trim(),
      category: category ?? "특별",
      points: points ?? 5,
      status: "unchecked",
    };

    // Add the task to all days
    DAYS_OF_WEEK.forEach((d) => {
      updatedDays[d] = [...updatedDays[d], { ...newTask }];
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
  };

  const deleteSpecialTask = async (day: DayOfWeek, taskId: string) => {
    if (isReadOnly || !currentWeek) return;
    const updatedDays = { ...currentWeek.days };

    // Delete the task from all days
    DAYS_OF_WEEK.forEach((d) => {
      updatedDays[d] = updatedDays[d].filter((task) => task.id !== taskId);
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
  };

  const updateSpecialTask = async (
    taskId: string,
    name: string,
    points: number,
  ) => {
    if (isReadOnly || !currentWeek) return;
    const updatedDays = { ...currentWeek.days };

    // Update the task in all days
    DAYS_OF_WEEK.forEach((day) => {
      updatedDays[day] = updatedDays[day].map((task) => {
        if (task.id === taskId) {
          return { ...task, name: name.trim(), points };
        }
        return task;
      });
    });

    const updatedWeek = { ...currentWeek, days: updatedDays };
    setCurrentWeek(updatedWeek);
    const targetUserId = selectedChildId || undefined;
    await saveWeekToSupabase(updatedWeek, undefined, targetUserId);
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
    // Use selectedChildId if viewing child data, otherwise use user.id
    const targetUserId = selectedChildId || user!.id;
    const { data: existingSettled } = await supabase
      .from("weeks")
      .select("week_id")
      .eq("user_id", targetUserId)
      .eq("week_id", currentWeek.weekId)
      .eq("is_settled", true)
      .maybeSingle();

    if (existingSettled) {
      console.log(
        `[forceWeeklyReset] Week ${currentWeek.weekId} already settled in DB, skipping duplicate settlement`,
      );

      // CRITICAL: The week is already settled - ensure isReadOnly is true
      // This allows the "주간정산 완료" banner to show correctly
      const snapshotData: CurrentWeekData = JSON.parse(
        JSON.stringify(currentWeek),
      );
      setSettledWeekSnapshot(snapshotData);
      setIsReadOnly(true);

      // Trigger a fresh load from DB to get the correct settled week data
      if (selectedChildId) {
        await loadChildData(selectedChildId, true);
      } else {
        await loadData(true);
      }
      return;
    }

    const finalScore = calculateWeekScore();
    const { grade, reward } = calculateGradeAndReward(finalScore);
    const approvedCount = getApprovedCount(currentWeek);
    const totalCount = getTotalCount(currentWeek);

    // Archive current week - use targetUserId to save to correct user's archive
    await archiveWeek(currentWeek, targetUserId);

    // Reload history to show the newly archived week
    // Use targetUserId to query the correct user's archive
    if (user) {
      const { data: archiveData, error: archiveError } = await supabase
        .from("archive")
        .select("*")
        .eq("user_id", targetUserId)
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
    await saveWeekToSupabase(currentWeek, true, targetUserId);

    // Create new week (ONLY save to local state, NOT to DB yet)
    // This prevents the fresh week from being inserted into DB prematurely
    // When the user loads the app next time, a new week will be created from scratch
    const nextWeekDate = getToday();
    const currentStartDate = new Date(currentWeek.startDate);
    nextWeekDate.setTime(currentStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const freshWeek = createInitialWeekData(nextWeekDate);
    setCurrentWeek(freshWeek);
    setIsReadOnly(false);
    // Save the fresh week to DB immediately
    await saveWeekToSupabase(freshWeek, false, targetUserId);
  };

  const clearAllData = async () => {
    if (!user) return;

    try {
      isClearingDataRef.current = true;

      // Determine which user(s) to clear: if viewing child data, also clear child's data
      const targetUserIds: string[] = [user.id];
      if (selectedChildId && !targetUserIds.includes(selectedChildId)) {
        targetUserIds.push(selectedChildId);
      }

      // Delete all weeks for all target users
      for (const targetUserId of targetUserIds) {
        const { error: weeksError } = await supabase
          .from("weeks")
          .delete()
          .eq("user_id", targetUserId);

        if (weeksError) {
          console.error(
            `Error deleting weeks for user ${targetUserId}:`,
            weeksError,
          );
          alert("주간 데이터 삭제 중 오류가 발생했습니다.");
          isClearingDataRef.current = false;
          return;
        }

        // Delete all archives for this user
        const { error: archiveError } = await supabase
          .from("archive")
          .delete()
          .eq("user_id", targetUserId);

        if (archiveError) {
          console.error(
            `Error deleting archives for user ${targetUserId}:`,
            archiveError,
          );
          alert("정산 기록 삭제 중 오류가 발생했습니다.");
          isClearingDataRef.current = false;
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      // Reset all state
      const freshWeek = createInitialWeekData(getToday());
      setCurrentWeek(freshWeek);
      setHistory([]);
      setSimulatedDayState(getRealDayOfWeek());
      setSettledWeekSnapshot(null);
      setIsReadOnly(false);
      setIsLoading(false);
      isLoadingRef.current = false;
      isClearingDataRef.current = false;

      // Save fresh week for BOTH parent and child if viewing child data
      // This ensures when the child's tab refreshes, it finds a fresh week instead of nothing
      await saveWeekToSupabase(freshWeek, false, user.id);
      if (selectedChildId) {
        await saveWeekToSupabase(freshWeek, false, selectedChildId);
      }

      // Reload child data from DB to ensure the view shows the fresh week
      // This is needed because the parent tab was showing child data before clearing
      if (selectedChildId) {
        await loadChildData(selectedChildId, true);
      } else {
        await loadData(true);
      }

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
      // Use selectedChildId if viewing child data, otherwise use user.id
      const targetUserId = selectedChildId || user.id;
      console.log(
        `[restoreSettledWeek] Deleting archive entry for weekId=${settledWeekSnapshot.weekId}`,
      );
      const { data: deleteData, error: deleteError } = await supabase
        .from("archive")
        .delete()
        .eq("user_id", targetUserId)
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
        .eq("user_id", targetUserId)
        .eq("week_id", restoredWeek.weekId);

      if (clearSettledError) {
        console.error("Error clearing is_settled flag:", clearSettledError);
      }

      // Update the week in the DB: restore data AND clear is_settled flag
      await saveWeekToSupabase(restoredWeek, false, targetUserId);

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

  // CRITICAL: childViewWeek should use settledWeekSnapshot if it exists,
  // regardless of isReadOnly timing. This ensures settled week is shown correctly
  // when parent views child's data after settlement.
  const childViewWeek = useMemo(() => {
    // If settledWeekSnapshot exists, use it (read-only settled week)
    // Otherwise use currentWeek
    const source = settledWeekSnapshot || currentWeek;
    if (!source) return null;
    // CRITICAL: Deduplicate before rendering to prevent duplicate buttons
    return {
      ...source,
      days: deduplicateWeekDays(source.days),
    };
  }, [settledWeekSnapshot, currentWeek]);

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
    updateSpecialTask,
    forceWeeklyReset,
    restoreSettledWeek,
    clearAllData,
    refreshData,
    refreshChildData,
    // Parent mode functions
    children,
    selectedChildId,
    selectChild,
    exitChildView,
    loadChildrenList,
    loadChildData,
  };
}
