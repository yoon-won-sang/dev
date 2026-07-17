import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (newPassword.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    const success = await updatePassword(newPassword);
    if (success) {
      router.replace("/");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.content}>
          <View style={styles.brandSection}>
            <ThemedText style={styles.logoEmoji}>🔑</ThemedText>
            <ThemedText type="subtitle" style={styles.appName}>
              비밀번호 재설정
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.appDesc}>
              새 비밀번호를 입력해주세요.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText style={styles.cardTitle}>새 비밀번호 설정</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.cardSub}>
              6자 이상 입력해주세요.
            </ThemedText>

            <TextInput
              placeholder="새 비밀번호"
              placeholderTextColor={theme.textSecondary}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSelected,
                  borderColor: error ? "#EF4444" : theme.backgroundSelected,
                },
              ]}
            />
            <TextInput
              placeholder="비밀번호 확인"
              placeholderTextColor={theme.textSecondary}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSelected,
                  borderColor: error ? "#EF4444" : theme.backgroundSelected,
                },
              ]}
            />

            {error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : null}

            <Pressable
              onPress={handleUpdatePassword}
              style={({ pressed }) => [
                styles.button,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={styles.buttonText}>비밀번호 변경</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  brandSection: {
    alignItems: "center",
    gap: Spacing.two,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: Spacing.one,
  },
  appName: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  appDesc: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  cardSub: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.one,
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
  button: {
    backgroundColor: "#6366F1",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
