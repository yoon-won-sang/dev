import { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!id.trim()) {
      setError("아이디를 입력해주세요.");
      return;
    }
    const success = login(id);
    if (!success) {
      setError("존재하지 않는 아이디입니다.");
      setId("");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.content}>
          {/* App Branding */}
          <View style={styles.brandSection}>
            <ThemedText style={styles.logoEmoji}>🌱</ThemedText>
            <ThemedText type="subtitle" style={styles.appName}>
              성실함 정산소
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.appDesc}>
              오늘도 성실하게! 습관을 기록하고 보상을 받아보세요.
            </ThemedText>
          </View>

          {/* Login Card */}
          <ThemedView type="backgroundElement" style={styles.loginCard}>
            <ThemedText style={styles.loginTitle}>로그인</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.loginSub}>
              아이디를 입력해주세요.
            </ThemedText>

            <TextInput
              placeholder="아이디 입력"
              placeholderTextColor={theme.textSecondary}
              value={id}
              onChangeText={(text) => {
                setId(text);
                setError("");
              }}
              onSubmitEditing={handleLogin}
              autoCapitalize="none"
              autoCorrect={false}
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
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText style={styles.loginButtonText}>로그인</ThemedText>
            </Pressable>

            <View style={styles.hintSection}>
              {/* <ThemedText themeColor="textSecondary" style={styles.hintLabel}>
                테스트 계정
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.hintText}>
                jiwoo (아이) / admin (관리자)
              </ThemedText> */}
              <ThemedText themeColor="textSecondary" style={styles.hintLabel}>
                관계자외 출입금지
              </ThemedText>
            </View>
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
  loginCard: {
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
  loginTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  loginSub: {
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
  loginButton: {
    backgroundColor: "#6366F1",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  hintSection: {
    alignItems: "center",
    marginTop: Spacing.two,
    gap: 4,
  },
  hintLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  hintText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
