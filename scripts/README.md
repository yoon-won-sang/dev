# 데이터베이스 초기화 가이드

## 방법 1: Supabase 대시보드에서 직접 실행 (권장)

### 실행 단계:

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard/project/oanttaxtqsxaszbdqxbq/editor

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **SQL 실행**
   - `scripts/clear-all-data.sql` 파일의 내용을 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭 (또는 Ctrl+Enter)

4. **결과 확인**
   - 쿼리 결과에서 모든 테이블이 0개 레코드인지 확인

---

## 방법 2: Node.js 스크립트 사용 (Service Role 키 필요)

### 사전 준비:

1. Supabase 대시보드에서 Service Role 키 확인:
   - Settings > API > Service Role Key
2. `.env` 파일에 Service Role 키 추가:

   ```env
   EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. 스크립트 실행:
   ```bash
   node scripts/clear-database-service-role.js
   ```

---

## 방법 3: 앱 내에서 초기화 (현재 작동하지 않음)

앱의 설정에서 "전체 데이터 초기화" 버튼을 클릭해도 데이터가 삭제되지 않는 문제가 있습니다.

### 원인:

- RLS (Row Level Security) 정책에 DELETE 권한이 없음
- 현재 RLS 정책:
  - Users can view own profile (SELECT only)
  - Users can update own profile (UPDATE only)
  - Users can insert own week data (INSERT only)
  - Users can view own week data (SELECT only)
  - Users can update own week data (UPDATE only)
  - Users can view own archive (SELECT only)
  - Users can insert own archive (INSERT only)
  - **DELETE 권한이 없음!**

### 해결 방법:

아래 마이그레이션 파일을 Supabase 대시보드 SQL Editor에서 실행하여 DELETE 권한을 추가하세요:

```sql
-- weeks 테이블 DELETE 권한 추가
CREATE POLICY "Users can delete own week data" ON public.weeks
  FOR DELETE USING (auth.uid() = user_id);

-- archive 테이블 DELETE 권한 추가
CREATE POLICY "Users can delete own archive" ON public.archive
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 문제 해결

### 데이터가 삭제되지 않는 경우:

1. RLS 정책 확인: Supabase 대시보드 > Authentication > Policies
2. Service Role 키로 직접 삭제 (방법 2)
3. Supabase 대시보드 Table Editor에서 직접 행 삭제

### 삭제 후 앱에서 데이터가 보이는 경우:

1. 앱을 완전히 종료하고 다시 실행
2. 브라우저 캐시 삭제 (웹 버전)
3. 로그아웃 후 다시 로그인
