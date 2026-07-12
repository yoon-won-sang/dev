# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 계정 생성
2. 새 프로젝트 생성
3. 프로젝트 설정에서 URL과 anon key 복사

## 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일에 실제 값 입력
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
```

## 3. 데이터베이스 스키마 실행

1. Supabase 대시보드 → SQL Editor
2. `supabase/migrations/20260101000000_initial_schema.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기 → 실행

## 4. 인증 설정

1. Supabase 대시보드 → Authentication → Providers
2. Email provider 활성화
3. **중요**: "Confirm email" 비활성화 (가족 앱용)
   - 이 설정을 켜면 회원가입 후 이메일 확인 링크를 클릭해야 로그인 가능
   - 가족 앱에서는 불편하므로 비활성화 권장

## 5. 첫 사용자 생성

### 앱에서 회원가입

1. 앱 실행 → "회원가입" 탭
2. 이메일과 비밀번호 입력
3. 역할 선택 (아이/부모)
4. 회원가입 완료 후 로그인

### 또는 Supabase 대시보드에서 직접 생성

```sql
-- Supabase SQL Editor에서 실행
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, role)
VALUES (
  'parent@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  'authenticated'
);

-- 프로필 생성
INSERT INTO public.profiles (id, role, display_name)
SELECT id, 'parent', '부모'
FROM auth.users
WHERE email = 'parent@example.com';
```

## 6. 데이터 동기화 확인

- 부모와 아이가 각각 로그인
- 아이가 습관 체크 → 부모 화면에서 실시간으로 확인
- 부모가 승인 → 아이 화면에 점수 반영

## 비용

- **무료 티어**: 500MB DB, 50MB 파일 저장, 2GB 대역폭
- **Pro ($25/월)**: 8GB DB, 100GB 대역폭, 무제한 API 요청

가족 2명이 사용하기에는 무료 티어로 충분합니다.
