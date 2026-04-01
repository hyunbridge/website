# Backend

Rust/Axum 기반 API 서버입니다. 인증, 콘텐츠 저장, 버전 이력, 배포, 애셋 처리, 운영 상태 관리를 담당하며 `frontend/`와 `cms/`는 이 API를 통해 동작합니다.

## 주요 역할

- 관리자 로그인, 세션 확인, 프로필 관리
- 홈·블로그·프로젝트 콘텐츠 저장과 버전 스냅샷 기록
- Git 기반 published 상태 관리와 배포 포인터 갱신
- 애셋 업로드 완료 처리와 삭제 요청 관리
- Notion 기반 CV 데이터 제공과 PDF 생성 요청 처리
- Turnstile 검증, 보호된 이메일 노출, 운영 상태 조회

## 프로젝트 구조

```text
src/
  auth.rs           인증과 토큰 처리
  config.rs         환경 변수 로딩
  editorial.rs      Git 기반 편집 이력 처리
  routes/           라우터와 HTTP 핸들러
  state/            Mongo/Git 저장소 구현과 배포 상태 처리
api/                OpenAPI 문서
```

## 빠른 시작

```bash
# 1. 환경 변수 준비
cp .env.example .env

# 2. MongoDB 실행
# 기본값: mongodb://localhost:27017

# 3. 빈 DB라면 초기 관리자 계정 생성
printf '%s\n' 'strong-password' | cargo run -- init-admin --admin-email admin@example.com --admin-password-stdin

# 4. API 서버 실행
cargo run
```

- 기본 주소는 `http://localhost:8080`입니다.
- `backend/.env`가 있으면 자동으로 읽습니다.
- 셸에 이미 설정된 값이 있으면 그 값이 우선합니다.

## 초기화 방식

이 백엔드는 서버 부팅과 분리된 명시적 초기화 명령으로 첫 관리자 계정을 생성합니다.

부팅 순서는 아래와 같습니다.

1. MongoDB 연결 및 `ping`
2. `CONTENT_REPO_DIR` 기준 로컬 editorial Git 저장소 준비
3. 초기화가 끝난 상태라면 editorial Git 상태를 읽어 posts/projects/home published 상태를 MongoDB와 reconcile

중요한 동작은 아래와 같습니다.

- MongoDB 데이터베이스와 컬렉션은 미리 만들 필요가 없습니다. 빈 DB여도 서버가 직접 문서를 생성합니다.
- 하지만 빈 DB에서는 먼저 `init-admin` 명령으로 초기 관리자 프로필을 만들어야 서버가 부팅됩니다.
- `CONTENT_REPO_SOURCE_URL`이 비어 있어도 로컬 Git 저장소는 `CONTENT_REPO_DIR`에 자동 초기화됩니다.

### 초기 관리자 계정 생성

```bash
# 1. MongoDB만 먼저 준비

# 2. 초기 관리자 계정 생성
printf '%s\n' 'replace-with-a-real-password' | cargo run -- init-admin --admin-email admin@example.com --admin-password-stdin

# 3. 서버 기동
cargo run
```

정상 기동 후에는 아래 순서로 마무리하면 됩니다.

1. `/api/v1/admin/login`으로 로그인해 JWT를 발급받습니다.
2. 필요하면 `/api/v1/admin/profile`로 이름, 아바타, Git author 정보를 저장합니다.
3. 필요하면 `/api/v1/admin/profile/password`로 비밀번호를 교체합니다.

## API 개요

현재 라우트 그룹은 아래와 같습니다.

- Public: `/api/v1/system/*`, `/api/v1/site/*`, `/api/v1/posts*`, `/api/v1/projects*`, `/api/v1/tags`, `/api/v1/contact/*`, `/api/v1/cv/*`
- Admin auth: `/api/v1/admin/login`, `/api/v1/admin/me`
- Admin content: `/api/v1/admin/posts*`, `/api/v1/admin/projects*`, `/api/v1/admin/tags*`, `/api/v1/admin/home*`
- Admin deploy: `/api/v1/admin/deploy*`, `/api/v1/admin/publish*`
- Admin assets: `/api/v1/assets/presign`, `/api/v1/assets/complete`, `/api/v1/assets/delete`
- Integration webhook: `/api/v1/integrations/cloudflare/pages/deploy-webhook`

## 환경 변수

### 런타임 / 인증

| 변수 | 설명 |
|---|---|
| `APP_ENV` | 실행 환경 (`development`, `production`) |
| `HTTP_ADDR` | 서버 바인딩 주소 |
| `LOG_LEVEL` | 로그 레벨 |
| `JWT_SECRET` | 관리자 인증 JWT 시크릿 |
| `JWT_ISSUER` | 관리자 인증 JWT issuer |
| `JWT_AUDIENCE` | 관리자 인증 JWT audience |
| `ACCESS_TOKEN_TTL` | 액세스 토큰 만료 시간 |
| `ADMIN_BRIDGE_SECRET` | 내부 관리자 브리지 요청 보호용 시크릿 |
| `CORS_ALLOWED_ORIGINS` | 허용할 프론트엔드 origin 목록 |

### MongoDB / Editorial Git

| 변수 | 설명 |
|---|---|
| `MONGO_URL` | MongoDB 연결 문자열 |
| `MONGO_DATABASE_NAME` | 데이터베이스 이름 |
| `CONTENT_REPO_DIR` | 로컬 bare Git 미러 경로 |
| `CONTENT_REPO_SOURCE_URL` | 원격 editorial Git 저장소 URL |
| `CONTENT_REPO_SOURCE_USERNAME` | HTTPS Git 사용자명 |
| `CONTENT_REPO_SOURCE_PASSWORD` | HTTPS Git 비밀번호 또는 PAT |
| `EDITORIAL_GIT_BRANCH` | 편집 저장에 사용할 브랜치 |

### 오브젝트 스토리지 / 외부 연동

| 변수 | 설명 |
|---|---|
| `S3_BUCKET` | 버킷 이름 |
| `S3_REGION` | 리전 |
| `S3_ENDPOINT` | S3 호환 엔드포인트 |
| `S3_ACCESS_KEY` | 액세스 키 |
| `S3_SECRET_KEY` | 시크릿 키 |
| `S3_PUBLIC_BASE_URL` | 공개 파일 기본 URL |
| `CV_SOURCE_URL` | CV 원본 URL 또는 별도 소스 위치 |
| `NOTION_CV_PAGE_ID` | CV로 사용할 Notion 페이지 ID |
| `GOTENBERG_URL` | PDF 렌더링 서비스 URL |
| `GOTENBERG_USERNAME` | Gotenberg 사용자명 (선택) |
| `GOTENBERG_PASSWORD` | Gotenberg 비밀번호 (선택) |
| `PUBLIC_SITE_URL` | 공개 사이트 기준 URL |
| `TURNSTILE_SECRET` | Cloudflare Turnstile 시크릿 키 |
| `PROTECTED_EMAIL` | 검증 후 노출할 이메일 주소 |
| `PROTECTED_EMAIL_TOKEN_SECRET` | 보호된 이메일 토큰 시크릿 |
| `PROTECTED_EMAIL_TOKEN_ISSUER` | 보호된 이메일 토큰 issuer |
| `PROTECTED_EMAIL_TOKEN_AUDIENCE` | 보호된 이메일 토큰 audience |
| `PROTECTED_EMAIL_TOKEN_TTL` | 보호된 이메일 토큰 만료 시간 |
| `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL` | Cloudflare Pages Deploy Hook URL |
| `CLOUDFLARE_WEBHOOK_SECRET` | Cloudflare 배포 웹훅 검증 시크릿 |

## 실행 명령

```bash
printf '%s\n' 'strong-password' | cargo run -- init-admin --admin-email admin@example.com --admin-password-stdin
cargo run
cargo test --quiet
cargo build --release
cargo fmt --all
```

## 참고 사항

- `APP_ENV`가 `production`일 때 placeholder 시크릿 값이 남아 있으면 서버가 시작 단계에서 실패합니다.
- `TURNSTILE_SECRET`이 비어 있고 `APP_ENV`가 `production`이 아니면 로컬 개발에서는 CAPTCHA 검증을 우회합니다.
- `CONTENT_REPO_SOURCE_URL`이 설정되면 서버 시작과 읽기/쓰기 시점에 로컬 미러를 원격 브랜치와 동기화합니다.
- 빈 DB에서는 먼저 `cargo run -- init-admin --admin-email ... --admin-password-stdin`를 실행해야 부팅이 완료됩니다.
- 공개 사이트는 저장소 파일을 직접 읽지 않고 항상 이 API를 통해 published snapshot을 가져옵니다.
