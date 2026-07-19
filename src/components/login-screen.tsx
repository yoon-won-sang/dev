import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  BorderRadius,
  MaxContentWidth,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export default function LoginScreen() {
  const theme = useTheme();
  const { login, signup, resetPassword, updatePassword, isPasswordRecovery } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<"child" | "parent">("child");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    let success: boolean;
    if (isSignup) {
      success = await signup(email, password, role);
      if (success) {
        setError("회원가입 완료! 로그인해주세요.");
        setIsSignup(false);
      }
    } else {
      success = await login(email, password);
      if (!success) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("비밀번호를 재설정할 이메일을 입력해주세요.");
      return;
    }
    const success = await resetPassword(email);
    if (success) {
      setError("");
      alert(
        "비밀번호 재설정 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요. ✉️",
      );
      setIsForgotPassword(false);
    } else {
      setError("비밀번호 재설정 이메일 전송에 실패했습니다.");
    }
  };

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
    await updatePassword(newPassword);
  };

  // Password recovery mode: show new password form
  if (isPasswordRecovery) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
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

              <ThemedView type="backgroundElement" style={styles.loginCard}>
                <ThemedText style={styles.loginTitle}>
                  새 비밀번호 설정
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.loginSub}>
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
                    styles.loginButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={["#833AB4", "#FD1D1D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <ThemedText style={styles.loginButtonText}>
                      비밀번호 변경
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </ThemedView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Forgot password mode: show email input only
  if (isForgotPassword) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              <View style={styles.brandSection}>
                <ThemedText style={styles.logoEmoji}>🔑</ThemedText>
                <ThemedText type="subtitle" style={styles.appName}>
                  비밀번호 찾기
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.appDesc}>
                  가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
                </ThemedText>
              </View>

              <ThemedView type="backgroundElement" style={styles.loginCard}>
                <ThemedText style={styles.loginTitle}>이메일 입력</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.loginSub}>
                  계정에 등록된 이메일 주소를 입력해주세요.
                </ThemedText>

                <TextInput
                  placeholder="이메일"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError("");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
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
                  onPress={handleForgotPassword}
                  style={({ pressed }) => [
                    styles.loginButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={["#833AB4", "#FD1D1D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <ThemedText style={styles.loginButtonText}>
                      재설정 링크 전송
                    </ThemedText>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setIsForgotPassword(false);
                    setError("");
                  }}
                  style={styles.switchModeButton}
                >
                  <ThemedText style={styles.switchModeText}>
                    로그인으로 돌아가기
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
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
                placeholder="이메일"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError("");
                }}
                onSubmitEditing={handleSubmit}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
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
                placeholder="비밀번호"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                onSubmitEditing={handleSubmit}
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

              {isSignup && (
                <View style={styles.roleSelector}>
                  <ThemedText style={styles.roleLabel}>역할 선택:</ThemedText>
                  <View style={styles.roleButtons}>
                    <Pressable
                      onPress={() => setRole("child")}
                      style={[
                        styles.roleButton,
                        {
                          backgroundColor:
                            role === "child"
                              ? "#6366F1"
                              : theme.backgroundSelected,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.roleButtonText,
                          { color: role === "child" ? "#FFFFFF" : theme.text },
                        ]}
                      >
                        아이
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setRole("parent")}
                      style={[
                        styles.roleButton,
                        {
                          backgroundColor:
                            role === "parent"
                              ? "#6366F1"
                              : theme.backgroundSelected,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.roleButtonText,
                          { color: role === "parent" ? "#FFFFFF" : theme.text },
                        ]}
                      >
                        부모
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.loginButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <LinearGradient
                  colors={["#833AB4", "#FD1D1D"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <ThemedText style={styles.loginButtonText}>
                    {isSignup ? "회원가입" : "로그인"}
                  </ThemedText>
                </LinearGradient>
              </Pressable>

              {!isSignup && (
                <Pressable
                  onPress={() => {
                    setIsForgotPassword(true);
                    setError("");
                  }}
                  style={styles.forgotPasswordButton}
                >
                  <ThemedText style={styles.forgotPasswordText}>
                    비밀번호를 잊으셨나요?
                  </ThemedText>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  setIsSignup(!isSignup);
                  setError("");
                }}
                style={styles.switchModeButton}
              >
                <ThemedText style={styles.switchModeText}>
                  {isSignup
                    ? "이미 계정이 있으신가요? 로그인"
                    : "계정이 없으신가요? 회원가입"}
                </ThemedText>
              </Pressable>

              <View style={styles.hintSection}>
                <ThemedText themeColor="textSecondary" style={styles.hintLabel}>
                  관계자외 출입금지
                </ThemedText>
              </View>
            </ThemedView>
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
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
    letterSpacing: -0.5,
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
    borderRadius: BorderRadius.xlarge,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Shadows.medium,
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
    borderRadius: BorderRadius.medium,
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
    borderRadius: BorderRadius.medium,
    overflow: "hidden",
    marginTop: Spacing.one,
  },
  gradientButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
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
  roleSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  roleButtons: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.small,
    alignItems: "center",
    justifyContent: "center",
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchModeButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
  },
  forgotPasswordButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
  },
});
