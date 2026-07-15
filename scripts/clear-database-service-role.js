// Supabase 데이터베이스 데이터 삭제 스크립트 (Service Role 사용)
// 실행: node scripts/clear-database-service-role.js
//
// 주의: Service Role 키는 .env 파일에 추가하세요
// EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

const { createClient } = require("@supabase/supabase-js");

// .env 파일에서 설정 읽기
require("dotenv").config();

// Supabase 설정
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ 오류: .env 파일에 다음 설정이 필요합니다:");
  console.error("  EXPO_PUBLIC_SUPABASE_URL");
  console.error("  EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  console.error(
    "\nService Role 키는 Supabase 대시보드 > Settings > API에서 확인할 수 있습니다.",
  );
  process.exit(1);
}

// Service Role 클라이언트 생성 (RLS를 우회함)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function clearDatabase() {
  try {
    console.log("🗑️  데이터베이스 데이터 삭제를 시작합니다...\n");

    // 1. 현재 데이터 확인
    console.log("📊 현재 데이터 확인 중...");
    const { data: weeksData, count: weeksCount } = await supabase
      .from("weeks")
      .select("*", { count: "exact" });

    const { data: archiveData, count: archiveCount } = await supabase
      .from("archive")
      .select("*", { count: "exact" });

    const { data: profilesData, count: profilesCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact" });

    console.log(`   weeks 테이블: ${weeksCount || 0}개 레코드`);
    console.log(`   archive 테이블: ${archiveCount || 0}개 레코드`);
    console.log(`   profiles 테이블: ${profilesCount || 0}개 레코드\n`);

    if ((weeksCount || 0) === 0 && (archiveCount || 0) === 0) {
      console.log("✅ 이미 데이터베이스가 비어있습니다.");
      return;
    }

    // 2. weeks 테이블 데이터 삭제
    console.log("1️⃣  weeks 테이블 데이터 삭제 중...");
    const { error: deleteWeeksError, count: deletedWeeks } = await supabase
      .from("weeks")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteWeeksError) {
      console.error("   ❌ weeks 삭제 오류:", deleteWeeksError);
    } else {
      console.log(`   ✓ ${deletedWeeks || 0}개 레코드 삭제 완료\n`);
    }

    // 3. archive 테이블 데이터 삭제
    console.log("2️⃣  archive 테이블 데이터 삭제 중...");
    const { error: deleteArchiveError, count: deletedArchive } = await supabase
      .from("archive")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteArchiveError) {
      console.error("   ❌ archive 삭제 오류:", deleteArchiveError);
    } else {
      console.log(`   ✓ ${deletedArchive || 0}개 레코드 삭제 완료\n`);
    }

    // 4. profiles 테이블 데이터 삭제 (선택사항)
    console.log("3️⃣  profiles 테이블 데이터 삭제 중...");
    const { error: deleteProfilesError, count: deletedProfiles } =
      await supabase
        .from("profiles")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteProfilesError) {
      console.error("   ❌ profiles 삭제 오류:", deleteProfilesError);
    } else {
      console.log(`   ✓ ${deletedProfiles || 0}개 레코드 삭제 완료\n`);
    }

    // 5. 삭제 후 확인
    console.log("4️⃣  삭제 후 데이터 확인...");
    const { count: weeksAfter } = await supabase
      .from("weeks")
      .select("*", { count: "exact" });

    const { count: archiveAfter } = await supabase
      .from("archive")
      .select("*", { count: "exact" });

    const { count: profilesAfter } = await supabase
      .from("profiles")
      .select("*", { count: "exact" });

    console.log(`   weeks 테이블: ${weeksAfter || 0}개 레코드`);
    console.log(`   archive 테이블: ${archiveAfter || 0}개 레코드`);
    console.log(`   profiles 테이블: ${profilesAfter || 0}개 레코드`);

    console.log("\n✅ 데이터베이스 초기화 완료!");
  } catch (error) {
    console.error("❌ 오류 발생:", error);
  }
}

clearDatabase();
