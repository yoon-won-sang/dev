import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { DayOfWeek, TaskItem, useHabitState } from "@/hooks/use-habit-state";
import { useTheme } from "@/hooks/use-theme";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Map icons to tasks for rich visual feedback
const TASK_ICONS: { [key: string]: string } = {
  bed_making: "🛏️",
  bag_tidying: "🎒",
  shoes_tidying: "👟",
  clothes_organizing: "👕",
  dish_prep: "🍽️",
  bathroom_drying: "🚿",
  trash_emptying: "♻️",
  emotion_control: "😇",
  greeting_politely: "🙇",
  sleep_early: "😴",
};

const CATEGORY_COLORS: { [key: string]: string } = {
  생활: "#3B82F6", // Blue
  가사: "#10B981", // Green
  태도: "#F59E0B", // Amber
  건강: "#8B5CF6", // Purple
  특별: "#EC4899", // Pink
};

export default function HabitChecklistScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const {
    childViewWeek,
    simulatedDay,
    isLoading,
    isReadOnly,
    childScore,
    childGrade,
    childReward,
    setSimulatedDay,
    checkTask,
    uncheckTask,
    addSpecialTask,
    deleteSpecialTask,
  } = useHabitState();

  const [specialTaskName, setSpecialTaskName] = useState("");
  const [activeDay, setActiveDay] = useState<DayOfWeek>("월");

  // Sync active day with simulated day when it changes
  React.useEffect(() => {
    if (simulatedDay) {
      setActiveDay(simulatedDay);
    }
  }, [simulatedDay]);

  if (isLoading || !childViewWeek) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>
          데이터를 불러오는 중입니다... ⏳
        </ThemedText>
      </ThemedView>
    );
  }

  const days: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];
  const tasksForSelectedDay = childViewWeek.days[activeDay] || [];

  const showReadOnlyAlert = () => {
    const message =
      "주간 정산이 완료되어 더 이상 수정할 수 없어요. 최종 결과만 확인할 수 있습니다! 🔒";
    if (Platform.OS === "web") {
      alert(message);
    } else {
      Alert.alert("정산 완료 🔒", message);
    }
  };

  const handleToggleTask = (task: TaskItem) => {
    if (isReadOnly) {
      showReadOnlyAlert();
      return;
    }
    if (task.status === "unchecked" || task.status === "rejected") {
      checkTask(activeDay, task.id);
    } else if (task.status === "pending") {
      uncheckTask(activeDay, task.id);
    } else if (task.status === "approved") {
      if (Platform.OS === "web") {
        alert("부모님이 이미 승인하신 항목은 변경할 수 없어요! 🔒");
      } else {
        Alert.alert(
          "변경 불가 🔒",
          "부모님이 이미 승인하신 항목은 변경할 수 없어요!",
        );
      }
    }
  };

  // Group tasks by category
  const categories: { [key: string]: TaskItem[] } = {
    생활: [],
    가사: [],
    태도: [],
    건강: [],
    특별: [],
  };

  tasksForSelectedDay.forEach((task) => {
    if (categories[task.category]) {
      categories[task.category].push(task);
    } else {
      categories["특별"].push(task);
    }
  });

  const handleAddSpecial = () => {
    if (isReadOnly) {
      showReadOnlyAlert();
      return;
    }
    if (!specialTaskName.trim()) {
      if (Platform.OS === "web") {
        alert("퀘스트 내용을 입력해 주세요!");
      } else {
        Alert.alert("입력 오류", "퀘스트 내용을 입력해 주세요!");
      }
      return;
    }
    addSpecialTask(activeDay, specialTaskName);
    setSpecialTaskName("");
  };

  // Calculate day completion percentage
  const totalTasksCount = tasksForSelectedDay.length;
  const completedTasksCount = tasksForSelectedDay.filter(
    (t) => t.status === "approved" || t.status === "pending",
  ).length;
  const progressPercent =
    totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;

  // Grade progress bar logic (Max is 280 for S grade)
  const scoreProgressPercent = Math.min((childScore / 280) * 100, 100);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("로그아웃 하시겠습니까?")) {
        logout();
      }
    } else {
      Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
        { text: "취소", style: "cancel" },
        { text: "로그아웃", style: "destructive", onPress: logout },
      ]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <ThemedText
                themeColor="textSecondary"
                style={styles.greetingText}
              >
                {isReadOnly
                  ? "이번 주 정산이 완료되었어요! 🎉"
                  : "오늘도 성실하게! 🌱"}
              </ThemedText>
              <ThemedText type="subtitle" style={styles.profileName}>
                {isReadOnly ? "최종 결과 확인 🔒" : "지우의 습관 기록장 📝"}
              </ThemedText>
            </View>
            <View style={styles.headerRight}>
              <View
                style={[
                  styles.badgeContainer,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText style={styles.badgeEmoji}>⭐</ThemedText>
                <ThemedText style={styles.badgeText}>{childScore}점</ThemedText>
              </View>
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.logoutBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ThemedText style={styles.logoutBtnText}>로그아웃</ThemedText>
              </Pressable>
            </View>
          </View>
          {isReadOnly && (
            <ThemedView type="backgroundElement" style={styles.readOnlyBanner}>
              <ThemedText style={styles.readOnlyBannerTitle}>
                주간 정산 완료 — 열람 전용
              </ThemedText>
              <ThemedText
                themeColor="textSecondary"
                style={styles.readOnlyBannerText}
              >
                {childViewWeek.startDate} ~ {childViewWeek.endDate} 최종
                결과입니다. 새로운 주가 시작되면 다시 기록할 수 있어요.
              </ThemedText>
            </ThemedView>
          )}

          {/* Weekly Status Reward Card */}
          <View style={[styles.rewardCard, { shadowColor: "#6366F1" }]}>
            <View style={styles.cardDecoration} />
            <View style={styles.cardDecorationSmall} />

            <View style={styles.rewardCardHeader}>
              <ThemedText style={styles.rewardLabel}>
                {isReadOnly ? "확정 등급 & 용돈" : "이번 주 예상 등급 & 용돈"}
              </ThemedText>
              <View style={styles.gradeBadge}>
                <ThemedText style={styles.gradeBadgeText}>
                  {childGrade} 등급
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.rewardAmount}>
              {childReward.toLocaleString()}원
            </ThemedText>

            <View style={styles.rewardFooter}>
              <View style={styles.progressTextContainer}>
                <ThemedText style={styles.progressText}>
                  {childScore >= 280
                    ? "🎉 최고 등급 달성! 대단해요!"
                    : isReadOnly
                      ? `최종 ${childScore}점으로 ${childGrade} 등급이 확정되었어요!`
                      : `S등급(280점)까지 ${280 - childScore}점 남았어요!`}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: "rgba(255, 255, 255, 0.2)" },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${scoreProgressPercent}%`,
                      backgroundColor: "#FFFFFF",
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Day Selector Segmented Bar */}
          <View style={styles.daySelectorContainer}>
            {days.map((d) => {
              const isActive = activeDay === d;
              const isSimToday = simulatedDay === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setActiveDay(d)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: isActive
                        ? "#6366F1"
                        : theme.backgroundElement,
                      borderColor: isSimToday ? "#F59E0B" : "transparent",
                      borderWidth: isSimToday ? 2 : 0,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.dayChipText,
                      { color: isActive ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {d}
                  </ThemedText>
                  {isSimToday && <View style={styles.todayIndicatorDot} />}
                </Pressable>
              );
            })}
          </View>

          {/* Daily Progress status */}
          <ThemedView type="backgroundElement" style={styles.dailyProgressCard}>
            <View style={styles.dailyProgressHeader}>
              <ThemedText style={styles.dailyProgressTitle}>
                {activeDay}요일 습관 달성률
              </ThemedText>
              <ThemedText style={styles.dailyProgressRatio}>
                {completedTasksCount}/{totalTasksCount}개
              </ThemedText>
            </View>
            <View
              style={[
                styles.dailyProgressBarBg,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <View
                style={[
                  styles.dailyProgressBarFill,
                  { width: `${progressPercent}%`, backgroundColor: "#10B981" },
                ]}
              />
            </View>
          </ThemedView>

          {/* Quest Checklist */}
          {Object.keys(categories).map((categoryName) => {
            const list = categories[categoryName];
            if (list.length === 0) return null;

            return (
              <View key={categoryName} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <View
                    style={[
                      styles.categoryIndicator,
                      {
                        backgroundColor:
                          CATEGORY_COLORS[categoryName] || "#6366F1",
                      },
                    ]}
                  />
                  <ThemedText style={styles.categoryTitle}>
                    {categoryName} 퀘스트
                  </ThemedText>
                </View>

                <ThemedView
                  type="backgroundElement"
                  style={styles.listContainer}
                >
                  {list.map((task, idx) => {
                    const icon = TASK_ICONS[task.id] || "✨";
                    const pointsText = `+${task.points}점`;

                    return (
                      <Pressable
                        key={task.id}
                        onPress={() => handleToggleTask(task)}
                        disabled={isReadOnly}
                        style={({ pressed }) => [
                          styles.taskRow,
                          {
                            borderBottomColor: theme.backgroundSelected,
                            borderBottomWidth: idx === list.length - 1 ? 0 : 1,
                            opacity: isReadOnly
                              ? 0.85
                              : pressed && task.status !== "approved"
                                ? 0.7
                                : 1,
                          },
                        ]}
                      >
                        <View style={styles.taskLeft}>
                          <View
                            style={[
                              styles.taskIconCircle,
                              { backgroundColor: theme.backgroundSelected },
                            ]}
                          >
                            <ThemedText style={styles.taskIconText}>
                              {icon}
                            </ThemedText>
                          </View>
                          <View style={styles.taskDetails}>
                            <ThemedText
                              style={[
                                styles.taskNameText,
                                task.status === "approved" &&
                                  styles.completedText,
                              ]}
                            >
                              {task.name}
                            </ThemedText>
                            <View style={styles.badgeRow}>
                              <View
                                style={[
                                  styles.pointsBadge,
                                  {
                                    backgroundColor:
                                      CATEGORY_COLORS[categoryName] + "20",
                                  },
                                ]}
                              >
                                <ThemedText
                                  style={[
                                    styles.pointsBadgeText,
                                    { color: CATEGORY_COLORS[categoryName] },
                                  ]}
                                >
                                  {pointsText}
                                </ThemedText>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.taskRight}>
                          {task.status === "unchecked" && (
                            <View
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: isReadOnly
                                    ? theme.backgroundSelected
                                    : "#6366F1",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBtnText,
                                  {
                                    color: isReadOnly
                                      ? theme.textSecondary
                                      : "#FFFFFF",
                                  },
                                ]}
                              >
                                {isReadOnly ? "미완료" : "완료하기"}
                              </ThemedText>
                            </View>
                          )}
                          {task.status === "pending" && (
                            <View
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                                  borderWidth: 1,
                                  borderColor: "#F59E0B",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBtnText,
                                  { color: "#D97706" },
                                ]}
                              >
                                ⏳ 대기중
                              </ThemedText>
                            </View>
                          )}
                          {task.status === "approved" && (
                            <View
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                                  borderWidth: 1,
                                  borderColor: "#10B981",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBtnText,
                                  { color: "#059669" },
                                ]}
                              >
                                ✅ 승인됨
                              </ThemedText>
                            </View>
                          )}
                          {task.status === "rejected" && !isReadOnly && (
                            <View
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                                  borderWidth: 1,
                                  borderColor: "#EF4444",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBtnText,
                                  { color: "#DC2626" },
                                ]}
                              >
                                ✕ 다시하기
                              </ThemedText>
                            </View>
                          )}
                          {task.status === "rejected" && isReadOnly && (
                            <View
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                                  borderWidth: 1,
                                  borderColor: "#EF4444",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBtnText,
                                  { color: "#DC2626" },
                                ]}
                              >
                                ❌ 반려됨
                              </ThemedText>
                            </View>
                          )}
                          {!isReadOnly &&
                            task.category === "특별" &&
                            task.status !== "approved" && (
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  deleteSpecialTask(activeDay, task.id);
                                }}
                                style={styles.deleteButton}
                              >
                                <ThemedText style={styles.deleteEmoji}>
                                  🗑️
                                </ThemedText>
                              </Pressable>
                            )}
                        </View>
                      </Pressable>
                    );
                  })}
                </ThemedView>
              </View>
            );
          })}

          {/* Propose Special Quest Card */}
          {!isReadOnly && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View
                  style={[
                    styles.categoryIndicator,
                    { backgroundColor: CATEGORY_COLORS.특별 },
                  ]}
                />
                <ThemedText style={styles.categoryTitle}>
                  특별 퀘스트 직접 제안하기
                </ThemedText>
              </View>
              <ThemedView
                type="backgroundElement"
                style={styles.specialInputCard}
              >
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.specialInputSub}
                >
                  스스로 세운 목표(운동, 독서 등)를 제안하면 승인 시 2점을
                  얻어요!
                </ThemedText>
                <View style={styles.specialInputContainer}>
                  <TextInput
                    placeholder="예: 책 읽기 30분, 홈트레이닝 하기"
                    placeholderTextColor={theme.textSecondary}
                    value={specialTaskName}
                    onChangeText={setSpecialTaskName}
                    style={[
                      styles.textInput,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundSelected,
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={handleAddSpecial}
                    style={({ pressed }) => [
                      styles.specialAddButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <ThemedText style={styles.specialAddButtonText}>
                      제출
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: Spacing.three,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  badgeEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#EF4444",
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
  },
  readOnlyBanner: {
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  readOnlyBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  readOnlyBannerText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  rewardCard: {
    backgroundColor: "#6366F1",
    borderRadius: 24,
    padding: Spacing.four,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginVertical: Spacing.two,
    position: "relative",
    overflow: "hidden",
    height: 180,
    justifyContent: "space-between",
  },
  cardDecoration: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cardDecorationSmall: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  rewardCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
  gradeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gradeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  rewardAmount: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  rewardFooter: {
    gap: Spacing.two,
  },
  progressTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  daySelectorContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.one,
    marginVertical: Spacing.three,
  },
  dayChip: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  todayIndicatorDot: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F59E0B",
  },
  dailyProgressCard: {
    borderRadius: 20,
    padding: Spacing.three,
    marginBottom: Spacing.four,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dailyProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  dailyProgressTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  dailyProgressRatio: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
  dailyProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  dailyProgressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  categorySection: {
    marginBottom: Spacing.four,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  categoryIndicator: {
    width: 6,
    height: 16,
    borderRadius: 3,
    marginRight: Spacing.two,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  listContainer: {
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
  },
  taskLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.two,
  },
  taskIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  taskIconText: {
    fontSize: 18,
  },
  taskDetails: {
    flex: 1,
    gap: 4,
  },
  taskNameText: {
    fontSize: 14,
    fontWeight: "700",
  },
  completedText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pointsBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  taskRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    padding: 4,
  },
  deleteEmoji: {
    fontSize: 14,
  },
  specialInputCard: {
    borderRadius: 20,
    padding: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  specialInputSub: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: Spacing.two,
  },
  specialInputContainer: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    fontWeight: "600",
    borderWidth: 1,
  },
  specialAddButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
  },
  specialAddButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
