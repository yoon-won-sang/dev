// Supabase 데이터베이스 데이터 삭제 스크립트
// 실행: node scripts/clear-database.js

const { createClient } = require("@supabase/supabase-js");

// Supabase 설정
const SUPABASE_URL = "https://oanttaxtqsxaszbdqxbq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aMbi-onE5wnYrqKuDzRhZg_g0SXhhdv";

// 익명 클라이언트 생성 (RLS 정책에 따라 제한될 수 있음)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function clearDatabase() {
  try {
    console.log("데이터베이스 데이터 삭제를 시작합니다...\n");

    // 1. weeks 테이블 데이터 삭제
    console.log("1. weeks 테이블 데이터 삭제 중...");
    const { data: weeksData, error: weeksError } = await supabase
      .from("weeks")
      .select("id, user_id, week_id");

    if (weeksError) {
      console.error("weeks 데이터 조회 오류:", weeksError);
    } else {
      console.log(`   발견된 weeks 레코드: ${weeksData?.length || 0}개`);

      if (weeksData && weeksData.length > 0) {
        const { error: deleteWeeksError } = await supabase
          .from("weeks")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // 모든 레코드 삭제

        if (deleteWeeksError) {
          console.error("   weeks 삭제 오류:", deleteWeeksError);
          console.log("   ⚠️  RLS 정책으로 인해 삭제가 거부되었습니다.");
          console.log(
            "   → Supabase 대시보드 SQL Editor에서 직접 실행하세요.\n",
          );
        } else {
          console.log("   ✓ weeks 테이블 데이터 삭제 완료\n");
        }
      }
    }

    // 2. archive 테이블 데이터 삭제
    console.log("2. archive 테이블 데이터 삭제 중...");
    const { data: archiveData, error: archiveError } = await supabase
      .from("archive")
      .select("id, user_id, week_id");

    if (archiveError) {
      console.error("archive 데이터 조회 오류:", archiveError);
    } else {
      console.log(`   발견된 archive 레코드: ${archiveData?.length || 0}개`);

      if (archiveData && archiveData.length > 0) {
        const { error: deleteArchiveError } = await supabase
          .from("archive")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // 모든 레코드 삭제

        if (deleteArchiveError) {
          console.error("   archive 삭제 오류:", deleteArchiveError);
          console.log("   ⚠️  RLS 정책으로 인해 삭제가 거부되었습니다.");
          console.log(
            "   → Supabase 대시보드 SQL Editor에서 직접 실행하세요.\n",
          );
        } else {
          console.log("   ✓ archive 테이블 데이터 삭제 완료\n");
        }
      }
    }

    // 3. 삭제 후 확인
    console.log("3. 삭제 후 데이터 확인...");
    const { data: weeksAfter } = await supabase.from("weeks").select("*");
    const { data: archiveAfter } = await supabase.from("archive").select("*");

    console.log(`   weeks 테이블: ${weeksAfter?.length || 0}개 레코드`);
    console.log(`   archive 테이블: ${archiveAfter?.length || 0}개 레코드`);

    console.log("\n✓ 데이터베이스 초기화 완료!");
  } catch (error) {
    console.error("오류 발생:", error);
  }
}

clearDatabase();
