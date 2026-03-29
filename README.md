# Hyungyo Seo — Personal Website

Astro 공개 사이트, React/Vite 기반 CMS, Go/Echo 백엔드를 한 저장소에서 운영하는 개인 포트폴리오 웹사이트입니다. 공개 블로그·프로젝트 페이지, 관리자 대시보드, Git 기반 버전 이력, Notion 기반 CV 렌더링, PDF 생성 파이프라인을 통합해 제공합니다.

## 주요 기능

- 대시보드형 랜딩 페이지
- Git 기반 블로그·프로젝트·홈 콘텐츠 저장 및 버전 이력 관리
- MongoDB 기반 임시 작업본, 사용자, 운영 상태 관리
- Notion 페이지를 읽어 CV 웹 페이지로 렌더링
- Gotenberg로 CV PDF를 생성하고 S3 호환 스토리지에 캐시
- 게시글·프로젝트·홈·프로필을 관리하는 관리자 대시보드
- 저장 후 배포 포인터를 갱신하고 Cloudflare Pages 배포를 트리거하는 운영 흐름
- Cloudflare Turnstile 검증을 거친 보호된 이메일 노출
- Giscus 기반 블로그 댓글

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Astro 6, React 19, TypeScript, Tailwind CSS v4 |
| CMS UI | Vite, React Router, Tiptap, Radix UI, Framer Motion |
| 백엔드·서비스 | Go, Echo, MongoDB, Git object DB, Notion API, Gotenberg, S3 호환 스토리지, Cloudflare Turnstile, Giscus |
| 운영 | pnpm Workspace, go test, Cloudflare Pages Deploy Hook, Prettier |

## 프로젝트 구조

```text
backend/
  cmd/              API 서버, 초기 관리자 설치, export 유틸리티
  internal/         인증, 콘텐츠 저장, Git/Mongo 연동, 배포 로직
  api/              OpenAPI 문서와 코드 생성 설정
frontend/
  src/pages/        공개 홈, 블로그, 프로젝트, CV, 연락처 페이지
  src/components/   공개 사이트 UI 컴포넌트
  src/lib/          backend API 연동, 빌드 export 로직
cms/
  src/features/     관리자 화면 단위 기능
  src/components/   에디터, 버전 이력, 배포 UI
  src/lib/          관리자 API 클라이언트
shared/
  src/components/   frontend/cms 공용 UI 프리미티브
  src/lib/          공용 유틸리티
```

## 빠른 시작

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수 설정
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp cms/.env.example cms/.env
# 각 파일을 열어 아래 환경 변수 항목을 채웁니다

# 3. MongoDB 실행
# 로컬 mongodb://localhost:27017 기준

# 4. 첫 관리자 계정 생성
cd backend
printf '%s\n' 'strong-password' | go run ./cmd/install -admin-email admin@example.com -admin-password-stdin
cd ..

# 5. 개발 서버 실행
pnpm dev:backend
pnpm dev:frontend
pnpm dev:cms
```

- 공개 사이트: `http://localhost:4321`
- CMS: Vite 기본 포트 사용
- Backend API: `http://localhost:8080`

## 환경 변수

### Backend 런타임 / 인증

| 변수 | 설명 |
|---|---|
| `APP_ENV` | 실행 환경 (`development`, `production`) |
| `HTTP_ADDR` | API 서버 바인딩 주소 |
| `LOG_LEVEL` | 로그 레벨 |
| `JWT_SECRET` | 관리자 인증 JWT 시크릿 |
| `JWT_ISSUER` | 관리자 인증 JWT issuer |
| `JWT_AUDIENCE` | 관리자 인증 JWT audience |
| `ACCESS_TOKEN_TTL` | 관리자 액세스 토큰 만료 시간 |
| `ADMIN_BRIDGE_SECRET` | 관리자 전용 브리지 요청 보호용 시크릿 |
| `CORS_ALLOWED_ORIGINS` | 허용할 프론트엔드 origin 목록 |

### MongoDB / Editorial Git

| 변수 | 설명 |
|---|---|
| `MONGO_URL` | MongoDB 연결 문자열 |
| `MONGO_DATABASE_NAME` | 사용할 데이터베이스 이름 |
| `CONTENT_REPO_DIR` | 로컬 bare Git 미러 경로 |
| `CONTENT_REPO_SOURCE_URL` | 원격 editorial Git 저장소 URL |
| `CONTENT_REPO_SOURCE_USERNAME` | HTTPS Git 인증 사용자명 |
| `CONTENT_REPO_SOURCE_PASSWORD` | HTTPS Git 인증 비밀번호 또는 PAT |
| `EDITORIAL_GIT_BRANCH` | 저장/배포에 사용할 브랜치 |
| `EDITORIAL_GIT_USER_NAME` | 자동 저장 커밋 작성자 이름 |
| `EDITORIAL_GIT_USER_EMAIL` | 자동 저장 커밋 작성자 이메일 |

### 오브젝트 스토리지

| 변수 | 설명 |
|---|---|
| `S3_BUCKET` | 버킷 이름 |
| `S3_REGION` | 스토리지 리전 |
| `S3_ENDPOINT` | S3 호환 엔드포인트 |
| `S3_ACCESS_KEY` | 액세스 키 |
| `S3_SECRET_KEY` | 시크릿 키 |
| `S3_PUBLIC_BASE_URL` | 공개 CDN 또는 버킷 기본 URL |
| `ASSET_GC_SECRET` | 애셋 정리 엔드포인트 보호용 시크릿 |

### Notion / CV / PDF

| 변수 | 설명 |
|---|---|
| `CV_SOURCE_URL` | 외부 CV 원본 URL 또는 리소스 위치 |
| `NOTION_CV_PAGE_ID` | CV로 사용할 Notion 페이지 ID |
| `GOTENBERG_URL` | PDF 렌더링 서비스 URL |
| `GOTENBERG_USERNAME` | Gotenberg Basic Auth 사용자명 (선택) |
| `GOTENBERG_PASSWORD` | Gotenberg Basic Auth 비밀번호 (선택) |
| `PUBLIC_SITE_URL` | 백엔드가 참조하는 공개 사이트 기준 URL |

### Turnstile / 보호된 이메일

| 변수 | 설명 |
|---|---|
| `TURNSTILE_SECRET` | Cloudflare Turnstile 시크릿 키 |
| `PROTECTED_EMAIL` | 검증 후 노출할 이메일 주소 |
| `PROTECTED_EMAIL_TOKEN_SECRET` | 보호된 이메일 토큰 시크릿 |
| `PROTECTED_EMAIL_TOKEN_ISSUER` | 보호된 이메일 토큰 issuer |
| `PROTECTED_EMAIL_TOKEN_AUDIENCE` | 보호된 이메일 토큰 audience |
| `PROTECTED_EMAIL_TOKEN_TTL` | 보호된 이메일 토큰 만료 시간 |

### 배포 / 외부 연동

| 변수 | 설명 |
|---|---|
| `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL` | 배포 시 호출할 Cloudflare Pages Deploy Hook URL |
| `CLOUDFLARE_WEBHOOK_SECRET` | Cloudflare 배포 웹훅 검증 시크릿 |

### Frontend

| 변수 | 설명 |
|---|---|
| `PUBLIC_API_BASE_URL` | 공개 사이트가 사용할 backend API base URL |
| `PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Turnstile 사이트 키 |
| `PUBLIC_SITE_URL` | 공개 사이트 canonical URL |
| `PUBLIC_GISCUS_REPO` | Giscus GitHub 저장소 (`owner/repo`) |
| `PUBLIC_GISCUS_REPO_ID` | Giscus 저장소 ID |
| `PUBLIC_GISCUS_CATEGORY` | 댓글 카테고리 이름 |
| `PUBLIC_GISCUS_CATEGORY_ID` | 댓글 카테고리 ID |

### CMS

| 변수 | 설명 |
|---|---|
| `VITE_API_BASE_URL` | CMS가 사용할 backend API base URL |
| `VITE_SITE_URL` | 연결된 공개 사이트 URL |
| `VITE_TURNSTILE_SITE_KEY` | CMS 로그인/검증용 Turnstile 사이트 키 |

## 스크립트

```bash
pnpm dev:backend   # Go API 서버 실행
pnpm dev:frontend  # Astro 공개 사이트 실행
pnpm dev:cms       # Vite CMS 실행
pnpm build:backend # Go 빌드
pnpm build:frontend
pnpm build:cms
pnpm test:backend
pnpm check:frontend
pnpm check:cms
pnpm verify        # backend test + frontend/cms 검증
pnpm format
pnpm format:check
```

## 배포

프로덕션은 backend와 frontend가 분리된 구조를 전제로 합니다.

1. `backend`가 MongoDB와 editorial Git 원격 저장소에 연결된 상태로 실행됩니다.
2. CMS에서 저장하면 Git 오브젝트와 브랜치가 갱신되고, 원격 editorial 저장소까지 반영되어야 저장이 완료됩니다.
3. CMS에서 배포를 실행하면 backend가 published 포인터를 갱신합니다.
4. `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL`이 설정돼 있으면 Cloudflare Pages 배포를 트리거합니다.
5. frontend 정적 빌드는 `GET /api/v1/site/export`를 한 번 호출해 배포 대상 `live_commit_sha`에 고정된 published snapshot으로 사이트를 생성합니다.

> 로컬 bare Git 저장소는 캐시 가능한 미러입니다. 원본은 원격 editorial Git 저장소이며, 로컬 저장소는 필요하면 다시 동기화해 재구성할 수 있습니다.

## 콘텐츠 저장 / 배포 흐름

```text
CMS에서 초안 편집
  └─ MongoDB에 작업 중 상태 저장

수동 저장 실행
  └─ backend가 Git object DB에 새 스냅샷 기록
      └─ 원격 editorial Git 저장소 push 성공 시 저장 완료

배포 실행
  └─ published 포인터 갱신
      └─ Cloudflare Pages Deploy Hook 호출
          └─ 성공 시 live_commit_sha 갱신

frontend build
  └─ /api/v1/site/export 호출
      └─ live_commit_sha 기준 published snapshot 1회 로드
          └─ 정적 페이지 생성
```

## CV PDF 생성 흐름

```text
/cv 페이지 접근
  └─ Notion API 또는 configured CV source를 읽어 웹 렌더링

/api/v1/cv/pdf 요청
  └─ Turnstile 토큰 검증
      └─ PDF 렌더링용 페이지를 Gotenberg로 전달
          └─ 생성된 PDF를 S3 호환 스토리지에 업로드
              └─ 공개 객체 URL 반환
```

응답은 PDF 바이너리 스트림이 아니라 스토리지의 공개 URL입니다.

## 데이터 저장 구조

| 저장소 | 설명 |
|---|---|
| Git | 저장된 콘텐츠, 버전 스냅샷, published 상태의 기준 데이터 |
| MongoDB | 저장 전 작업본, 인덱스/프로젝션, 관리자 사용자, 운영 상태, 큐 |
| S3 호환 스토리지 | 업로드 애셋, 생성된 PDF 등 바이너리 파일 |

## 기타 참고 사항

- 공개 사이트는 `frontend/`, 관리자 화면은 `cms/`, 시스템 오너십은 `backend/`에 분리돼 있습니다.
- frontend와 cms는 저장소의 Markdown 파일이나 Git object DB를 직접 읽지 않고 모두 backend API를 통해 동작합니다.
- `CONTENT_REPO_SOURCE_URL`이 비어 있으면 로컬 Git 미러만 사용합니다. 원격 동기화까지 포함한 실제 운영 흐름은 이 값을 설정해야 합니다.
- `APP_ENV=production`에서는 placeholder 시크릿 값이 있으면 backend가 시작 단계에서 실패하도록 되어 있습니다.
- backend, frontend, cms의 세부 실행 방법은 각각 [`backend/README.md`](./backend/README.md), [`frontend/README.md`](./frontend/README.md), [`cms/README.md`](./cms/README.md)를 참고하세요.
