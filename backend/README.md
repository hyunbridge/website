# Backend

Go/Echo 기반 API 서버입니다. 인증, 콘텐츠 저장, 버전 이력, 배포, 애셋 처리, 운영 상태 관리를 담당하며 `frontend/`와 `cms/`는 이 API를 통해 동작합니다.

## 주요 역할

- 관리자 로그인, 세션 확인, 프로필 관리
- 홈·블로그·프로젝트 콘텐츠 저장과 버전 스냅샷 기록
- Git 기반 published 상태 관리와 배포 포인터 갱신
- 애셋 업로드 완료 처리와 삭제 요청 관리
- Notion 기반 CV 데이터 제공과 PDF 생성 요청 처리
- Turnstile 검증, 보호된 이메일 노출, 운영 상태 조회

## 저장 모델

- 저장된 콘텐츠와 배포 상태의 기준 데이터는 Git에 둡니다.
- 저장 전 작업본, 사용자, 인덱스, 운영 큐는 MongoDB에 둡니다.
- CMS에서 수동 저장을 실행할 때만 Git 스냅샷과 커밋이 추가됩니다.
- 로컬 Git 저장소는 bare 미러이며, 원격 editorial 저장소에서 다시 동기화해 재구성할 수 있습니다.

## 주요 엔드포인트

### 공개 API

- `GET /healthz`
- `GET /api/v1/system/info`
- `GET /api/v1/site/home`
- `GET /api/v1/site/export`
- `GET /api/v1/posts`
- `GET /api/v1/posts/:slug`
- `GET /api/v1/posts/versions/:versionId`
- `GET /api/v1/tags`
- `GET /api/v1/projects`
- `GET /api/v1/projects/:slug`
- `GET /api/v1/projects/versions/:versionId`
- `GET /api/v1/cv/content`
- `GET /api/v1/cv/pdf`
- `POST /api/v1/contact/verify-turnstile`
- `GET /api/v1/contact/email-status`

### 관리자 API

- `POST /api/v1/admin/login`
- `GET /api/v1/admin/me`
- `GET /api/v1/admin/posts`
- `GET /api/v1/admin/projects`
- `GET /api/v1/admin/tags`
- `GET/PATCH /api/v1/admin/profile`
- `POST /api/v1/admin/profile/password`
- `GET /api/v1/admin/deploy`
- `GET /api/v1/admin/deploy/preview`
- `POST /api/v1/admin/deploy/sync`
- `POST /api/v1/assets/presign`
- `POST /api/v1/assets/complete`
- `POST /api/v1/assets/delete`

## 프로젝트 구조

```text
cmd/
  api/              API 서버 엔트리포인트
  install/          첫 관리자 계정 생성
  publish-export/   배포 스냅샷 export 유틸리티
internal/
  auth/             인증과 토큰 처리
  config/           환경 변수 로딩
  editorial/        Git 기반 편집 이력 처리
  gitrepo/          Git object DB 접근
  http/             라우터와 핸들러
  operational/      배포 상태와 운영 큐
  publiccontent/    공개 사이트용 읽기 모델
  publish/          배포 트리거와 live 포인터 갱신
  store/            Mongo/Git 저장소 구현
api/                OpenAPI 명세와 코드 생성 설정
```

## 빠른 시작

```bash
# 1. 환경 변수 준비
cp .env.example .env

# 2. MongoDB 실행
# 기본값: mongodb://localhost:27017

# 3. 첫 관리자 계정 생성
printf '%s\n' 'strong-password' | go run ./cmd/install -admin-email admin@example.com -admin-password-stdin

# 4. API 서버 실행
go run ./cmd/api
```

- 기본 주소는 `http://localhost:8080`입니다.
- `backend/.env`가 있으면 자동으로 읽습니다.
- 셸에 이미 설정된 값이 있으면 그 값이 우선합니다.

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
| `EDITORIAL_GIT_USER_NAME` | 자동 커밋 작성자 이름 |
| `EDITORIAL_GIT_USER_EMAIL` | 자동 커밋 작성자 이메일 |

### 오브젝트 스토리지

| 변수 | 설명 |
|---|---|
| `S3_BUCKET` | 버킷 이름 |
| `S3_REGION` | 리전 |
| `S3_ENDPOINT` | S3 호환 엔드포인트 |
| `S3_ACCESS_KEY` | 액세스 키 |
| `S3_SECRET_KEY` | 시크릿 키 |
| `S3_PUBLIC_BASE_URL` | 공개 파일 기본 URL |
| `ASSET_GC_SECRET` | 애셋 정리용 시크릿 |

### 외부 연동

| 변수 | 설명 |
|---|---|
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
go run ./cmd/install -admin-email admin@example.com -admin-password-stdin
go run ./cmd/api
go test ./...
go build ./...
oapi-codegen -config api/oapi-codegen.yaml api/openapi.yaml
```

## 저장 / 배포 흐름

```text
CMS에서 초안 편집
  └─ MongoDB에 작업 중 상태 저장

수동 저장 실행
  └─ Git object DB에 새 스냅샷 기록
      └─ 원격 editorial 저장소 push 성공 시 저장 완료

배포 실행
  └─ published 포인터와 live 참조 갱신
      └─ 필요 시 Cloudflare Pages Deploy Hook 호출
          └─ 배포 성공 후 live_commit_sha 기록
```

## 참고 사항

- `APP_ENV`가 `production`일 때 placeholder 시크릿 값이 남아 있으면 서버가 시작 단계에서 실패합니다.
- `TURNSTILE_SECRET`이 비어 있고 `APP_ENV`가 `production`이 아니면 로컬 개발에서는 CAPTCHA 검증을 우회합니다.
- `CONTENT_REPO_SOURCE_URL`이 설정되면 서버 시작과 읽기/쓰기 시점에 로컬 미러를 원격 브랜치와 동기화합니다.
- 공개 사이트는 저장소 파일을 직접 읽지 않고 항상 이 API를 통해 published snapshot을 가져옵니다.
