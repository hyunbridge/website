# CMS

React + Vite 기반 관리자 작업 화면입니다. 홈, 블로그, 프로젝트, 프로필을 편집하고 저장된 버전 이력 확인, 배포 실행, 애셋 업로드를 담당합니다.

## 주요 역할

- 관리자 로그인과 프로필 관리
- 홈, 블로그, 프로젝트 편집
- 저장된 버전 목록 조회와 이전 버전 확인
- 배포 대상 미리보기와 배포 실행
- backend API를 통한 애셋 업로드 및 정리 요청

공개 사이트 라우트는 포함하지 않습니다. 방문자용 화면은 `frontend/`가 담당하고, 이 앱은 관리자 작업만 처리합니다.

## 프로젝트 구조

```text
src/routes/        React Router 진입점
src/features/      화면 단위 기능
src/components/    편집기, 버전 이력, 배포 UI 컴포넌트
src/lib/           관리자 API 클라이언트와 서비스 레이어
src/contexts/      인증, 앱 전역 상태
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

- `VITE_API_BASE_URL`과 `VITE_SITE_URL`은 배포 환경에서 필수입니다.
- 공개 사이트 기본 URL은 로컬 기준 `http://localhost:4321`입니다.

## 환경 변수

| 변수 | 설명 |
|---|---|
| `VITE_API_BASE_URL` | CMS가 사용할 backend API base URL |
| `VITE_SITE_URL` | 연결된 공개 사이트 URL |
| `VITE_TURNSTILE_SITE_KEY` | 로그인/검증에 사용할 Turnstile 사이트 키 |

### 예시

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_SITE_URL=http://localhost:4321
VITE_TURNSTILE_SITE_KEY=
```

## 실행 명령

```bash
pnpm dev
pnpm build
pnpm preview
```

## 편집 / 저장 모델

- 편집 중 상태는 먼저 backend의 MongoDB 작업 영역에 저장됩니다.
- 사용자가 수동 저장을 실행할 때만 Git 기반 저장 스냅샷이 만들어집니다.
- 저장이 끝나면 버전 이력에서 해당 시점의 내용을 다시 열어볼 수 있습니다.
- 배포는 저장과 별도 단계이며, 배포 실행 시 published 포인터와 live 배포 상태가 갱신됩니다.

## 참고 사항

- 이 앱은 same-origin API fallback을 사용하지 않습니다.
- 개발 기본값만 `http://localhost:8080/api/v1`를 허용하고, 배포 환경에서는 별도 API origin을 명시해야 합니다.
- API 호출, 인증, 저장, 배포는 모두 `backend/`를 통해 처리합니다.
