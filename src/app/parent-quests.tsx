import { ParentChildSelector } from "@/components/parent-child-selector";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_TASKS, useHabitState } from "@/hooks/use-habit-state-supabase";
import { useTheme } from "@/hooks/use-theme";
import { useFocusEffect } from "expo-router";
import { LogOut, PenSquare, Trash2, Users } from "lucide-react-native";
import React from "react";
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

const CATEGORIES = ["생활", "가사", "태도", "건강", "특별"] as const;
const DEFAULT_QUESTS: {
  id: string;
  name: string;
  category: string;
  points: number;
}[] = DEFAULT_TASKS.map((t) => ({
  id: t.id,
  name: t.name,
  category: t.category,
  points: t.points,
}));
const CATEGORY_COLORS: { [key: string]: string } = {
  생활: "#3B82F6",
  가사: "#10B981",
  태도: "#F59E0B",
  건강: "#8B5CF6",
  특별: "#EC4899",
};

type Category = (typeof CATEGORIES)[number];
type TaskFilter = "all" | "pending";

export default function ParentQuestsScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const {
    currentWeek,
    isLoading,
    isReadOnly,
    addSpecialTask,
    deleteSpecialTask,
    updateSpecialTask,
    refreshData,
    refreshChildData,
    children,
    selectedChildId,
    selectChild,
    exitChildView,
  } = useHabitState();

  const [selectedCategory, setSelectedCategory] =
    React.useState<Category>("생활");
  const [newTaskName, setNewTaskName] = React.useState("");
  const [newTaskPoints, setNewTaskPoints] = React.useState("5");
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [editingPoints, setEditingPoints] = React.useState("");
  const [showChildSelector, setShowChildSelector] = React.useState(false);

  // Auto-show child selector when parent logs in and has no child selected
  // But only if there's no saved child in localStorage
  React.useEffect(() => {
    if (user?.role === "parent" && !selectedChildId && children.length > 0) {
      // Check if there's a saved child in localStorage
      const savedChildId = localStorage.getItem("selectedChildId");
      if (!savedChildId) {
        // No saved child, show selector after a small delay
        const timer = setTimeout(() => {
          setShowChildSelector(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, selectedChildId, children]);

  // Refresh data when screen comes into focus
  // CRITICAL: Always refresh to get latest data, even in read-only mode
  // The loadChildData function now checks DB settlement status to handle cross-tab sync
  useFocusEffect(
    React.useCallback(() => {
      if (selectedChildId) {
        // 자녀 데이터를 보고 있는 경우, 자녀 데이터 새로고침
        refreshChildData();
      } else {
        // 자신의 데이터를 보고 있는 경우, 일반 데이터 새로고침
        refreshData();
      }
    }, [refreshData, refreshChildData, selectedChildId]),
  );

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

  const handleSelectChild = (childId: string) => {
    selectChild(childId);
    setShowChildSelector(false);
  };

  const handleBackToOwnData = () => {
    exitChildView();
  };

  const handleAddTask = () => {
    if (isReadOnly) {
      if (Platform.OS === "web") {
        alert("자녀의 데이터는 읽기 전용입니다.");
      } else {
        Alert.alert("알림", "자녀의 데이터는 읽기 전용입니다.");
      }
      return;
    }
    if (!newTaskName.trim()) {
      if (Platform.OS === "web") {
        alert("퀘스트 이름을 입력해 주세요!");
      } else {
        Alert.alert("입력 오류", "퀘스트 이름을 입력해 주세요!");
      }
      return;
    }
    const points = parseInt(newTaskPoints, 10);
    if (isNaN(points) || points < 1 || points > 10) {
      if (Platform.OS === "web") {
        alert("점수는 1~10 사이로 입력해 주세요!");
      } else {
        Alert.alert("입력 오류", "점수는 1~10 사이로 입력해 주세요!");
      }
      return;
    }

    // Add to all days of the current week (addSpecialTask handles adding to all days)
    addSpecialTask("월", newTaskName.trim(), points, selectedCategory);

    setNewTaskName("");
    setNewTaskPoints("5");
    // Don't call refreshData() here as it would reload the settled week
    // The state is already updated locally
    if (Platform.OS === "web") {
      alert("퀘스트가 추가되었습니다!");
    } else {
      Alert.alert("완료", "퀘스트가 추가되었습니다!");
    }
  };

  const handleDeleteTask = (taskId: string, taskName: string) => {
    if (isReadOnly) {
      if (Platform.OS === "web") {
        alert("자녀의 데이터는 읽기 전용입니다.");
      } else {
        Alert.alert("알림", "자녀의 데이터는 읽기 전용입니다.");
      }
      return;
    }
    if (Platform.OS === "web") {
      if (window.confirm(`"${taskName}" 퀘스트를 삭제하시겠습니까?`)) {
        deleteSpecialTask("월", taskId);
        // Don't call refreshData() here as it would reload the settled week
      }
    } else {
      Alert.alert("퀘스트 삭제", `"${taskName}" 퀘스트를 삭제하시겠습니까?`, [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => {
            deleteSpecialTask("월", taskId);
            // Don't call refreshData() here as it would reload the settled week
          },
        },
      ]);
    }
  };

  const handleStartEdit = (task: any) => {
    if (isReadOnly) {
      if (Platform.OS === "web") {
        alert("자녀의 데이터는 읽기 전용입니다.");
      } else {
        Alert.alert("알림", "자녀의 데이터는 읽기 전용입니다.");
      }
      return;
    }
    setEditingTaskId(task.id);
    setEditingName(task.name);
    setEditingPoints(String(task.points));
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim()) {
      if (Platform.OS === "web") {
        alert("퀘스트 이름을 입력해 주세요!");
      } else {
        Alert.alert("입력 오류", "퀘스트 이름을 입력해 주세요!");
      }
      return;
    }
    const points = parseInt(editingPoints, 10);
    if (isNaN(points) || points < 1 || points > 10) {
      if (Platform.OS === "web") {
        alert("점수는 1~10 사이로 입력해 주세요!");
      } else {
        Alert.alert("입력 오류", "점수는 1~10 사이로 입력해 주세요!");
      }
      return;
    }

    await updateSpecialTask(editingTaskId!, editingName.trim(), points);
    setEditingTaskId(null);
    // Don't call refreshData() here as it would reload the settled week
    // The state is already updated locally
    if (Platform.OS === "web") {
      alert("퀘스트가 수정되었습니다!");
    } else {
      Alert.alert("완료", "퀘스트가 수정되었습니다!");
    }
  };

  // Show child selector modal
  if (showChildSelector) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.background,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                자녀 선택
              </ThemedText>
              <Pressable
                onPress={() => setShowChildSelector(false)}
                style={[
                  styles.modalCloseButton,
                  {
                    backgroundColor: theme.backgroundSelected,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.modalCloseText,
                    {
                      color: theme.text,
                    },
                  ]}
                >
                  ✕
                </ThemedText>
              </Pressable>
            </View>
            <ParentChildSelector
              onSelectChild={handleSelectChild}
              onBack={() => setShowChildSelector(false)}
            />
          </View>
        </View>
      </ThemedView>
    );
  }

  // Show message if parent hasn't selected a child
  const showChildSelectionMessage = user?.role === "parent" && !selectedChildId;

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>
          데이터를 불러오는 중입니다... ⏳
        </ThemedText>
      </ThemedView>
    );
  }

  if (showChildSelectionMessage) {
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
                  👨👩 부모 모드
                </ThemedText>
                <ThemedText type="subtitle" style={styles.profileName}>
                  자녀 선택이 필요합니다
                </ThemedText>
              </View>
            </View>

            <ThemedView type="backgroundElement" style={styles.emptyStateCard}>
              <ThemedText style={styles.emptyEmoji}>👋</ThemedText>
              <ThemedText style={styles.emptyTitle}>
                선택한 자녀가 없습니다
              </ThemedText>
              <ThemedText
                themeColor="textSecondary"
                style={styles.emptyDescription}
              >
                자녀의 퀘스트 목록을 보려면, 먼저 자녀를 선택해주세요.
              </ThemedText>
              <Pressable
                onPress={() => setShowChildSelector(true)}
                style={({ pressed }) => [
                  styles.childSelectorBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText style={styles.childSelectorBtnText}>
                  👨👩 자녀 선택
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // If no current week data, create initial week for display
  // This ensures the quest list is always shown, even for new users
  const displayWeek = currentWeek || {
    weekId: "new",
    startDate: "",
    endDate: "",
    days: {
      월: [],
      화: [],
      수: [],
      목: [],
      금: [],
      토: [],
      일: [],
    },
  };

  // Get all tasks from the current week (including default tasks)
  // Combine DB tasks with default tasks to ensure all quests are shown
  const dbTasks = displayWeek.days["월"] || [];
  const allTasks = [
    ...DEFAULT_QUESTS,
    ...dbTasks.filter(
      (task) =>
        !DEFAULT_QUESTS.some((defaultTask) => defaultTask.id === task.id),
    ),
  ];
  const specialTasks = allTasks.filter((task) => task.category === "특별");

  // Determine if a task is a built-in default task (not editable/deletable)
  const isDefaultTask = (taskId: string) =>
    DEFAULT_QUESTS.some((defaultTask) => defaultTask.id === taskId);

  // Group by selected category
  const filteredTasks =
    selectedCategory === "특별"
      ? allTasks.filter((task) => task.category === "특별")
      : allTasks.filter((task) => task.category === selectedCategory);

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
                {selectedChildId ? "자녀 퀘스트 관리" : "부모 관리자"}
              </ThemedText>
              <ThemedText type="subtitle" style={styles.profileName}>
                {selectedChildId
                  ? `${children.find((c) => c.id === selectedChildId)?.display_name || "자녀"}의 퀘스트`
                  : "퀘스트 관리"}
              </ThemedText>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonRow}>
            {user?.role === "parent" && (
              <Pressable
                onPress={() => setShowChildSelector(true)}
                style={({ pressed }) => [
                  styles.childSelectorBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Users size={16} color="#FFFFFF" strokeWidth={2} />
                <ThemedText style={styles.childSelectorBtnText}>
                  자녀 선택
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <LogOut size={16} color="#FFFFFF" strokeWidth={2} />
              <ThemedText style={styles.logoutBtnText}>로그아웃</ThemedText>
            </Pressable>
          </View>

          {/* Add New Quest Card */}
          <ThemedView type="backgroundElement" style={styles.addCard}>
            <ThemedText style={styles.addCardTitle}>새 퀘스트 추가</ThemedText>

            {/* Category Selector */}
            <View style={styles.categorySelector}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor:
                        selectedCategory === cat
                          ? CATEGORY_COLORS[cat]
                          : theme.backgroundSelected,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.categoryChipText,
                      {
                        color:
                          selectedCategory === cat ? "#FFFFFF" : theme.text,
                      },
                    ]}
                  >
                    {cat}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Task Name Input */}
            <TextInput
              placeholder="퀘스트 이름 (예: 책 읽기 30분)"
              placeholderTextColor={theme.textSecondary}
              value={newTaskName}
              onChangeText={setNewTaskName}
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSelected,
                },
              ]}
            />

            {/* Points Input */}
            <View style={styles.pointsInputRow}>
              <ThemedText style={styles.pointsLabel}>점수:</ThemedText>
              <TextInput
                placeholder="1-10"
                placeholderTextColor={theme.textSecondary}
                value={newTaskPoints}
                onChangeText={setNewTaskPoints}
                keyboardType="number-pad"
                style={[
                  styles.pointsInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundSelected,
                  },
                ]}
              />
            </View>

            <Pressable
              onPress={handleAddTask}
              style={({ pressed }) => [
                styles.addButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={styles.addButtonText}>퀘스트 추가</ThemedText>
            </Pressable>
          </ThemedView>

          {/* Quest List */}
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              {selectedCategory} 퀘스트 목록
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.taskCount}>
              {filteredTasks.length}개
            </ThemedText>
          </View>

          {filteredTasks.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText style={styles.emptyEmoji}>📝</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {selectedCategory} 카테고리에 퀘스트가 없습니다.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={styles.taskList}>
              {filteredTasks.map((task, idx) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskItem,
                    {
                      borderBottomColor: theme.backgroundSelected,
                      borderBottomWidth:
                        idx === filteredTasks.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  {editingTaskId === task.id ? (
                    // Edit Mode
                    <View style={styles.editContainer}>
                      <TextInput
                        value={editingName}
                        onChangeText={setEditingName}
                        style={[
                          styles.editInput,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundSelected,
                          },
                        ]}
                      />
                      <View style={styles.editRow}>
                        <TextInput
                          value={editingPoints}
                          onChangeText={setEditingPoints}
                          keyboardType="number-pad"
                          style={[
                            styles.editPointsInput,
                            {
                              color: theme.text,
                              backgroundColor: theme.backgroundSelected,
                            },
                          ]}
                        />
                        <Pressable
                          onPress={handleSaveEdit}
                          style={styles.saveButton}
                        >
                          <ThemedText style={styles.saveButtonText}>
                            저장
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingTaskId(null)}
                          style={styles.cancelButton}
                        >
                          <ThemedText style={styles.cancelButtonText}>
                            취소
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    // View Mode
                    <>
                      <View style={styles.taskInfo}>
                        <View
                          style={[
                            styles.categoryDot,
                            {
                              backgroundColor:
                                CATEGORY_COLORS[task.category] || "#6366F1",
                            },
                          ]}
                        />
                        <View style={styles.taskDetails}>
                          <ThemedText style={styles.taskName}>
                            {task.name}
                          </ThemedText>
                          <View style={styles.taskMeta}>
                            <View
                              style={[
                                styles.pointsBadge,
                                {
                                  backgroundColor:
                                    (CATEGORY_COLORS[task.category] ||
                                      "#6366F1") + "20",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.pointsText,
                                  {
                                    color:
                                      CATEGORY_COLORS[task.category] ||
                                      "#6366F1",
                                  },
                                ]}
                              >
                                +{task.points}점
                              </ThemedText>
                            </View>
                            <ThemedText
                              themeColor="textSecondary"
                              style={styles.categoryText}
                            >
                              {task.category}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                      <View style={styles.taskActions}>
                        <Pressable
                          onPress={() => handleStartEdit(task)}
                          style={styles.editButton}
                        >
                          <PenSquare
                            size={16}
                            color="#6366F1"
                            strokeWidth={2}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteTask(task.id, task.name)}
                          style={styles.deleteButton}
                        >
                          <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    marginVertical: Spacing.three,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 30,
    marginTop: 2,
  },
  actionButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  childSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#6366F1",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  childSelectorBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  addCard: {
    borderRadius: 20,
    padding: Spacing.four,
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  addCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: Spacing.three,
  },
  categorySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  categoryChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.two,
  },
  pointsInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  pointsLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  pointsInput: {
    width: 80,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  taskCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyStateCard: {
    borderRadius: 20,
    padding: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: Spacing.two,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: "#6366F1",
  },
  emptyState: {
    borderRadius: 20,
    paddingVertical: Spacing.six,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  taskList: {
    borderRadius: 20,
    overflow: "hidden",
  },
  taskItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.three,
  },
  taskInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskDetails: {
    flex: 1,
    gap: 4,
  },
  taskName: {
    fontSize: 14,
    fontWeight: "700",
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: "700",
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "500",
  },
  taskActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  editButton: {
    padding: 6,
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 6,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  editContainer: {
    flex: 1,
    gap: Spacing.two,
  },
  editInput: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
    fontWeight: "600",
  },
  editRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },
  editPointsInput: {
    width: 70,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
    zIndex: 1000,
  },
  modalContent: {
    borderRadius: 20,
    padding: Spacing.four,
    width: "100%",
    maxHeight: "95%",
    maxWidth: 500,
    flex: 1,
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: "700",
  },
});
