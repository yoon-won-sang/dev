import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useHabitState } from "@/hooks/use-habit-state-supabase";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import React from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

interface Child {
  id: string;
  display_name: string;
  email: string;
}

export function ParentChildSelector({
  onSelectChild,
  onBack,
}: {
  onSelectChild: (childId: string) => void;
  onBack?: () => void;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  const { children, loadChildrenList } = useHabitState();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [availableChildren, setAvailableChildren] = React.useState<
    Array<{ id: string; display_name: string; email: string }>
  >([]);
  const [showAddModal, setShowAddModal] = React.useState(false);

  React.useEffect(() => {
    loadChildrenList();
  }, [loadChildrenList]);

  const filteredChildren = React.useMemo(() => {
    if (!searchQuery.trim()) return children;
    const query = searchQuery.toLowerCase();
    return children.filter(
      (child) =>
        child.display_name?.toLowerCase().includes(query) ||
        child.email?.toLowerCase().includes(query),
    );
  }, [children, searchQuery]);

  const handleAddChild = () => {
    loadAvailableChildren();
    setShowAddModal(true);
  };

  const loadAvailableChildren = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc("get_available_children");

      if (error) {
        console.error("Error loading available children:", error);
        Alert.alert(
          "오류",
          "사용 가능한 자식 목록을 불러오는 중 오류가 발생했습니다.",
        );
        return;
      }

      if (data) {
        setAvailableChildren(data);
      }
    } catch (error) {
      console.error("Failed to load available children:", error);
      Alert.alert(
        "오류",
        "사용 가능한 자식 목록을 불러오는 중 오류가 발생했습니다.",
      );
    }
  };

  const selectAndAddChild = async (childId: string) => {
    if (!user) return;

    try {
      // Add relationship
      const { error: relationError } = await supabase
        .from("parent_child_relations")
        .insert({
          parent_id: user.id,
          child_id: childId,
        });

      if (relationError) {
        console.error("Error adding child:", relationError);
        Alert.alert("오류", "자식 추가 중 오류가 발생했습니다.");
        return;
      }

      const child = availableChildren.find((c) => c.id === childId);
      Alert.alert(
        "성공",
        `${child?.display_name || "자식"}을(를) 자식으로 추가했습니다.`,
      );
      setShowAddModal(false);
      loadChildrenList();
    } catch (error) {
      console.error("Error adding child:", error);
      Alert.alert("오류", "자식 추가 중 오류가 발생했습니다.");
    }
  };

  const addChildByEmail = async (email: string) => {
    if (!user) return;

    try {
      // Find user by email using RPC function
      const { data: authUsers, error: authError } = await supabase.rpc(
        "find_user_by_email",
        { email_to_find: email },
      );

      if (authError) {
        console.error("Error fetching users:", authError);
        Alert.alert("오류", "사용자 목록을 불러오는 중 오류가 발생했습니다.");
        return;
      }

      // Find the child with matching email
      const childUser = authUsers?.[0];

      if (!childUser) {
        Alert.alert(
          "오류",
          "해당 이메일로 등록된 자식 계정을 찾을 수 없습니다.",
        );
        return;
      }

      // Get child's profile
      const { data: childProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", childUser.id)
        .single();

      if (profileError || !childProfile) {
        Alert.alert("오류", "자식 프로필을 찾을 수 없습니다.");
        return;
      }

      if (!childProfile) {
        Alert.alert(
          "오류",
          "해당 이메일로 등록된 자식 계정을 찾을 수 없습니다.",
        );
        return;
      }

      // Check if already added
      const { data: existingRelation } = await supabase
        .from("parent_child_relations")
        .select("*")
        .eq("parent_id", user.id)
        .eq("child_id", childProfile.id)
        .maybeSingle();

      if (existingRelation) {
        Alert.alert("알림", "이미 추가된 자식입니다.");
        return;
      }

      // Add relationship
      const { error: relationError } = await supabase
        .from("parent_child_relations")
        .insert({
          parent_id: user.id,
          child_id: childProfile.id,
        });

      if (relationError) {
        console.error("Error adding child:", relationError);
        Alert.alert("오류", "자식 추가 중 오류가 발생했습니다.");
        return;
      }

      Alert.alert(
        "성공",
        `${childProfile.display_name}을(를) 자식으로 추가했습니다.`,
      );
      loadChildrenList();
    } catch (error) {
      console.error("Error adding child:", error);
      Alert.alert("오류", "자식 추가 중 오류가 발생했습니다.");
    }
  };

  const renderAvailableChildItem = React.useCallback(
    ({
      item,
    }: {
      item: { id: string; display_name: string; email: string };
    }) => (
      <View style={styles.childCard}>
        <View style={styles.childCardContent}>
          <View style={styles.childInfo}>
            <ThemedText style={styles.childName}>
              {item.display_name || "이름 없음"}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.childEmail}>
              {item.email}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => selectAndAddChild(item.id)}
            style={({ pressed }) => [
              styles.selectButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText style={styles.selectButtonText}>선택</ThemedText>
          </Pressable>
        </View>
      </View>
    ),
    [theme, selectAndAddChild],
  );

  const handleRemoveChild = (child: Child) => {
    if (Platform.OS === "web") {
      if (
        window.confirm(
          `${child.display_name}을(를) 자식 목록에서 제거하시겠습니까?`,
        )
      ) {
        removeChild(child.id);
      }
    } else {
      Alert.alert(
        "자식 제거",
        `${child.display_name}을(를) 자식 목록에서 제거하시겠습니까?`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "제거",
            style: "destructive",
            onPress: () => removeChild(child.id),
          },
        ],
      );
    }
  };

  const removeChild = async (childId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("parent_child_relations")
        .delete()
        .eq("parent_id", user.id)
        .eq("child_id", childId);

      if (error) {
        console.error("Error removing child:", error);
        Alert.alert("오류", "자식 제거 중 오류가 발생했습니다.");
        return;
      }

      Alert.alert("성공", "자식이 제거되었습니다.");
      loadChildrenList();
    } catch (error) {
      console.error("Error removing child:", error);
      Alert.alert("오류", "자식 제거 중 오류가 발생했습니다.");
    }
  };

  const renderChildItem = ({ item }: { item: Child }) => (
    <View style={styles.childCard}>
      <View style={styles.childCardContent}>
        <View style={styles.childInfo}>
          <ThemedText style={styles.childName}>
            {item.display_name || "이름 없음"}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.childEmail}>
            {item.email}
          </ThemedText>
        </View>
        <View style={styles.childActions}>
          <Pressable
            onPress={() => onSelectChild(item.id)}
            style={({ pressed }) => [
              styles.selectButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText style={styles.selectButtonText}>선택</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleRemoveChild(item)}
            style={({ pressed }) => [
              styles.removeButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText style={styles.removeButtonText}>제거</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText themeColor="textSecondary" style={styles.greetingText}>
              자녀 관리
            </ThemedText>
            <ThemedText type="subtitle" style={styles.title}>
              내 자녀 목록
            </ThemedText>
          </View>
        </View>

        {/* Search and Add */}
        <View style={styles.actionContainer}>
          <TextInput
            placeholder="자식 검색..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[
              styles.searchInput,
              {
                color: theme.text,
                backgroundColor: theme.backgroundSelected,
                borderColor: theme.backgroundSelected,
              },
            ]}
          />
          <Pressable
            onPress={handleAddChild}
            style={({ pressed }) => [
              styles.addButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ThemedText style={styles.addButtonText}>+ 자식 추가</ThemedText>
          </Pressable>
        </View>

        {/* Children List */}
        {filteredChildren.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyEmoji}>👨‍👩‍👧‍👦</ThemedText>
            <ThemedText style={styles.emptyText}>
              {searchQuery
                ? "검색 결과가 없습니다."
                : "등록된 자식이 없습니다.\n자식을 추가해주세요!"}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredChildren}
            renderItem={renderChildItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </ScrollView>

      {/* Add Child Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View
            style={[
              {
                backgroundColor: theme.background,
                borderRadius: 16,
                padding: Spacing.five,
                width: "100%",
                maxHeight: "80%",
              },
            ]}
          >
            <ThemedText type="subtitle" style={styles.modalTitle}>
              자식 추가
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.modalSubtitle}>
              추가할 자식을 선택하세요
            </ThemedText>

            {availableChildren.length === 0 ? (
              <View style={styles.emptyModalContainer}>
                <ThemedText
                  style={[
                    {
                      fontSize: 15,
                      fontWeight: "600",
                      color: theme.textSecondary,
                    },
                  ]}
                >
                  추가할 수 있는 자식이 없습니다.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={availableChildren}
                renderItem={renderAvailableChildItem}
                keyExtractor={(item) => item.id}
                style={styles.modalList}
              />
            )}

            <Pressable
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <ThemedText style={styles.closeButtonText}>닫기</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
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
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 30,
  },
  actionContainer: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    fontWeight: "600",
    borderWidth: 1,
  },
  addButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    gap: Spacing.two,
  },
  childCard: {
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
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
  childCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  childEmail: {
    fontSize: 13,
    fontWeight: "500",
  },
  childActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  selectButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  selectButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  removeButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  removeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.six * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.three,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.four,
  },
  modalList: {
    maxHeight: 400,
  },
  emptyModalContainer: {
    paddingVertical: Spacing.six * 2,
    alignItems: "center",
  },
  closeButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.four,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
