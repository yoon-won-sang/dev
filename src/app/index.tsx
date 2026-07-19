import { ParentChildSelector } from "@/components/parent-child-selector";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import {
  DayOfWeek,
  TaskItem,
  useHabitState,
} from "@/hooks/use-habit-state-supabase";
import { useTheme } from "@/hooks/use-theme";
import { useFocusEffect } from "expo-router";
import {
  Backpack,
  Bath,
  BedDouble,
  Footprints,
  Handshake,
  Lightbulb,
  LogOut,
  Moon,
  Recycle,
  Shirt,
  Smile,
  Users,
  UtensilsCrossed,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Map icons to tasks for rich visual feedback - using Lucide icons
const TASK_ICONS: { [key: string]: React.ReactNode } = {
  bed_making: <BedDouble size={20} color="#3B82F6" strokeWidth={2} />,
  bag_tidying: <Backpack size={20} color="#10B981" strokeWidth={2} />,
  shoes_tidying: <Footprints size={20} color="#8B5CF6" strokeWidth={2} />,
  clothes_organizing: <Shirt size={20} color="#EC4899" strokeWidth={2} />,
  dish_prep: <UtensilsCrossed size={20} color="#F59E0B" strokeWidth={2} />,
  bathroom_drying: <Bath size={20} color="#3B82F6" strokeWidth={2} />,
  trash_emptying: <Recycle size={20} color="#10B981" strokeWidth={2} />,
  emotion_control: <Smile size={20} color="#8B5CF6" strokeWidth={2} />,
  greeting_politely: <Handshake size={20} color="#EC4899" strokeWidth={2} />,
  sleep_early: <Moon size={20} color="#6366F1" strokeWidth={2} />,
};

// Instagram-style gradient colors
const GRADIENT_COLORS = {
  primary: ["#833AB4", "#FD1D1D"] as const,
  secondary: ["#F59E0B", "#EC4899"] as const,
  success: ["#10B981", "#3B82F6"] as const,
};

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

const CATEGORY_COLORS: { [key: string]: string } = {
  생활: "#3B82F6", // Blue
  가사: "#10B981", // Green
  태도: "#F59E0B", // Amber
  건강: "#8B5CF6", // Purple
  특별: "#EC4899", // Pink
};

// 영어 속담 모음 (성실함, 습관, 성장, 인내 관련) — 영문 + 한국어 해석
const PROVERBS: { en: string; ko: string }[] = [
  {
    en: "Early to bed and early to rise, makes a man healthy, wealthy, and wise.",
    ko: "일찍 자고 일찍 일어나면 건강해지고 부자가 되고 현명해진다.",
  },
  {
    en: "A journey of a thousand miles begins with a single step.",
    ko: "천 리 길도 한 걸음부터 시작된다.",
  },
  {
    en: "Small strokes fell great oaks.",
    ko: "작은 도끼질도 큰 참나무를 쓰러뜨린다.",
  },
  { en: "Practice makes perfect.", ko: "연습이 완벽을 만든다." },
  {
    en: "Where there's a will, there's a way.",
    ko: "뜻이 있는 곳에 길이 있다.",
  },
  {
    en: "Rome wasn't built in a day.",
    ko: "로마는 하루아침에 이루어지지 않았다.",
  },
  {
    en: "Slow and steady wins the race.",
    ko: "느리지만 꾸준한 자가 경주에서 이긴다.",
  },
  {
    en: "The early bird catches the worm.",
    ko: "일찍 일어난 새가 벌레를 잡는다.",
  },
  { en: "No pain, no gain.", ko: "고통 없이는 얻는 것도 없다." },
  { en: "Habit is a second nature.", ko: "습관은 제2의 천성이다." },
  { en: "Well begun is half done.", ko: "시작이 반이다." },
  {
    en: "Actions speak louder than words.",
    ko: "말보다 행동이 더 크게 말한다.",
  },
  {
    en: "A stitch in time saves nine.",
    ko: "때 맞춘 한 바늘이 아홉 바늘을 절약한다.",
  },
  { en: "Little by little, one goes far.", ko: "조금씩 조금씩 멀리 나아간다." },
  {
    en: "He who would climb the ladder must begin at the bottom.",
    ko: "사다리를 오르려는 자는 맨 아래부터 시작해야 한다.",
  },
  { en: "Perseverance is the key to success.", ko: "인내는 성공의 열쇠다." },
  {
    en: "Today's efforts are tomorrow's rewards.",
    ko: "오늘의 노력이 내일의 보상이다.",
  },
  { en: "Every day is a new beginning.", ko: "매일이 새로운 시작이다." },
  {
    en: "Success is the sum of small efforts, repeated day in and day out.",
    ko: "성공은 매일 반복된 작은 노력의 합이다.",
  },
  {
    en: "The secret of getting ahead is getting started.",
    ko: "앞서나가는 비결은 시작하는 것이다.",
  },
  {
    en: "Discipline is the bridge between goals and accomplishment.",
    ko: "규율은 목표와 성취를 잇는 다리다.",
  },
  {
    en: "What we do today determines what we become tomorrow.",
    ko: "오늘 하는 일이 우리의 내일을 결정한다.",
  },
  {
    en: "Excellence is not a skill, it's an attitude.",
    ko: "탁월함은 기술이 아니라 태도다.",
  },
  {
    en: "The best time to plant a tree was 20 years ago. The second best time is now.",
    ko: "나무를 심기에 가장 좋은 때는 20년 전이었다. 그다음 좋은 때는 지금이다.",
  },
  {
    en: "Do what you have to do until you can do what you want to do.",
    ko: "네가 하고 싶은 일을 할 수 있을 때까지 해야 하는 일을 하라.",
  },
  {
    en: "Motivation gets you started. Habit keeps you going.",
    ko: "동기부여는 시작하게 하고, 습관은 계속 나아가게 한다.",
  },
  {
    en: "Be stronger than your strongest excuse.",
    ko: "가장 강력한 핑계보다 더 강해져라.",
  },
  {
    en: "Your habits shape your future.",
    ko: "너의 습관이 너의 미래를 만든다.",
  },
  {
    en: "Don't watch the clock; do what it does. Keep going.",
    ko: "시계를 보지 말고 시계처럼 계속 나아가라.",
  },
  {
    en: "The pain of discipline is lighter than the pain of regret.",
    ko: "규율의 고통은 후회의 고통보다 가볍다.",
  },
  {
    en: "You miss 100% of the shots you don't take.",
    ko: "시도하지 않는 슛은 100% 빗나간다.",
  },
  {
    en: "Believe you can and you're halfway there.",
    ko: "할 수 있다고 믿으면 이미 절반은 온 것이다.",
  },
  {
    en: "It does not matter how slowly you go as long as you do not stop.",
    ko: "멈추지 않는다면 얼마나 느리게 가든 상관없다.",
  },
  {
    en: "The only way to do great work is to love what you do.",
    ko: "훌륭한 일을 하는 유일한 방법은 자신이 하는 일을 사랑하는 것이다.",
  },
  {
    en: "In the middle of difficulty lies opportunity.",
    ko: "어려움 속에 기회가 있다.",
  },
  {
    en: "Fall seven times, stand up eight.",
    ko: "일곱 번 넘어져도 여덟 번 일어나라.",
  },
  {
    en: "The future belongs to those who believe in the beauty of their dreams.",
    ko: "미래는 자신의 꿈의 아름다움을 믿는 사람들의 것이다.",
  },
  {
    en: "Success is not final, failure is not fatal. It is the courage to continue that counts.",
    ko: "성공이 최종이 아니며 실패가 치명적인 것도 아니다. 중요한 것은 계속할 용기다.",
  },
  {
    en: "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
    ko: "우리 뒤에 있는 것과 앞에 있는 것은 우리 안에 있는 것에 비하면 아주 작은 것이다.",
  },
  {
    en: "The only person you are destined to become is the person you decide to be.",
    ko: "네가 될 운명을 가진 유일한 사람은 네가 되기로 결심한 사람이다.",
  },
  {
    en: "Start where you are. Use what you have. Do what you can.",
    ko: "지금 있는 곳에서 시작하라. 가진 것을 사용하라. 할 수 있는 것을 하라.",
  },
  {
    en: "Dream big and dare to fail.",
    ko: "크게 꿈꾸고 실패할 용기를 가져라.",
  },
  {
    en: "The harder you work, the luckier you get.",
    ko: "더 열심히 일할수록 더 운이 좋아진다.",
  },
  {
    en: "Quality is not an act, it is a habit.",
    ko: "품질은 행동이 아니라 습관이다.",
  },
  {
    en: "Act as if what you do makes a difference. It does.",
    ko: "네가 하는 일이 차이를 만든다고 생각하고 행동하라. 실제로 그렇다.",
  },
  {
    en: "Failure is the condiment that gives success its flavor.",
    ko: "실패는 성공에 맛을 내는 양념이다.",
  },
  {
    en: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    ko: "우리는 반복해서 하는 것들이다. 따라서 탁월함은 행동이 아니라 습관이다.",
  },
  {
    en: "Opportunities don't happen. You create them.",
    ko: "기회는 생기는 것이 아니다. 네가 만드는 것이다.",
  },
  {
    en: "The secret to getting ahead is getting started.",
    ko: "앞서나가는 비결은 시작하는 것이다.",
  },
  {
    en: "Don't let yesterday take up too much of today.",
    ko: "어제가 오늘을 너무 많이 차지하지 않게 하라.",
  },
  {
    en: "You are never too old to set another goal or to dream a new dream.",
    ko: "새로운 목표를 세우거나 새로운 꿈을 꾸기에는 결코 늦지 않았다.",
  },
  {
    en: "Try not to become a man of success, but rather try to become a man of value.",
    ko: "성공한 사람이 되려고 애쓰지 말고 가치 있는 사람이 되려고 애써라.",
  },
  {
    en: "It is during our darkest moments that we must focus to see the light.",
    ko: "가장 어두운 순간에 우리는 빛을 보기 위해 집중해야 한다.",
  },
  {
    en: "If you are going through hell, keep going.",
    ko: "지옥을 통과하고 있다면 계속 가라.",
  },
  {
    en: "The only impossible journey is the one you never begin.",
    ko: "불가능한 여정은 단 하나, 결코 시작하지 않는 것이다.",
  },
  {
    en: "Whether you think you can or you think you can't, you're right.",
    ko: "할 수 있다고 생각하든 할 수 없다고 생각하든, 너의 생각이 맞다.",
  },
  {
    en: "Success usually comes to those who are too busy to be looking for it.",
    ko: "성공은 보통 그것을 찾기에 너무 바쁜 사람들에게 온다.",
  },
  {
    en: "The mind is everything. What you think you become.",
    ko: "마음이 모든 것이다. 네가 생각하는 대로 네가 된다.",
  },
  {
    en: "An investment in knowledge pays the best interest.",
    ko: "지식에 대한 투자는 가장 좋은 이자를 준다.",
  },
  {
    en: "The only limit to our realization of tomorrow is our doubts of today.",
    ko: "내일의 실현을 제한하는 유일한 것은 오늘의 의심이다.",
  },
  {
    en: "Creativity is intelligence having fun.",
    ko: "창의성은 즐거워하는 지능이다.",
  },
  {
    en: "If you want to lift yourself up, lift up someone else.",
    ko: "자신을 일으키고 싶다면 다른 사람을 일으켜라.",
  },
  {
    en: "Limitations live only in our minds. But if we use our imaginations, our possibilities become limitless.",
    ko: "한계는 오직 우리 마음속에만 존재한다. 그러나 상상력을 사용하면 가능성은 무한해진다.",
  },
  {
    en: "When one door of happiness closes, another opens, but often we look so long at the closed door that we do not see the one which has been opened for us.",
    ko: "행복의 문 하나가 닫히면 다른 문이 열리지만, 우리는 닫힌 문을 너무 오래 바라보느라 열린 문을 보지 못한다.",
  },
  {
    en: "Life is what happens when you're busy making other plans.",
    ko: "인생은 다른 계획을 세우느라 바쁠 때 일어난다.",
  },
  {
    en: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    ko: "인생의 가장 큰 영광은 넘어지지 않는 것이 아니라 넘어질 때마다 일어나는 것이다.",
  },
  {
    en: "Many of life's failures are people who did not realize how close they were to success when they gave up.",
    ko: "인생의 실패 중 많은 경우는 포기할 때 성공에 얼마나 가까이 있었는지 깨닫지 못한 사람들이다.",
  },
  {
    en: "If you look at what you have in life, you'll always have more.",
    ko: "네가 가진 것을 보면 항상 더 많은 것을 갖게 될 것이다.",
  },
  {
    en: "Life is either a daring adventure or nothing at all.",
    ko: "인생은 대담한 모험이거나 아니면 아무것도 아니다.",
  },
  {
    en: "You must be the change you wish to see in the world.",
    ko: "네가 세상에서 보고 싶은 변화가 되어라.",
  },
  {
    en: "The way to get started is to quit talking and begin doing.",
    ko: "시작하는 방법은 말을 그만두고 행동하는 것이다.",
  },
  {
    en: "The only thing we have to fear is fear itself.",
    ko: "우리가 두려워해야 할 유일한 것은 두려움 그 자체이다.",
  },
  {
    en: "In three words I can sum up everything I've learned about life: it goes on.",
    ko: "세 단어로 인생에 대해 배운 모든 것을 요약할 수 있다: 계속된다.",
  },
  {
    en: "You have within you right now, everything it takes to deal with whatever the world can throw at you.",
    ko: "지금 이 순간 너 안에는 세상이 던지는 어떤 것도 대처할 수 있는 모든 것이 있다.",
  },
  {
    en: "The best revenge is massive success.",
    ko: "가장 좋은 복수는 엄청난 성공이다.",
  },
  {
    en: "I have not failed. I've just found 10,000 ways that won't work.",
    ko: "나는 실패한 것이 아니다. 단지 작동하지 않는 10,000가지 방법을 찾았을 뿐이다.",
  },
  {
    en: "A person who never made a mistake never tried anything new.",
    ko: "실수를 한 번도 해보지 않은 사람은 새로운 것을 시도해 본 적이 없는 사람이다.",
  },
  {
    en: "The only person you should try to be better than is the person you were yesterday.",
    ko: "더 나아져야 할 유일한 사람은 어제의 너 자신이다.",
  },
  {
    en: "Hardships often prepare ordinary people for an extraordinary destiny.",
    ko: "역경은 종종 평범한 사람들을 비범한 운명으로 준비시킨다.",
  },
  {
    en: "It always seems impossible until it's done.",
    ko: "해내기 전까지는 항상 불가능해 보인다.",
  },
  {
    en: "Keep your face always toward the sunshine, and shadows will fall behind you.",
    ko: "항상 태양을 향해 얼굴을 들면 그림자는 뒤에 떨어질 것이다.",
  },
  {
    en: "The best preparation for tomorrow is doing your best today.",
    ko: "내일을 위한 최고의 준비는 오늘 최선을 다하는 것이다.",
  },
  {
    en: "What you do today can improve all your tomorrows.",
    ko: "오늘 하는 일이 모든 내일을 더 좋게 만들 수 있다.",
  },
  {
    en: "Set your goals high, and don't stop till you get there.",
    ko: "목표를 높이 세우고 그곳에 도달할 때까지 멈추지 마라.",
  },
  {
    en: "Dreams don't work unless you do.",
    ko: "꿈은 네가 움직이지 않으면 이루어지지 않는다.",
  },
  {
    en: "Push yourself, because no one else is going to do it for you.",
    ko: "스스로 밀어붙여라. 아무도 대신 해주지 않는다.",
  },
  {
    en: "Great things never come from comfort zones.",
    ko: "위대한 것은 결코 안전지대에서 나오지 않는다.",
  },
  {
    en: "The key to success is to focus on goals, not obstacles.",
    ko: "성공의 열쇠는 장애물이 아닌 목표에 집중하는 것이다.",
  },
  {
    en: "Success is not how high you have climbed, but how you make a positive difference to the world.",
    ko: "성공은 얼마나 높이 올랐느냐가 아니라 세상에 얼마나 긍정적인 변화를 만들었느냐다.",
  },
  {
    en: "Your limitation – it's only your imagination.",
    ko: "너의 한계는 오직 너의 상상력일 뿐이다.",
  },
  {
    en: "Sometimes later becomes never. Do it now.",
    ko: "때로는 '나중에'가 '절대'가 된다. 지금 하라.",
  },
  {
    en: "Great works are performed not by strength but by perseverance.",
    ko: "위대한 일은 힘이 아니라 인내로 이루어진다.",
  },
  {
    en: "The secret of success is to do the common things uncommonly well.",
    ko: "성공의 비결은 평범한 일을 비범하게 잘하는 것이다.",
  },
  {
    en: "Don't be afraid to give up the good to go for the great.",
    ko: "위대함을 쫓기 위해 좋은 것을 포기하는 것을 두려워하지 마라.",
  },
  {
    en: "I find that the harder I work, the more luck I seem to have.",
    ko: "더 열심히 일할수록 더 운이 좋아지는 것을 발견한다.",
  },
  {
    en: "Success is walking from failure to failure with no loss of enthusiasm.",
    ko: "성공은 열정을 잃지 않고 실패에서 실패로 걸어가는 것이다.",
  },
  {
    en: "If you can dream it, you can achieve it.",
    ko: "꿈꿀 수 있다면 이룰 수 있다.",
  },
  {
    en: "Be not afraid of going slowly, be afraid only of standing still.",
    ko: "느리게 가는 것을 두려워하지 말고, 멈춰 서 있는 것을 두려워하라.",
  },
];

export default function HabitChecklistScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const {
    childViewWeek,
    currentWeek,
    simulatedDay,
    isLoading,
    isReadOnly,
    selectedChildId,
    childScore,
    childGrade,
    childReward,
    setSimulatedDay,
    checkTask,
    uncheckTask,
    addSpecialTask,
    deleteSpecialTask,
    refreshData,
    refreshChildData,
    children,
    selectChild,
    settledWeekSnapshot,
  } = useHabitState();

  const [specialTaskName, setSpecialTaskName] = useState("");
  const [activeDay, setActiveDay] = useState<DayOfWeek>("월");
  const [proverbIdx, setProverbIdx] = useState(
    Math.floor(Math.random() * PROVERBS.length),
  );
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [showChildSelector, setShowChildSelector] = useState(false);

  // Determine which week data to display
  // - If parent has selected a child, show child's data
  // - Otherwise, show current user's own data
  const displayWeek = selectedChildId ? childViewWeek : currentWeek;

  // CRITICAL: effectiveIsReadOnly should only be true when:
  // - Parent is viewing child's SETTLED data (selectedChildId is set AND settledWeekSnapshot exists)
  // - OR user is viewing their OWN settled data (not viewing child AND isReadOnly is true)
  // This ensures parent sees child's screen as child sees it (editable if not settled)
  // When settledWeekSnapshot exists and we have data to display, show the read-only banner
  const effectiveIsReadOnly = !!(
    ((selectedChildId && settledWeekSnapshot) || // Parent viewing child's settled data
      (!selectedChildId && isReadOnly)) && // User viewing their own settled data
    (selectedChildId ? childViewWeek : currentWeek)
  );

  // Refresh data when this tab gains focus
  // CRITICAL: Always refresh to get latest data, even in read-only mode
  // The loadChildData function now checks DB settlement status to handle cross-tab sync
  useFocusEffect(
    React.useCallback(() => {
      // If viewing as parent with selected child, refresh child data
      if (selectedChildId) {
        refreshChildData();
      } else {
        refreshData(); // Don't force refresh - let the cooldown handle dedup
      }
    }, [refreshData, refreshChildData, selectedChildId]),
  );

  // Auto-show child selector when parent logs in and has no child selected
  React.useEffect(() => {
    if (user?.role === "parent" && !selectedChildId && children.length > 0) {
      // Small delay to let the screen load first
      const timer = setTimeout(() => {
        setShowChildSelector(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, selectedChildId, children]);

  // Sync active day with simulated day when it changes
  React.useEffect(() => {
    if (simulatedDay) {
      setActiveDay(simulatedDay);
    }
  }, [simulatedDay]);

  // 1분마다 속담을 페이드 아웃/인 전환
  React.useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setProverbIdx(Math.floor(Math.random() * PROVERBS.length));
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [fadeAnim]);

  // Handle child selection
  const handleSelectChild = (childId: string) => {
    selectChild(childId);
    setShowChildSelector(false);
  };

  // Show child selector modal first, before any loading check
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
                  부모 모드
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
                자녀의 습관 목록을 보려면, 먼저 자녀를 선택해주세요.
              </ThemedText>
              <Pressable
                onPress={() => setShowChildSelector(true)}
                style={({ pressed }) => [
                  styles.childSelectorBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText style={styles.childSelectorBtnText}>
                  자녀 선택
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!displayWeek) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>
          데이터를 불러오는 중입니다... ⏳
        </ThemedText>
      </ThemedView>
    );
  }

  const days: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];
  const tasksForSelectedDay = displayWeek?.days?.[activeDay] || [];

  const showReadOnlyAlert = () => {
    const message = selectedChildId
      ? "이 주간은 정산이 완료되어 열람만 가능합니다. 🔒"
      : "주간 정산이 완료되어 더 이상 수정할 수 없어요. 최종 결과만 확인할 수 있습니다! 🔒";
    if (Platform.OS === "web") {
      alert(message);
    } else {
      Alert.alert("정산 완료 🔒", message);
    }
  };

  const handleToggleTask = (task: TaskItem) => {
    if (effectiveIsReadOnly) {
      showReadOnlyAlert();
      return;
    }
    if (task.status === "unchecked" || task.status === "rejected") {
      checkTask(activeDay, task.id);
    } else if (task.status === "pending") {
      uncheckTask(activeDay, task.id);
    } else if (
      task.status === "approved" ||
      task.status === "partially_approved"
    ) {
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

  // Group tasks by category, deduplicating by task id
  const categories: { [key: string]: TaskItem[] } = {
    생활: [],
    가사: [],
    태도: [],
    건강: [],
    특별: [],
  };

  const seenTaskIds = new Set<string>();
  tasksForSelectedDay.forEach((task) => {
    if (seenTaskIds.has(task.id)) return; // Skip duplicates
    seenTaskIds.add(task.id);

    if (categories[task.category]) {
      categories[task.category].push(task);
    } else {
      categories["특별"].push(task);
    }
  });

  const handleAddSpecial = () => {
    if (effectiveIsReadOnly) {
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
    (t) =>
      t.status === "approved" ||
      t.status === "partially_approved" ||
      t.status === "pending",
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
                {selectedChildId
                  ? "자녀 모드"
                  : isReadOnly
                    ? "이번 주 정산이 완료되었어요! 🎉"
                    : "오늘도 성실하게! 🌱"}
              </ThemedText>
              <ThemedText type="subtitle" style={styles.profileName}>
                {selectedChildId
                  ? `${children.find((c) => c.id === selectedChildId)?.display_name || "자녀"}의 습관기록`
                  : isReadOnly
                    ? "최종결과 확인 🔒"
                    : "지우의 습관기록"}
              </ThemedText>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
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
              <LogOut size={16} color="#FFFFFF" strokeWidth={2} />
              <ThemedText style={styles.logoutBtnText}>로그아웃</ThemedText>
            </Pressable>
          </View>
          {effectiveIsReadOnly && displayWeek && (
            <ThemedView type="backgroundElement" style={styles.readOnlyBanner}>
              <ThemedText style={styles.readOnlyBannerTitle}>
                주간 정산 완료 — 열람 전용
              </ThemedText>
              <ThemedText
                themeColor="textSecondary"
                style={styles.readOnlyBannerText}
              >
                {displayWeek.startDate} ~ {displayWeek.endDate} 최종 결과입니다.
                새로운 주가 시작되면 다시 기록할 수 있어요.
              </ThemedText>
            </ThemedView>
          )}

          {/* 오늘의 속담 패널 - 1분마다 자동 변경 */}
          <ThemedView type="backgroundElement" style={styles.proverbCard}>
            <View style={styles.proverbIconRow}>
              <Lightbulb size={18} color="#F59E0B" strokeWidth={2} />
              <ThemedText
                themeColor="textSecondary"
                style={styles.proverbLabel}
              >
                오늘의 격언
              </ThemedText>
            </View>
            <Animated.View style={{ opacity: fadeAnim }}>
              <ThemedText style={styles.proverbText}>
                {PROVERBS[proverbIdx].en}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.proverbKo}>
                {PROVERBS[proverbIdx].ko}
              </ThemedText>
            </Animated.View>
          </ThemedView>

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
            {days.map((d, idx) => {
              const isActive = activeDay === d;
              const isSimToday = simulatedDay === d;
              // Calculate the actual date for this day based on week's startDate (Monday)
              const dayDate = displayWeek?.startDate
                ? (() => {
                    const date = new Date(displayWeek.startDate);
                    date.setDate(date.getDate() + idx);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  })()
                : "";
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
                  <ThemedText
                    style={[
                      styles.dayDateText,
                      {
                        color: isActive
                          ? "rgba(255,255,255,0.7)"
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {dayDate}
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
                    const icon = TASK_ICONS[task.id];
                    const pointsText = `+${task.points}점`;

                    return (
                      <Pressable
                        key={task.id}
                        onPress={() => handleToggleTask(task)}
                        disabled={effectiveIsReadOnly}
                        style={({ pressed }) => [
                          styles.taskRow,
                          {
                            borderBottomColor: theme.backgroundSelected,
                            borderBottomWidth: idx === list.length - 1 ? 0 : 1,
                            opacity: effectiveIsReadOnly
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
                            {icon || (
                              <ThemedText style={styles.taskIconText}>
                                ✨
                              </ThemedText>
                            )}
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
                            {/* Show scoring criteria based on current status */}
                            {SCORE_CRITERIA[task.id] && (
                              <ThemedText
                                themeColor="textSecondary"
                                style={styles.criteriaText}
                              >
                                {task.status === "approved" &&
                                  `✅ ${SCORE_CRITERIA[task.id].full}`}
                                {task.status === "partially_approved" &&
                                  `🟡 ${SCORE_CRITERIA[task.id].partial}`}
                                {task.status === "rejected" &&
                                  `❌ ${SCORE_CRITERIA[task.id].rejected}`}
                                {task.status === "pending" &&
                                  `📋 ${SCORE_CRITERIA[task.id].full}`}
                                {task.status === "unchecked" &&
                                  `📋 ${SCORE_CRITERIA[task.id].full}`}
                              </ThemedText>
                            )}
                          </View>
                        </View>

                        <View style={styles.taskRight}>
                          {task.status === "unchecked" && (
                            <View
                              style={[
                                styles.statusBtn,
                                {
                                  backgroundColor: effectiveIsReadOnly
                                    ? theme.backgroundSelected
                                    : "#6366F1",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBtnText,
                                  {
                                    color: effectiveIsReadOnly
                                      ? theme.textSecondary
                                      : "#FFFFFF",
                                  },
                                ]}
                              >
                                {effectiveIsReadOnly ? "미완료" : "완료하기"}
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
                                ✅ {task.approvedPoints ?? task.points}점 인정
                              </ThemedText>
                            </View>
                          )}
                          {task.status === "partially_approved" && (
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
                                🟡 {task.approvedPoints ?? 2}점 인정
                              </ThemedText>
                            </View>
                          )}
                          {task.status === "rejected" &&
                            !effectiveIsReadOnly && (
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
                          {task.status === "rejected" &&
                            effectiveIsReadOnly && (
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
                          {/* {task.status === "partially_approved" &&
                            isReadOnly && (
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
                                  🟡 {task.approvedPoints ?? 2}점 인정
                                </ThemedText>
                              </View>
                            )} */}
                          {!effectiveIsReadOnly &&
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
          {!effectiveIsReadOnly && (
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
                  스스로 세운 목표(운동, 독서 등)를 제안하면 승인 시 최대 5점을
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: Spacing.three,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.two,
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
    maxHeight: "80%",
    maxWidth: 500,
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
  proverbCard: {
    borderRadius: 20,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
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
  proverbIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.two,
  },
  proverbLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  proverbText: {
    fontSize: 14,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  proverbKo: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 4,
  },
  nextDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: Spacing.two,
  },
  nextProverbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextArrow: {
    fontSize: 12,
  },
  nextProverbContent: {
    flex: 1,
    gap: 2,
  },
  nextText: {
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "italic",
  },
  nextKo: {
    fontSize: 11,
    fontWeight: "500",
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
  dayDateText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
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
    flexShrink: 1,
  },
  taskRow: {
    flexDirection: "column",
    paddingVertical: Spacing.three,
  },
  taskLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.two,
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
    flex: 1,
    flexWrap: "wrap",
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
    flexShrink: 1,
  },
  criteriaText: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
    marginTop: 2,
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
    justifyContent: "flex-end",
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
  emptyStateCard: {
    borderRadius: 20,
    padding: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.four,
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
    marginBottom: Spacing.two,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    color: "#6366F1",
  },
});
