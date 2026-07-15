import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { DayOfWeek, useHabitState } from "@/hooks/use-habit-state-supabase";
import { useTheme } from "@/hooks/use-theme";
import { useFocusEffect } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DAYS_OF_WEEK: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

// Scoring criteria per task from the official score table
const SCORE_CRITERIA: {
  [key: string]: { full: string; partial: string; rejected: string };
} = {
  bed_making: {
    full: "각을 잡아 반듯하게 펴고 베개 제자리",
    partial: "이불은 폈으나 베개 흩어짐",
    rejected: "이불이 뭉쳐 있음",
  },
  bag_tidying: {
    full: "가방을 걸고 불필요한 쓰레기 비움",
    partial: "가방을 바닥에 그냥 둠",
    rejected: "가방에 쓰레기가 가득",
  },
  clothes_organizing: {
    full: "옷걸이에 걸거나 빨래통에 넣음",
    partial: "의자에 걸쳐둠",
    rejected: "방바닥에 방치",
  },
  bathroom_drying: {
    full: "닦고 수건은 빨래통에 넣기",
    partial: "물기는 닦음, 수건 바닥에",
    rejected: "물기가 그대로 있음",
  },
  shoes_tidying: {
    full: "앞코를 현관 쪽으로 정렬",
    partial: "벗어두기만 함",
    rejected: "현관을 막고 있음",
  },
  dish_prep: {
    full: "잔반 비우고 물에 담가둠",
    partial: "잔반은 남음, 물에 담금",
    rejected: "식탁에 그대로 방치",
  },
  trash_emptying: {
    full: "분리수거함에 넣고 쓰레기 비움",
    partial: "분리수거함 근처에 둠",
    rejected: "쓰레기가 넘쳐남",
  },
  emotion_control: {
    full: "요청에 밝게 대답함",
    partial: "무표정/군말 없이 함",
    rejected: "소리 지름/투덜댐",
  },
  greeting_politely: {
    full: "눈 맞추고 밝게 인사",
    partial: "작게 대답함",
    rejected: "대답 없음",
  },
  sleep_early: {
    full: "12시 전 방에 들어가 점등",
    partial: "12시 전후",
    rejected: "12시 이후 활동",
  },
};

const GRADE_TIERS = [
  { name: "C", minScore: 0, reward: 3000, color: "#94A3B8" },
  { name: "B", minScore: 175, reward: 6000, color: "#3B82F6" },
  { name: "A", minScore: 210, reward: 9000, color: "#8B5CF6" },
  { name: "A+", minScore: 245, reward: 12000, color: "#EC4899" },
  { name: "S", minScore: 280, reward: 15000, color: "#10B981" },
];

export default function ParentAdminScreen() {
  const theme = useTheme();
  const { logout } = useAuth();
  const {
    currentWeek,
    history,
    pendingInbox,
    simulatedDay,
    isLoading,
    currentScore,
    currentGrade,
    currentReward,
    setSimulatedDay,
    approveTask,
    partialApproveTask,
    rejectTask,
    updateMultipleTasks,
    forceWeeklyReset,
    restoreSettledWeek,
    clearAllData,
    refreshData,
  } = useHabitState();

  // 검수/정산 화면으로 이동시 자동 조회 (쿨다운 가드로 무한루프 방지)
  useFocusEffect(() => {
    refreshData();
  });

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

  if (isLoading || !currentWeek) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>
          데이터를 불러오는 중입니다... ⏳
        </ThemedText>
      </ThemedView>
    );
  }

  const handleApproveAll = async () => {
    if (pendingInbox.length === 0) return;

    const updates = pendingInbox.map(({ day, task }) => ({
      day,
      taskId: task.id,
      status: "approved" as const,
      approvedPoints: task.points, // Full points for batch approve
    }));

    await updateMultipleTasks(updates);

    if (Platform.OS === "web") {
      alert(`총 ${pendingInbox.length}개의 항목을 모두 승인했습니다! 🎉`);
    } else {
      Alert.alert(
        "일괄 승인 완료",
        `총 ${pendingInbox.length}개의 항목을 모두 승인했습니다!`,
      );
    }
  };

  const handleResetSimulation = () => {
    const runReset = () => {
      forceWeeklyReset();
      if (Platform.OS === "web") {
        alert(
          "주간 정산이 완료되었습니다! 기록이 아카이브에 저장되고 다음 주로 리셋되었습니다. 💰",
        );
      } else {
        Alert.alert(
          "정산 완료 💰",
          "기록이 저장되고 새 주차로 초기화되었습니다.",
        );
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "현재 점수로 주간 정산을 강제 완료하시겠습니까? 이번 주 기록은 보관함으로 이동합니다.",
        )
      ) {
        runReset();
      }
    } else {
      Alert.alert(
        "주간 정산 시뮬레이션",
        "현재 점수로 정산을 완료하고 새 주차로 리셋하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { text: "정산하기", onPress: runReset },
        ],
      );
    }
  };

  const handleClearAll = () => {
    const runClear = () => {
      clearAllData();
      if (Platform.OS === "web") {
        alert("모든 데이터가 초기화되었습니다.");
      } else {
        Alert.alert("초기화 완료", "모든 데이터가 초기화되었습니다.");
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "전체 데이터(습관 체크 및 정산 이력)를 영구 삭제하고 초기화하시겠습니까?",
        )
      ) {
        runClear();
      }
    } else {
      Alert.alert(
        "전체 데이터 초기화",
        "모든 데이터가 삭제됩니다. 계속하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { text: "초기화", style: "destructive", onPress: runClear },
        ],
      );
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
                신뢰와 지지의 공간 🤝
              </ThemedText>
              <ThemedText type="subtitle" style={styles.profileName}>
                검수 및 용돈 정산소 💰
              </ThemedText>
            </View>
            <View style={styles.headerRight}>
              <View
                style={[
                  styles.badgeContainer,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <ThemedText style={styles.badgeText}>
                  보관함 {history.length}회
                </ThemedText>
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

          {/* Pending Approval Inbox */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={styles.sectionTitle}>
                검수 대기 목록
              </ThemedText>
              {pendingInbox.length > 0 && (
                <View style={styles.countBadge}>
                  <ThemedText style={styles.countBadgeText}>
                    {pendingInbox.length}
                  </ThemedText>
                </View>
              )}
            </View>
            {pendingInbox.length > 0 && (
              <Pressable
                onPress={handleApproveAll}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <ThemedText style={styles.approveAllText}>모두 승인</ThemedText>
              </Pressable>
            )}
          </View>

          {pendingInbox.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyInbox}>
              <ThemedText style={styles.emptyEmoji}>☕</ThemedText>
              <ThemedText style={styles.emptyText}>
                검수 대기 중인 습관이 없습니다!
              </ThemedText>
              <ThemedText
                themeColor="textSecondary"
                style={styles.emptySubText}
              >
                아이가 완료 버튼을 누르면 여기에 나타납니다.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.inboxList}>
              {pendingInbox.map(
                ({ day, task }: { day: DayOfWeek; task: any }) => (
                  <ThemedView
                    key={`${day}_${task.id}`}
                    type="backgroundElement"
                    style={styles.inboxCard}
                  >
                    <View style={styles.inboxCardLeft}>
                      <View style={styles.inboxDayBadge}>
                        <ThemedText style={styles.inboxDayText}>
                          {day}요일
                        </ThemedText>
                      </View>
                      <View style={styles.inboxTaskInfo}>
                        <ThemedText style={styles.inboxTaskName}>
                          {task.name}
                        </ThemedText>
                        <ThemedText
                          themeColor="textSecondary"
                          style={styles.inboxTaskSub}
                        >
                          {task.category} • 최대 +{task.points}점
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.inboxActions}>
                      <Pressable
                        onPress={() => rejectTask(day, task.id)}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.rejectBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <ThemedText
                          style={[styles.actionBtnText, { color: "#EF4444" }]}
                        >
                          반려 (0점)
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => partialApproveTask(day, task.id, 2)}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.partialBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <ThemedText
                          style={[styles.actionBtnText, { color: "#D97706" }]}
                        >
                          2점 인정
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => partialApproveTask(day, task.id, 3)}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.partialBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <ThemedText
                          style={[styles.actionBtnText, { color: "#D97706" }]}
                        >
                          3점 인정
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => approveTask(day, task.id, task.points)}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.approveBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <ThemedText
                          style={[styles.actionBtnText, { color: "#FFFFFF" }]}
                        >
                          완벽 ({task.points}점)
                        </ThemedText>
                      </Pressable>
                    </View>
                    {SCORE_CRITERIA[task.id] && (
                      <View style={styles.inboxCriteriaFullWidth}>
                        <View style={styles.criteriaRow}>
                          <View
                            style={[
                              styles.criteriaDot,
                              { backgroundColor: "#10B981" },
                            ]}
                          />
                          <ThemedText
                            themeColor="textSecondary"
                            style={styles.criteriaRowText}
                          >
                            5점: {SCORE_CRITERIA[task.id].full}
                          </ThemedText>
                        </View>
                        <View style={styles.criteriaRow}>
                          <View
                            style={[
                              styles.criteriaDot,
                              { backgroundColor: "#F59E0B" },
                            ]}
                          />
                          <ThemedText
                            themeColor="textSecondary"
                            style={styles.criteriaRowText}
                          >
                            2~3점: {SCORE_CRITERIA[task.id].partial}
                          </ThemedText>
                        </View>
                        <View style={styles.criteriaRow}>
                          <View
                            style={[
                              styles.criteriaDot,
                              { backgroundColor: "#EF4444" },
                            ]}
                          />
                          <ThemedText
                            themeColor="textSecondary"
                            style={styles.criteriaRowText}
                          >
                            0점: {SCORE_CRITERIA[task.id].rejected}
                          </ThemedText>
                        </View>
                      </View>
                    )}
                  </ThemedView>
                ),
              )}
            </View>
          )}

          {/* Weekly Grade Dashboard */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              이번 주 등급 보상 현황
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.periodText}>
              ({currentWeek.startDate} ~ {currentWeek.endDate})
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.dashboardCard}>
            <View style={styles.dashboardScoreRow}>
              <View>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.dashboardLabel}
                >
                  승인된 점수 합계
                </ThemedText>
                <ThemedText style={styles.dashboardScore}>
                  {currentScore}점
                </ThemedText>
              </View>
              <View
                style={[
                  styles.dashboardRewardBadge,
                  {
                    backgroundColor:
                      GRADE_TIERS.find((t) => t.name === currentGrade)?.color +
                      "15",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dashboardRewardAmount,
                    {
                      color: GRADE_TIERS.find((t) => t.name === currentGrade)
                        ?.color,
                    },
                  ]}
                >
                  {currentReward.toLocaleString()}원 지급
                </ThemedText>
                <ThemedText
                  style={[
                    styles.dashboardGradeText,
                    {
                      color: GRADE_TIERS.find((t) => t.name === currentGrade)
                        ?.color,
                    },
                  ]}
                >
                  {currentGrade} 등급
                </ThemedText>
              </View>
            </View>

            {/* Visual Grade Tiers */}
            <View style={styles.tiersContainer}>
              {GRADE_TIERS.map((tier, index) => {
                const isCurrent = currentGrade === tier.name;
                return (
                  <View key={tier.name} style={styles.tierPillContainer}>
                    <View
                      style={[
                        styles.tierPill,
                        {
                          backgroundColor: isCurrent
                            ? tier.color
                            : theme.backgroundSelected,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.tierPillText,
                          {
                            color: isCurrent ? "#FFFFFF" : theme.textSecondary,
                          },
                        ]}
                      >
                        {tier.name}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.tierPoints}>
                      {tier.minScore}점+
                    </ThemedText>
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.tierReward}
                    >
                      {tier.reward.toLocaleString()}원
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min((currentScore / 280) * 100, 100)}%`,
                    backgroundColor:
                      GRADE_TIERS.find((t) => t.name === currentGrade)?.color ||
                      "#6366F1",
                  },
                ]}
              />
            </View>
            <ThemedText
              themeColor="textSecondary"
              style={styles.dashboardFooterText}
            >
              * 아이가 정해진 습관을 수행하고 부모가 승인한 점수만 실시간
              합산됩니다.
            </ThemedText>
          </ThemedView>

          {/* History Archive */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              지난 정산 내역 보관함
            </ThemedText>
          </View>

          {history.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyHistory}>
              <ThemedText
                themeColor="textSecondary"
                style={styles.emptyHistoryText}
              >
                아직 정산 이력이 없습니다. 일요일 자정이 지나 정산되면 여기에
                기록됩니다.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={styles.historyList}>
              {history.map((item, idx) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyRow,
                    {
                      borderBottomColor: theme.backgroundSelected,
                      borderBottomWidth: idx === history.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.historyLeft}>
                    <ThemedText style={styles.historyWeekId}>
                      {item.id.replace("-W", "년 ")}주차
                    </ThemedText>
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.historyDates}
                    >
                      {item.startDate.substring(5)} ~{" "}
                      {item.endDate.substring(5)}
                    </ThemedText>
                  </View>
                  <View style={styles.historyCenter}>
                    <View
                      style={[
                        styles.historyGradeBadge,
                        {
                          backgroundColor: GRADE_TIERS.find(
                            (t) => t.name === item.grade,
                          )?.color,
                        },
                      ]}
                    >
                      <ThemedText style={styles.historyGradeText}>
                        {item.grade}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.historyScoreText}>
                      {item.score}점 ({item.approvedCount}개 승인)
                    </ThemedText>
                  </View>
                  <View style={styles.historyRight}>
                    <ThemedText style={styles.historyAmount}>
                      {item.reward.toLocaleString()}원
                    </ThemedText>
                  </View>
                </View>
              ))}
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.sandboxCard}>
            <ThemedText style={styles.sandboxTitle}>⚙️ 운영자</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sandboxSub}>
              요일별 기록과 일요일 자정 정산 로직이 정상 작동하는지 테스트하기
              위해 강제로 상태를 조작할 수 있습니다.
            </ThemedText>

            {/* Today simulation selection */}
            <ThemedText style={styles.sandboxLabel}>
              1. 가상 오늘 요일 설정
            </ThemedText>
            <View style={styles.sandboxDayPicker}>
              {DAYS_OF_WEEK.map((d, idx) => {
                const isActive = simulatedDay === d;
                // Calculate the actual date for this day based on week's startDate (Monday)
                const dayDate = currentWeek?.startDate
                  ? (() => {
                      const date = new Date(currentWeek.startDate);
                      date.setDate(date.getDate() + idx);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    })()
                  : "";
                return (
                  <Pressable
                    key={d}
                    onPress={() => setSimulatedDay(d)}
                    style={[
                      styles.sandboxDayChip,
                      {
                        backgroundColor: isActive
                          ? "#F59E0B"
                          : theme.backgroundSelected,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.sandboxDayChipText,
                        { color: isActive ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {d}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.sandboxDayDateText,
                        {
                          color: isActive
                            ? "rgba(255,255,255,0.7)"
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {dayDate}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Force Reset Action */}
            <ThemedText style={styles.sandboxLabel}>
              2. 정산 로직 실행
            </ThemedText>
            <View style={styles.sandboxActionRow}>
              <Pressable
                onPress={handleResetSimulation}
                style={({ pressed }) => [
                  styles.sandboxBtn,
                  styles.primarySandboxBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText style={styles.sandboxBtnText}>
                  ⚡ 강제 주간 정산
                </ThemedText>
              </Pressable>

              {/* Restore settled week for re-approval */}
              <Pressable
                onPress={() => {
                  if (Platform.OS === "web") {
                    if (
                      window.confirm(
                        "정산된 주간을 복원하여 승인을 다시 할 수 있습니다. 현재 주간 데이터는 유지됩니다. 계속하시겠습니까?",
                      )
                    ) {
                      restoreSettledWeek();
                      alert(
                        "정산이 취소되었습니다. 승인을 다시 진행해주세요! 🔄",
                      );
                    }
                  } else {
                    Alert.alert(
                      "재정산",
                      "정산된 주간을 복원하여 승인을 다시 할 수 있습니다. 현재 주간 데이터는 유지됩니다.",
                      [
                        { text: "취소", style: "cancel" },
                        {
                          text: "재정산",
                          onPress: () => {
                            restoreSettledWeek();
                            Alert.alert(
                              "정산 취소 완료",
                              "승인을 다시 진행해주세요!",
                            );
                          },
                        },
                      ],
                    );
                  }
                }}
                style={({ pressed }) => [
                  styles.sandboxBtn,
                  styles.restoreSandboxBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText style={styles.sandboxBtnText}>
                  🔄 정산 취소하고 재승인하기
                </ThemedText>
              </Pressable>
            </View>

            {/* Clear All Data */}
            <ThemedText style={styles.sandboxLabel}>
              3. 전체 데이터 초기화
            </ThemedText>
            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => [
                styles.sandboxBtn,
                styles.dangerSandboxBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={[styles.sandboxBtnText, { color: "#EF4444" }]}>
                🗑️ 전체 데이터 초기화
              </ThemedText>
            </Pressable>
          </ThemedView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  badgeText: {
    fontSize: 13,
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  periodText: {
    fontSize: 12,
    fontWeight: "500",
  },
  countBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  approveAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366F1",
  },
  emptyInbox: {
    borderRadius: 20,
    paddingVertical: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  emptyEmoji: {
    fontSize: 28,
    marginBottom: Spacing.two,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inboxList: {
    gap: Spacing.two,
  },
  inboxCard: {
    borderRadius: 20,
    padding: Spacing.three,
    flexDirection: "column",
    gap: Spacing.two,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inboxCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inboxDayBadge: {
    backgroundColor: "#F59E0B20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inboxDayText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "800",
  },
  inboxTaskInfo: {
    flex: 1,
    gap: 2,
  },
  inboxCriteriaFullWidth: {
    gap: 3,
  },
  inboxTaskName: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  inboxTaskSub: {
    fontSize: 11,
    fontWeight: "600",
  },
  inboxCriteriaContainer: {
    marginTop: 4,
    gap: 3,
  },
  criteriaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  criteriaDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
  },
  criteriaRowText: {
    fontSize: Platform.OS === "web" ? 10 : 10,
    fontWeight: "500",
    lineHeight: Platform.OS === "web" ? 14 : 14,
    flex: 1,
    minWidth: 0,
  },
  inboxActions: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  actionBtn: {
    flex: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  partialBtn: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  approveBtn: {
    backgroundColor: "#10B981",
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: "800",
  },
  dashboardCard: {
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dashboardScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.one,
  },
  dashboardLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  dashboardScore: {
    fontSize: 36,
    fontWeight: "900",
    marginTop: 2,
  },
  dashboardRewardBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    alignItems: "center",
    gap: 2,
  },
  dashboardRewardAmount: {
    fontSize: 16,
    fontWeight: "900",
  },
  dashboardGradeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  tiersContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: Spacing.one,
  },
  tierPillContainer: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  tierPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tierPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  tierPoints: {
    fontSize: 10,
    fontWeight: "700",
  },
  tierReward: {
    fontSize: 9,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: Spacing.one,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  dashboardFooterText: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: Spacing.one,
  },
  emptyHistory: {
    borderRadius: 20,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyHistoryText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  historyList: {
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
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.three,
  },
  historyLeft: {
    flex: 1.2,
    gap: 2,
  },
  historyWeekId: {
    fontSize: 14,
    fontWeight: "800",
  },
  historyDates: {
    fontSize: 11,
    fontWeight: "500",
  },
  historyCenter: {
    flex: 1.8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyGradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  historyGradeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  historyScoreText: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#6366F1",
  },
  sandboxCard: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.15)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sandboxTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#D97706",
  },
  sandboxSub: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  sandboxLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: Spacing.one,
  },
  sandboxDayPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  sandboxDayChip: {
    flex: 1,
    paddingVertical: Spacing.one + 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sandboxDayChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  sandboxDayDateText: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
  sandboxActionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  sandboxBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primarySandboxBtn: {
    backgroundColor: "#F59E0B",
  },
  dangerSandboxBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  restoreSandboxBtn: {
    backgroundColor: "#6366F1",
  },
  sandboxBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
