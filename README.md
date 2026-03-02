# Hyungyo Seo — Personal Website

Next.js 16, React 19, TypeScript 기반의 개인 포트폴리오 웹사이트입니다. 공개 블로그·프로젝트 페이지, 관리자 대시보드, Notion 기반 CV 렌더링, PDF 생성 파이프라인을 통합해 제공합니다.

## 주요 기능

- 대시보드형 랜딩 페이지
- Supabase 기반 블로그·프로젝트 콘텐츠 관리 및 버전 이력
- Notion 페이지를 읽어 CV 웹 페이지로 렌더링
- Gotenberg로 CV PDF를 생성하고 S3 호환 스토리지에 캐시
- 게시글·프로젝트·태그·프로필을 관리하는 관리자 대시보드
- Cloudflare Turnstile 검증을 거친 보호된 이메일 노출
- Giscus 기반 블로그 댓글

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| UI | shadcn/ui, Radix UI, Mantine, Framer Motion, BlockNote |
| 백엔드·서비스 | Supabase, Notion API, Gotenberg, S3, Cloudflare Turnstile, Giscus |
| 운영 | Docker, Docker Compose, GitHub Actions, ESLint |

## 프로젝트 구조

```text
app/
  admin/            관리자 대시보드, 로그인, 편집 화면
  api/              blog, projects, cv, s3 관련 Route Handlers
  blog/             공개 블로그 페이지
  projects/         공개 프로젝트 페이지
  cv/               이력서 페이지 및 PDF 다운로드 UI
  contact/          보호된 이메일 / 소셜 링크 페이지
components/         공용 UI 및 도메인 컴포넌트
contexts/           인증 컨텍스트
database/schemas/   Supabase 스키마
hooks/              공용 훅
lib/                서비스 로직, Notion, Supabase, 스토리지, PDF 처리
public/             정적 애셋
types/              공용 타입
```

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local을 열어 아래 환경 변수 항목을 채웁니다

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

## 환경 변수

### Notion

| 변수 | 설명 |
|---|---|
| `NOTION_CV_PAGE_ID` | CV로 사용할 Notion 페이지 ID |

### Supabase

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 클라이언트용 공개 키 |
| `SUPABASE_SECRET_KEY` | 서버 측 서비스 키 |

### Cloudflare Turnstile / 보호된 이메일

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Turnstile 사이트 키 |
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Turnstile 시크릿 키 |
| `JWT_SECRET_KEY` | 보호된 이메일 노출용 JWT 서명 키 |
| `PROTECTED_EMAIL` | 검증 후 노출할 이메일 주소 |

### 오브젝트 스토리지

| 변수 | 설명 |
|---|---|
| `S3_ACCESS_KEY` | 스토리지 액세스 키 |
| `S3_SECRET_KEY` | 스토리지 시크릿 키 |
| `NEXT_PUBLIC_S3_CDN_URL` | 공개 CDN 기본 URL |
| `NEXT_PUBLIC_S3_BUCKET` | 버킷 이름 |
| `NEXT_PUBLIC_S3_REGION` | 리전 |
| `NEXT_PUBLIC_S3_ENDPOINT` | 엔드포인트 |
| `ASSET_GC_SECRET` | 애셋 GC 엔드포인트 보호용 시크릿 |

> 서버 코드에서는 `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_CDN_URL` 런타임 오버라이드도 읽습니다. 기본 설정은 `.env.example`의 `NEXT_PUBLIC_*` 값을 따릅니다.

### URL 설정

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | 프로덕션 사이트 URL |
| `NEXT_PUBLIC_BASE_URL` | 앱 기본 URL |
| `PDF_RENDER_BASE_URL` | PDF 렌더링 시 사용할 CV 기준 URL |

### Gotenberg

| 변수 | 설명 |
|---|---|
| `GOTENBERG_URL` | PDF 변환 서비스 URL |
| `GOTENBERG_USERNAME` | Basic Auth 사용자명 (선택) |
| `GOTENBERG_PASSWORD` | Basic Auth 비밀번호 (선택) |

### Giscus

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_GISCUS_REPO` | GitHub 저장소 (`owner/repo`) |
| `NEXT_PUBLIC_GISCUS_REPO_ID` | 저장소 ID |
| `NEXT_PUBLIC_GISCUS_CATEGORY` | 댓글 카테고리 이름 |
| `NEXT_PUBLIC_GISCUS_CATEGORY_ID` | 댓글 카테고리 ID |

## 스크립트

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm start        # 빌드 결과물 실행
npm run lint     # ESLint 검사
```

## 배포

프로덕션 배포는 [`compose.production.yml`](./compose.production.yml)을 기준으로 동작합니다. 스택은 `website`와 `gotenberg` 두 서비스로 구성됩니다.

### 자동 배포 (GitHub Actions)

`main` 브랜치에 푸시하면 워크플로가 자동으로 실행됩니다.

1. 멀티아키텍처 Docker 이미지를 빌드하고 레지스트리에 푸시
2. Compose 파일을 VM에 복사하고 `.env.compose`, `.env.runtime` 생성
3. `docker compose pull` → `docker compose up -d --remove-orphans` 실행

> 내부 네트워크에서 앱은 `http://gotenberg:3000`으로 PDF 생성을 요청하고, Gotenberg는 `http://website:3000/cv?print=true`를 렌더링합니다.

### 수동 배포

두 개의 .env 파일을 준비합니다.

```env
# .env.compose
DOCKER_IMAGE=<registry-user>/website:latest
```

`.env.runtime`에는 앱 실행에 필요한 런타임 환경 변수를 입력합니다. 이후 아래 명령을 실행합니다.

```bash
docker compose \
  --project-name website \
  --env-file .env.compose \
  -f compose.production.yml pull

docker compose \
  --project-name website \
  --env-file .env.compose \
  -f compose.production.yml up -d --remove-orphans
```

> **참고:** `Dockerfile`은 `NEXT_PUBLIC_*` 변수들과 `NOTION_CV_PAGE_ID`를 빌드 타임 인자로 사용합니다. 로컬 또는 수동 빌드 시에도 이 값들이 누락되지 않도록 주의하세요.

## CV PDF 생성 흐름

```
/cv 페이지 접근
  └─ Notion API로 페이지 읽기 → 웹 렌더링

/api/cv/pdf 요청
  └─ Turnstile 토큰 검증
      └─ CV 마지막 수정 시각 기준으로 버전 키 계산 (generated/cv/...)
          ├─ 캐시 히트 → 기존 공개 URL 반환
          └─ 캐시 미스 → Gotenberg로 /cv?print=true 렌더링 → S3 업로드 → URL 반환
```

응답은 PDF 바이너리가 아닌 스토리지의 **공개 객체 URL**입니다.

### S3 수명 주기 규칙 권장 설정

CV PDF는 애플리케이션이 직접 삭제하지 않으므로, `generated/cv/` 프리픽스에 아래 수명 주기 규칙을 설정하는 것을 권장합니다.

- **Rule name:** `cv-pdf-expire-7d`
- **Prefix:** `generated/cv/`
- **Action:** 업로드 후 7일이 지난 객체 삭제

## 데이터베이스 구조

전체 스키마는 [`database/schemas/schema.sql`](./database/schemas/schema.sql)을 참고하세요.

| 테이블 | 설명 |
|---|---|
| `profiles` | 사용자 프로필 |
| `content_items` | 공통 콘텐츠 메타데이터 (`post`, `project`, `page`) |
| `content_versions` | 콘텐츠 버전 스냅샷 |
| `content_tags` / `content_item_tags` | 태그 및 연결 관계 |
| `assets` | 업로드된 애셋 |
| `content_version_assets` | 특정 버전에 연결된 애셋 |
| `asset_deletion_queue` | 오브젝트 스토리지 삭제 작업 큐 |
| `post_contents` / `project_contents` / `page_contents` | 콘텐츠 타입별 확장 테이블 |

## 기타 참고 사항

- **Contact 페이지**는 문의 폼이 아닌, 보호된 이메일과 소셜 링크 제공 페이지입니다.
- **댓글**은 Giscus를 통해 GitHub Discussions와 연동됩니다.
- **관리자 영역** 접근은 Supabase 인증 세션을 기준으로 합니다.
