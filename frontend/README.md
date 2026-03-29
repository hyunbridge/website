# Frontend

Astro 기반 공개 사이트입니다. 홈, 블로그, 프로젝트, CV, 연락처 페이지를 제공하며 정적 빌드와 클라이언트 런타임 모두 `backend/`의 published API를 사용합니다.

## 주요 역할

- 공개 홈, 블로그, 프로젝트, CV, 연락처 페이지 제공
- backend API를 통해 published 콘텐츠 렌더링
- 빌드 시점에 배포 대상 스냅샷을 한 번 고정해 정적 페이지 생성
- 보호된 이메일 노출, 댓글, CV 다운로드 같은 공개 인터랙션 UI 제공

## 프로젝트 구조

```text
src/pages/         공개 라우트
src/layouts/       페이지 레이아웃
src/components/    공개 사이트 UI 컴포넌트
src/features/      화면 단위 기능 묶음
src/lib/           API 연동, build export, Notion/CV 유틸리티
src/styles/        전역 스타일
public/            정적 애셋
../shared/         frontend/cms 공용 UI와 유틸리티
```

## 빠른 시작

```bash
# 1. 환경 변수 준비
cp .env.example .env

# 2. backend API 실행 확인
# 기본값: http://localhost:8080/api/v1

# 3. 개발 서버 실행
pnpm dev
```

- 기본 주소는 `http://localhost:4321`입니다.
- 개발과 빌드 모두 backend API가 응답 가능한 상태를 전제로 합니다.

## 환경 변수

| 변수 | 설명 |
|---|---|
| `PUBLIC_API_BASE_URL` | 공개 사이트가 사용할 backend API base URL |
| `PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Turnstile 사이트 키 |
| `PUBLIC_SITE_URL` | canonical site URL |
| `PUBLIC_GISCUS_REPO` | Giscus 저장소 (`owner/repo`) |
| `PUBLIC_GISCUS_REPO_ID` | Giscus 저장소 ID |
| `PUBLIC_GISCUS_CATEGORY` | 댓글 카테고리 이름 |
| `PUBLIC_GISCUS_CATEGORY_ID` | 댓글 카테고리 ID |

### 예시

```env
PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_GISCUS_REPO=
PUBLIC_GISCUS_REPO_ID=
PUBLIC_GISCUS_CATEGORY=Announcements
PUBLIC_GISCUS_CATEGORY_ID=
```

## 실행 명령

```bash
pnpm dev
pnpm build
pnpm preview
pnpm check
```

## 빌드 방식

- `pnpm build`는 `GET /api/v1/site/export`를 한 번 호출합니다.
- 이 응답에는 현재 배포 기준인 `live_commit_sha`와 published snapshot이 포함됩니다.
- 빌드는 그 시점의 스냅샷 하나만 기준으로 전체 정적 페이지를 생성합니다.
- 따라서 빌드 도중 CMS에서 새 저장이 발생해도, 이미 시작된 빌드는 같은 스냅샷 기준으로 끝납니다.

## 참고 사항

- 이 앱은 same-origin API fallback을 사용하지 않습니다.
- 개발 기본값만 `http://localhost:8080/api/v1`를 허용하고, 배포 환경에서는 별도 API origin을 명시해야 합니다.
- 저장소의 Markdown 파일이나 Git object DB를 직접 읽지 않습니다. 공개 콘텐츠는 모두 backend API를 통해 가져옵니다.
