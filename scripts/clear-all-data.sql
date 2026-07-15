-- Supabase 대시보드에서 실행할 전체 데이터 삭제 SQL
-- 
-- 실행 방법:
-- 1. https://supabase.com/dashboard/project/oanttaxtqsxaszbdqxbq/editor
-- 2. 왼쪽 메뉴에서 "SQL Editor" 클릭
-- 3. "New query" 클릭
-- 4. 아래 SQL을 붙여넣고 "Run" 클릭

-- 모든 weeks 데이터 삭제
DELETE FROM public.weeks;

-- 모든 archive 데이터 삭제  
DELETE FROM public.archive;

-- (선택사항) 모든 profiles 데이터 삭제
-- DELETE FROM public.profiles;

-- 삭제 확인
SELECT 'weeks 테이블 레코드 수:' as info, COUNT(*) as count FROM public.weeks
UNION ALL
SELECT 'archive 테이블 레코드 수:', COUNT(*) FROM public.archive
UNION ALL
SELECT 'profiles 테이블 레코드 수:', COUNT(*) FROM public.profiles;