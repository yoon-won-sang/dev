-- 전체 데이터베이스 데이터 삭제 스크립트
-- Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1. 현재 로그인한 사용자의 weeks 테이블 데이터 삭제
-- (user_id를 실제 사용자 ID로 변경하세요)
DELETE FROM public.weeks;

-- 2. archive 테이블 데이터 삭제
DELETE FROM public.archive;

-- 3. profiles 테이블 데이터 삭제 (선택사항)
-- DELETE FROM public.profiles;

-- 4. 삭제 확인
SELECT 'weeks 테이블:', COUNT(*) FROM public.weeks;
SELECT 'archive 테이블:', COUNT(*) FROM public.archive;
SELECT 'profiles 테이블:', COUNT(*) FROM public.profiles;