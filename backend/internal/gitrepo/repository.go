package gitrepo

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	git "github.com/go-git/go-git/v5"
	gitconfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/filemode"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/storer"
	transport "github.com/go-git/go-git/v5/plumbing/transport"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
)

const (
	DefaultRemoteName     = "source"
	commitPushMaxAttempts = 3
)

type Config struct {
	Path           string
	RemoteURL      string
	RemoteName     string
	RemoteUsername string
	RemotePassword string
	Branch         string
	UserName       string
	UserEmail      string
}

type Repository struct {
	path           string
	remoteURL      string
	remoteName     string
	remoteUsername string
	remotePassword string
	branch         string
	userName       string
	userEmail      string
	mu             sync.Mutex
}

type Commit struct {
	SHA         string
	CreatedAt   string
	Author      string
	AuthorEmail string
	Summary     string
	Body        string
}

type AuthorIdentity struct {
	Name  string
	Email string
}

type Tag struct {
	RefName         string
	Name            string
	TagObjectSHA    string
	TargetCommitSHA string
	CreatedAt       string
	Subject         string
	Body            string
}

type Reference struct {
	Name            string
	TargetObjectSHA string
	TargetCommitSHA string
}

func New(cfg Config) (*Repository, error) {
	repoPath := strings.TrimSpace(cfg.Path)
	if repoPath == "" {
		return nil, errors.New("content repository path is required")
	}
	if absolutePath, err := filepath.Abs(repoPath); err == nil {
		repoPath = absolutePath
	}

	return &Repository{
		path:           repoPath,
		remoteURL:      strings.TrimSpace(cfg.RemoteURL),
		remoteName:     fallback(cfg.RemoteName, DefaultRemoteName),
		remoteUsername: strings.TrimSpace(cfg.RemoteUsername),
		remotePassword: strings.TrimSpace(cfg.RemotePassword),
		branch:         fallback(cfg.Branch, "main"),
		userName:       fallback(cfg.UserName, "Website Editorial"),
		userEmail:      fallback(cfg.UserEmail, "editorial@example.com"),
	}, nil
}

func (r *Repository) Path() string {
	if r == nil {
		return ""
	}
	return r.path
}

func (r *Repository) Branch() string {
	if r == nil {
		return ""
	}
	return r.branch
}

func (r *Repository) EnsureReady(ctx context.Context) error {
	if r == nil {
		return errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return err
	}
	defer closeRepository(repo)

	return r.syncLocked(ctx, repo)
}

func (r *Repository) Sync(ctx context.Context) error {
	if r == nil {
		return errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return err
	}
	defer closeRepository(repo)

	return r.syncLocked(ctx, repo)
}

func (r *Repository) HeadCommitSHA(ctx context.Context) (string, error) {
	if r == nil {
		return "", errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return "", err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return "", err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return "", err
	}

	commit, err := r.lookupBranchCommitLocked(repo)
	if err != nil {
		return "", err
	}
	if commit == nil {
		return "", nil
	}

	return commit.Hash.String(), nil
}

func (r *Repository) CommitFile(ctx context.Context, relativePath string, payload []byte, subject string, body string) (Commit, error) {
	return r.CommitFileAs(ctx, relativePath, payload, subject, body, nil)
}

func (r *Repository) CommitFileAs(ctx context.Context, relativePath string, payload []byte, subject string, body string, author *AuthorIdentity) (Commit, error) {
	if r == nil {
		return Commit{}, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return Commit{}, err
	}

	normalizedPath, err := normalizeRelativePath(relativePath)
	if err != nil {
		return Commit{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return Commit{}, err
	}
	defer closeRepository(repo)

	var lastErr error
	for attempt := 0; attempt < commitPushMaxAttempts; attempt++ {
		commit, commitErr := r.commitFilesOnceLocked(ctx, repo, map[string][]byte{normalizedPath: payload}, subject, body, author)
		if commitErr == nil {
			return commit, nil
		}
		lastErr = commitErr
		if !isConcurrentUpdateError(commitErr) {
			return Commit{}, commitErr
		}
	}

	if lastErr == nil {
		lastErr = errors.New("commit and push failed")
	}
	return Commit{}, lastErr
}

func (r *Repository) CommitFiles(ctx context.Context, files map[string][]byte, subject string, body string) (Commit, error) {
	return r.CommitFilesAs(ctx, files, subject, body, nil)
}

func (r *Repository) CommitFilesAs(ctx context.Context, files map[string][]byte, subject string, body string, author *AuthorIdentity) (Commit, error) {
	if r == nil {
		return Commit{}, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return Commit{}, err
	}
	if len(files) == 0 {
		return Commit{}, errors.New("at least one file is required")
	}

	normalizedFiles := make(map[string][]byte, len(files))
	for relativePath, payload := range files {
		normalizedPath, err := normalizeRelativePath(relativePath)
		if err != nil {
			return Commit{}, err
		}
		normalizedFiles[normalizedPath] = append([]byte(nil), payload...)
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return Commit{}, err
	}
	defer closeRepository(repo)

	var lastErr error
	for attempt := 0; attempt < commitPushMaxAttempts; attempt++ {
		commit, commitErr := r.commitFilesOnceLocked(ctx, repo, normalizedFiles, subject, body, author)
		if commitErr == nil {
			return commit, nil
		}
		lastErr = commitErr
		if !isConcurrentUpdateError(commitErr) {
			return Commit{}, commitErr
		}
	}

	if lastErr == nil {
		lastErr = errors.New("commit and push failed")
	}
	return Commit{}, lastErr
}

func (r *Repository) FileHistory(ctx context.Context, relativePath string) ([]Commit, error) {
	return r.pathHistory(ctx, relativePath, "", "")
}

func (r *Repository) FileAtCommit(ctx context.Context, relativePath string, commitSHA string) ([]byte, error) {
	if r == nil {
		return nil, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return nil, err
	}

	normalizedPath, err := normalizeRelativePath(relativePath)
	if err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return nil, err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return nil, err
	}

	commit, err := repo.CommitObject(plumbing.NewHash(strings.TrimSpace(commitSHA)))
	if err != nil {
		if errors.Is(err, plumbing.ErrObjectNotFound) {
			return nil, os.ErrNotExist
		}
		return nil, err
	}

	tree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	file, err := tree.File(normalizedPath)
	if err != nil {
		if errors.Is(err, object.ErrFileNotFound) {
			return nil, os.ErrNotExist
		}
		return nil, err
	}

	reader, err := file.Reader()
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	return io.ReadAll(reader)
}

func (r *Repository) GetCommit(ctx context.Context, commitSHA string) (Commit, error) {
	if r == nil {
		return Commit{}, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return Commit{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return Commit{}, err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return Commit{}, err
	}

	commit, err := repo.CommitObject(plumbing.NewHash(strings.TrimSpace(commitSHA)))
	if err != nil {
		return Commit{}, err
	}
	return commitFromObject(commit), nil
}

func (r *Repository) CommitBody(ctx context.Context, commitSHA string) (string, error) {
	commit, err := r.GetCommit(ctx, commitSHA)
	if err != nil {
		return "", err
	}
	return commit.Body, nil
}

func (r *Repository) ListFiles(ctx context.Context, prefix string, suffix string) ([]string, error) {
	return r.ListFilesAtCommit(ctx, "", prefix, suffix)
}

func (r *Repository) ListFilesAtCommit(ctx context.Context, commitSHA string, prefix string, suffix string) ([]string, error) {
	if r == nil {
		return nil, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return nil, err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return nil, err
	}

	commit, err := r.lookupCommitLocked(repo, commitSHA)
	if err != nil {
		return nil, err
	}
	if commit == nil {
		return nil, nil
	}

	tree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	return listTreeFiles(tree, prefix, suffix)
}

func listTreeFiles(tree *object.Tree, prefix string, suffix string) ([]string, error) {
	normalizedPrefix := strings.TrimSpace(strings.ReplaceAll(prefix, "\\", "/"))
	normalizedSuffix := strings.TrimSpace(suffix)

	iter := tree.Files()
	defer iter.Close()

	paths := make([]string, 0)
	err := iter.ForEach(func(file *object.File) error {
		if file == nil {
			return nil
		}
		name := path.Clean(file.Name)
		if normalizedPrefix != "" && !strings.HasPrefix(name, normalizedPrefix) {
			return nil
		}
		if normalizedSuffix != "" && !strings.HasSuffix(name, normalizedSuffix) {
			return nil
		}
		paths = append(paths, name)
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Strings(paths)
	return paths, nil
}

func (r *Repository) lookupCommitLocked(repo *git.Repository, commitSHA string) (*object.Commit, error) {
	normalized := strings.TrimSpace(commitSHA)
	if normalized == "" {
		return r.lookupBranchCommitLocked(repo)
	}

	commit, err := repo.CommitObject(plumbing.NewHash(normalized))
	if err != nil {
		if errors.Is(err, plumbing.ErrObjectNotFound) {
			return nil, os.ErrNotExist
		}
		return nil, err
	}
	return commit, nil
}

func (r *Repository) ListTags(ctx context.Context, prefix string, limit int) ([]Tag, error) {
	if r == nil {
		return nil, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return nil, err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return nil, err
	}

	iter, err := repo.References()
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	refPrefix := strings.TrimSpace(prefix)
	if refPrefix == "" {
		refPrefix = "refs/tags/"
	}

	tags := make([]Tag, 0)
	err = iter.ForEach(func(ref *plumbing.Reference) error {
		if !strings.HasPrefix(ref.Name().String(), refPrefix) {
			return nil
		}

		tag, tagErr := r.tagFromReference(repo, ref)
		if tagErr != nil {
			return tagErr
		}
		tags = append(tags, tag)
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(tags, func(i, j int) bool {
		return tags[i].CreatedAt > tags[j].CreatedAt
	})
	if limit > 0 && len(tags) > limit {
		tags = tags[:limit]
	}
	return tags, nil
}

func (r *Repository) CreateAnnotatedTag(ctx context.Context, name string, targetCommitSHA string, subject string, body string) (string, error) {
	if r == nil {
		return "", errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return "", err
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("tag name is required")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return "", err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return "", err
	}

	ref, err := repo.CreateTag(name, plumbing.NewHash(strings.TrimSpace(targetCommitSHA)), &git.CreateTagOptions{
		Tagger:  ptrSignature(r.signature(time.Now(), nil)),
		Message: composeMessage(subject, body),
	})
	if err != nil {
		return "", err
	}

	if err := r.pushRefsLocked(ctx, repo, []gitconfig.RefSpec{gitconfig.RefSpec(ref.Name().String() + ":" + ref.Name().String())}); err != nil {
		return "", err
	}

	return ref.Hash().String(), nil
}

func (r *Repository) UpdateReference(ctx context.Context, name string, targetSHA string) error {
	if r == nil {
		return errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return err
	}

	refName := plumbing.ReferenceName(strings.TrimSpace(name))
	if refName == "" {
		return errors.New("reference name is required")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return err
	}

	if err := repo.Storer.SetReference(plumbing.NewHashReference(refName, plumbing.NewHash(strings.TrimSpace(targetSHA)))); err != nil {
		return err
	}

	return r.pushRefsLocked(ctx, repo, []gitconfig.RefSpec{gitconfig.RefSpec(refName.String() + ":" + refName.String())})
}

func (r *Repository) DeleteReference(ctx context.Context, name string) error {
	if r == nil {
		return errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return err
	}

	refName := plumbing.ReferenceName(strings.TrimSpace(name))
	if refName == "" {
		return errors.New("reference name is required")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return err
	}

	if _, err := repo.Reference(refName, true); err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return nil
		}
		return err
	}

	if err := repo.Storer.RemoveReference(refName); err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return nil
		}
		return err
	}

	return r.pushRefsLocked(ctx, repo, []gitconfig.RefSpec{gitconfig.RefSpec(":" + refName.String())})
}

func (r *Repository) ResolveReference(ctx context.Context, name string) (string, string, error) {
	if r == nil {
		return "", "", errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return "", "", err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return "", "", err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return "", "", err
	}

	ref, err := repo.Reference(plumbing.ReferenceName(strings.TrimSpace(name)), true)
	if err != nil {
		return "", "", err
	}

	target := ref.Hash()
	commitHash, err := r.peelToCommitHash(repo, target)
	if err != nil {
		return target.String(), "", err
	}
	return target.String(), commitHash.String(), nil
}

func (r *Repository) ListReferences(ctx context.Context, prefix string) ([]Reference, error) {
	if r == nil {
		return nil, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return nil, err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return nil, err
	}

	iter, err := repo.References()
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	refPrefix := strings.TrimSpace(prefix)
	refs := make([]Reference, 0)
	err = iter.ForEach(func(ref *plumbing.Reference) error {
		if ref == nil {
			return nil
		}
		if refPrefix != "" && !strings.HasPrefix(ref.Name().String(), refPrefix) {
			return nil
		}
		resolved, resolveErr := repo.Reference(ref.Name(), true)
		if resolveErr != nil {
			return resolveErr
		}
		commitHash, peelErr := r.peelToCommitHash(repo, resolved.Hash())
		if peelErr != nil {
			return peelErr
		}
		refs = append(refs, Reference{
			Name:            ref.Name().String(),
			TargetObjectSHA: resolved.Hash().String(),
			TargetCommitSHA: commitHash.String(),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(refs, func(i, j int) bool {
		return refs[i].Name < refs[j].Name
	})
	return refs, nil
}

func (r *Repository) FirstReferencePointingTo(ctx context.Context, objectSHA string, prefix string) (string, error) {
	if r == nil {
		return "", errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return "", err
	}

	target := plumbing.NewHash(strings.TrimSpace(objectSHA))
	refPrefix := strings.TrimSpace(prefix)

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return "", err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return "", err
	}

	iter, err := repo.References()
	if err != nil {
		return "", err
	}
	defer iter.Close()

	var match string
	err = iter.ForEach(func(ref *plumbing.Reference) error {
		if refPrefix != "" && !strings.HasPrefix(ref.Name().String(), refPrefix) {
			return nil
		}
		resolved, resolveErr := repo.Reference(ref.Name(), true)
		if resolveErr != nil {
			return resolveErr
		}
		if resolved.Hash() == target {
			match = ref.Name().String()
			return storer.ErrStop
		}
		return nil
	})
	if err != nil && !errors.Is(err, storer.ErrStop) {
		return "", err
	}
	return match, nil
}

func (r *Repository) CommitsForPath(ctx context.Context, filePath string, fromSHA string, toSHA string) ([]Commit, error) {
	return r.pathHistory(ctx, filePath, fromSHA, toSHA)
}

func (r *Repository) DiffPath(ctx context.Context, fromSHA string, toSHA string, filePath string) (string, error) {
	if r == nil {
		return "", errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return "", err
	}

	normalizedPath, err := normalizeRelativePath(filePath)
	if err != nil {
		return "", err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return "", err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return "", err
	}

	return r.diffPathLocked(repo, normalizedPath, strings.TrimSpace(fromSHA), strings.TrimSpace(toSHA))
}

func (r *Repository) CommitDiff(ctx context.Context, commitSHA string, filePath string) (string, error) {
	if r == nil {
		return "", errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return "", err
	}

	normalizedPath, err := normalizeRelativePath(filePath)
	if err != nil {
		return "", err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return "", err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return "", err
	}

	commit, err := repo.CommitObject(plumbing.NewHash(strings.TrimSpace(commitSHA)))
	if err != nil {
		return "", err
	}

	fromSHA := ""
	if commit.NumParents() > 0 {
		fromSHA = commit.ParentHashes[0].String()
	}

	return r.diffPathLocked(repo, normalizedPath, fromSHA, commit.Hash.String())
}

func (r *Repository) openLocked() (*git.Repository, error) {
	repo, err := r.openOrInitBareLocked()
	if err != nil {
		return nil, err
	}

	if err := repo.Storer.SetReference(plumbing.NewSymbolicReference(plumbing.HEAD, r.branchRef())); err != nil {
		return nil, err
	}
	if err := r.ensureRemoteLocked(repo); err != nil {
		return nil, err
	}

	return repo, nil
}

func (r *Repository) openOrInitBareLocked() (*git.Repository, error) {
	if err := os.MkdirAll(r.path, 0o755); err != nil {
		return nil, err
	}

	repo, err := git.PlainOpen(r.path)
	if err == nil {
		return repo, nil
	}
	if errors.Is(err, git.ErrRepositoryNotExists) {
		return r.initBareLocked()
	}
	if r.remoteURL == "" {
		return nil, err
	}

	if removeErr := os.RemoveAll(r.path); removeErr != nil {
		return nil, fmt.Errorf("recreate ephemeral mirror: %w", removeErr)
	}
	return r.initBareLocked()
}

func (r *Repository) initBareLocked() (*git.Repository, error) {
	if err := os.MkdirAll(r.path, 0o755); err != nil {
		return nil, err
	}
	return git.PlainInitWithOptions(r.path, &git.PlainInitOptions{
		Bare: true,
		InitOptions: git.InitOptions{
			DefaultBranch: r.branchRef(),
		},
	})
}

func (r *Repository) ensureRemoteLocked(repo *git.Repository) error {
	if r.remoteURL == "" {
		return nil
	}

	cfg, err := repo.Config()
	if err != nil {
		return err
	}
	if cfg.Remotes == nil {
		cfg.Remotes = make(map[string]*gitconfig.RemoteConfig)
	}

	fetch := []gitconfig.RefSpec{
		gitconfig.RefSpec("+refs/heads/*:refs/remotes/" + r.remoteName + "/*"),
		gitconfig.RefSpec("+refs/tags/*:refs/tags/*"),
		gitconfig.RefSpec("+refs/publish/*:refs/publish/*"),
	}
	cfg.Remotes[r.remoteName] = &gitconfig.RemoteConfig{
		Name:  r.remoteName,
		URLs:  []string{r.remoteURL},
		Fetch: fetch,
	}

	return repo.Storer.SetConfig(cfg)
}

func (r *Repository) syncLocked(ctx context.Context, repo *git.Repository) error {
	if err := contextError(ctx); err != nil {
		return err
	}
	if r.remoteURL == "" {
		return nil
	}

	err := repo.FetchContext(ctx, &git.FetchOptions{
		RemoteName: r.remoteName,
		RefSpecs: []gitconfig.RefSpec{
			gitconfig.RefSpec("+refs/heads/*:refs/remotes/" + r.remoteName + "/*"),
			gitconfig.RefSpec("+refs/tags/*:refs/tags/*"),
			gitconfig.RefSpec("+refs/publish/*:refs/publish/*"),
		},
		Auth:  r.remoteAuth(),
		Tags:  git.NoTags,
		Force: true,
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		if isEmptyRemoteRepositoryError(err) {
			return nil
		}
		return err
	}

	remoteRef, err := repo.Reference(r.remoteBranchRef(), true)
	if err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return nil
		}
		return err
	}

	return repo.Storer.SetReference(plumbing.NewHashReference(r.branchRef(), remoteRef.Hash()))
}

func (r *Repository) pushRefsLocked(ctx context.Context, repo *git.Repository, refspecs []gitconfig.RefSpec) error {
	if r.remoteURL == "" || len(refspecs) == 0 {
		return nil
	}
	if err := contextError(ctx); err != nil {
		return err
	}

	err := repo.PushContext(ctx, &git.PushOptions{
		RemoteName: r.remoteName,
		RefSpecs:   refspecs,
		Auth:       r.remoteAuth(),
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		return err
	}
	return nil
}

func (r *Repository) pathHistory(ctx context.Context, relativePath string, fromSHA string, toSHA string) ([]Commit, error) {
	if r == nil {
		return nil, errors.New("content repository is not configured")
	}
	if err := contextError(ctx); err != nil {
		return nil, err
	}

	normalizedPath, err := normalizeRelativePath(relativePath)
	if err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	repo, err := r.openLocked()
	if err != nil {
		return nil, err
	}
	defer closeRepository(repo)

	if err := r.syncLocked(ctx, repo); err != nil {
		return nil, err
	}

	startHash := strings.TrimSpace(toSHA)
	if startHash == "" {
		head, headErr := r.lookupBranchCommitLocked(repo)
		if headErr != nil {
			return nil, headErr
		}
		if head == nil {
			return nil, nil
		}
		startHash = head.Hash.String()
	}

	iter, err := repo.Log(&git.LogOptions{
		From:     plumbing.NewHash(startHash),
		FileName: ptrString(normalizedPath),
		Order:    git.LogOrderCommitterTime,
	})
	if err != nil {
		return nil, err
	}

	commits := make([]Commit, 0)
	stopAt := strings.TrimSpace(fromSHA)
	err = iter.ForEach(func(commit *object.Commit) error {
		if stopAt != "" && commit.Hash.String() == stopAt {
			return storer.ErrStop
		}
		commits = append(commits, commitFromObject(commit))
		return nil
	})
	if err != nil && !errors.Is(err, storer.ErrStop) {
		return nil, err
	}

	reverseCommits(commits)
	return commits, nil
}

func (r *Repository) lookupBranchCommitLocked(repo *git.Repository) (*object.Commit, error) {
	ref, err := repo.Reference(r.branchRef(), true)
	if err != nil {
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return repo.CommitObject(ref.Hash())
}

func (r *Repository) writeTreeRecursive(repo *git.Repository, base *object.Tree, parts []string, blobHash plumbing.Hash) (plumbing.Hash, error) {
	if len(parts) == 0 {
		return plumbing.ZeroHash, errors.New("path is required")
	}

	entries := cloneTreeEntries(base)
	if len(parts) == 1 {
		entries[parts[0]] = object.TreeEntry{
			Name: parts[0],
			Mode: filemode.Regular,
			Hash: blobHash,
		}
		return writeTree(repo, entries)
	}

	var childTree *object.Tree
	if base != nil {
		if entry, ok := entries[parts[0]]; ok {
			if entry.Mode != filemode.Dir {
				return plumbing.ZeroHash, fmt.Errorf("path component %s is not a directory", parts[0])
			}
			var err error
			childTree, err = repo.TreeObject(entry.Hash)
			if err != nil {
				return plumbing.ZeroHash, err
			}
		}
	}

	childHash, err := r.writeTreeRecursive(repo, childTree, parts[1:], blobHash)
	if err != nil {
		return plumbing.ZeroHash, err
	}

	entries[parts[0]] = object.TreeEntry{
		Name: parts[0],
		Mode: filemode.Dir,
		Hash: childHash,
	}
	return writeTree(repo, entries)
}

func (r *Repository) diffPathLocked(repo *git.Repository, normalizedPath string, fromSHA string, toSHA string) (string, error) {
	fromTree, err := lookupTree(repo, strings.TrimSpace(fromSHA))
	if err != nil {
		return "", err
	}
	toTree, err := lookupTree(repo, strings.TrimSpace(toSHA))
	if err != nil {
		return "", err
	}

	changes, err := object.DiffTree(fromTree, toTree)
	if err != nil {
		return "", err
	}

	filtered := make(object.Changes, 0, len(changes))
	for _, change := range changes {
		if changePath(change) == normalizedPath {
			filtered = append(filtered, change)
		}
	}
	if len(filtered) == 0 {
		return "", nil
	}

	patch, err := filtered.Patch()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(patch.String()), nil
}

func (r *Repository) tagFromReference(repo *git.Repository, ref *plumbing.Reference) (Tag, error) {
	result := Tag{
		RefName:      ref.Name().String(),
		Name:         ref.Name().Short(),
		TagObjectSHA: ref.Hash().String(),
	}

	commitHash, err := r.peelToCommitHash(repo, ref.Hash())
	if err == nil {
		result.TargetCommitSHA = commitHash.String()
	}

	tagObject, err := repo.TagObject(ref.Hash())
	if err != nil {
		if errors.Is(err, plumbing.ErrObjectNotFound) {
			return result, nil
		}
		return Tag{}, err
	}

	result.Subject, result.Body = splitMessage(tagObject.Message)
	result.CreatedAt = tagObject.Tagger.When.UTC().Format(time.RFC3339)
	if result.TargetCommitSHA == "" {
		commitHash, peelErr := r.peelToCommitHash(repo, tagObject.Target)
		if peelErr == nil {
			result.TargetCommitSHA = commitHash.String()
		}
	}
	return result, nil
}

func (r *Repository) peelToCommitHash(repo *git.Repository, hash plumbing.Hash) (plumbing.Hash, error) {
	if _, err := repo.CommitObject(hash); err == nil {
		return hash, nil
	}

	tagObject, err := repo.TagObject(hash)
	if err != nil {
		return plumbing.ZeroHash, err
	}
	return r.peelToCommitHash(repo, tagObject.Target)
}

func (r *Repository) isAncestor(repo *git.Repository, ancestor plumbing.Hash, descendant plumbing.Hash) bool {
	if ancestor == descendant {
		return true
	}

	queue := []plumbing.Hash{descendant}
	seen := map[plumbing.Hash]struct{}{}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if _, ok := seen[current]; ok {
			continue
		}
		seen[current] = struct{}{}
		if current == ancestor {
			return true
		}

		commit, err := repo.CommitObject(current)
		if err != nil {
			continue
		}
		queue = append(queue, commit.ParentHashes...)
	}

	return false
}

func (r *Repository) signature(now time.Time, author *AuthorIdentity) object.Signature {
	name := r.userName
	email := r.userEmail
	if author != nil {
		if trimmed := strings.TrimSpace(author.Name); trimmed != "" {
			name = trimmed
		}
		if trimmed := strings.TrimSpace(author.Email); trimmed != "" {
			email = trimmed
		}
	}
	return object.Signature{
		Name:  name,
		Email: email,
		When:  now,
	}
}

func (r *Repository) commitFilesOnceLocked(ctx context.Context, repo *git.Repository, files map[string][]byte, subject string, body string, author *AuthorIdentity) (Commit, error) {
	if err := r.syncLocked(ctx, repo); err != nil {
		return Commit{}, err
	}

	head, err := r.authoritativeBranchCommitLocked(repo)
	if err != nil {
		return Commit{}, err
	}

	var baseTree *object.Tree
	if head != nil {
		baseTree, err = head.Tree()
		if err != nil {
			return Commit{}, err
		}
	}

	paths := make([]string, 0, len(files))
	for normalizedPath := range files {
		paths = append(paths, normalizedPath)
	}
	sort.Strings(paths)

	treeHash := plumbing.ZeroHash
	currentTree := baseTree
	for _, normalizedPath := range paths {
		blobHash, writeErr := writeBlob(repo, files[normalizedPath])
		if writeErr != nil {
			return Commit{}, writeErr
		}

		treeHash, err = r.writeTreeRecursive(repo, currentTree, strings.Split(normalizedPath, "/"), blobHash)
		if err != nil {
			return Commit{}, err
		}
		currentTree, err = repo.TreeObject(treeHash)
		if err != nil {
			return Commit{}, err
		}
	}

	now := time.Now()
	commitObject := &object.Commit{
		Author:       r.signature(now, author),
		Committer:    r.signature(now, author),
		Message:      composeMessage(subject, body),
		TreeHash:     treeHash,
		ParentHashes: nil,
	}
	if head != nil {
		commitObject.ParentHashes = []plumbing.Hash{head.Hash}
	}

	commitHash, err := writeCommit(repo, commitObject)
	if err != nil {
		return Commit{}, err
	}

	if err := repo.Storer.SetReference(plumbing.NewHashReference(r.branchRef(), commitHash)); err != nil {
		return Commit{}, err
	}
	if err := repo.Storer.SetReference(plumbing.NewSymbolicReference(plumbing.HEAD, r.branchRef())); err != nil {
		return Commit{}, err
	}
	if err := r.pushRefsLocked(ctx, repo, []gitconfig.RefSpec{gitconfig.RefSpec(r.branchRef() + ":" + r.branchRef())}); err != nil {
		return Commit{}, err
	}

	commit, err := repo.CommitObject(commitHash)
	if err != nil {
		return Commit{}, err
	}
	return commitFromObject(commit), nil
}

func (r *Repository) authoritativeBranchCommitLocked(repo *git.Repository) (*object.Commit, error) {
	if r.remoteURL != "" {
		ref, err := repo.Reference(r.remoteBranchRef(), true)
		if err == nil {
			return repo.CommitObject(ref.Hash())
		}
		if !errors.Is(err, plumbing.ErrReferenceNotFound) {
			return nil, err
		}
	}
	return r.lookupBranchCommitLocked(repo)
}

func (r *Repository) remoteAuth() transport.AuthMethod {
	if r == nil || r.remoteURL == "" || r.remotePassword == "" {
		return nil
	}

	parsedURL, err := url.Parse(r.remoteURL)
	if err != nil {
		return nil
	}

	switch strings.ToLower(parsedURL.Scheme) {
	case "http", "https":
		return &githttp.BasicAuth{
			Username: fallback(r.remoteUsername, "git"),
			Password: r.remotePassword,
		}
	default:
		return nil
	}
}

func isConcurrentUpdateError(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "non-fast-forward") ||
		strings.Contains(text, "fetch first") ||
		strings.Contains(text, "failed to push some refs") ||
		strings.Contains(text, "tip of your current branch is behind")
}

func isEmptyRemoteRepositoryError(err error) bool {
	return errors.Is(err, transport.ErrEmptyRemoteRepository)
}

func writeBlob(repo *git.Repository, payload []byte) (plumbing.Hash, error) {
	obj := repo.Storer.NewEncodedObject()
	obj.SetType(plumbing.BlobObject)
	writer, err := obj.Writer()
	if err != nil {
		return plumbing.ZeroHash, err
	}
	if _, err := writer.Write(payload); err != nil {
		_ = writer.Close()
		return plumbing.ZeroHash, err
	}
	if err := writer.Close(); err != nil {
		return plumbing.ZeroHash, err
	}
	return repo.Storer.SetEncodedObject(obj)
}

func writeTree(repo *git.Repository, entries map[string]object.TreeEntry) (plumbing.Hash, error) {
	tree := &object.Tree{Entries: make([]object.TreeEntry, 0, len(entries))}
	for _, entry := range entries {
		tree.Entries = append(tree.Entries, entry)
	}
	sort.Sort(object.TreeEntrySorter(tree.Entries))

	obj := repo.Storer.NewEncodedObject()
	if err := tree.Encode(obj); err != nil {
		return plumbing.ZeroHash, err
	}
	return repo.Storer.SetEncodedObject(obj)
}

func writeCommit(repo *git.Repository, commit *object.Commit) (plumbing.Hash, error) {
	obj := repo.Storer.NewEncodedObject()
	if err := commit.Encode(obj); err != nil {
		return plumbing.ZeroHash, err
	}
	return repo.Storer.SetEncodedObject(obj)
}

func lookupTree(repo *git.Repository, commitSHA string) (*object.Tree, error) {
	if strings.TrimSpace(commitSHA) == "" {
		return nil, nil
	}

	commit, err := repo.CommitObject(plumbing.NewHash(commitSHA))
	if err != nil {
		return nil, err
	}
	return commit.Tree()
}

func cloneTreeEntries(tree *object.Tree) map[string]object.TreeEntry {
	entries := make(map[string]object.TreeEntry)
	if tree == nil {
		return entries
	}
	for _, entry := range tree.Entries {
		entries[entry.Name] = entry
	}
	return entries
}

func changePath(change *object.Change) string {
	if change == nil {
		return ""
	}
	if change.To.Name != "" {
		return path.Clean(change.To.Name)
	}
	return path.Clean(change.From.Name)
}

func commitFromObject(commit *object.Commit) Commit {
	summary, body := splitMessage(commit.Message)
	return Commit{
		SHA:         commit.Hash.String(),
		CreatedAt:   commit.Author.When.UTC().Format(time.RFC3339),
		Author:      commit.Author.Name,
		AuthorEmail: commit.Author.Email,
		Summary:     summary,
		Body:        body,
	}
}

func closeRepository(_ *git.Repository) error {
	return nil
}

func contextError(ctx context.Context) error {
	if ctx == nil {
		return nil
	}
	return ctx.Err()
}

func composeMessage(subject string, body string) string {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "save snapshot"
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return subject
	}
	return subject + "\n\n" + body
}

func splitMessage(message string) (string, string) {
	message = strings.ReplaceAll(message, "\r\n", "\n")
	message = strings.TrimSpace(message)
	if message == "" {
		return "", ""
	}
	parts := strings.SplitN(message, "\n\n", 2)
	if len(parts) == 1 {
		return strings.TrimSpace(parts[0]), ""
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
}

func normalizeRelativePath(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("relative path is required")
	}
	cleaned := path.Clean(strings.ReplaceAll(value, "\\", "/"))
	switch {
	case cleaned == ".":
		return "", errors.New("relative path is required")
	case strings.HasPrefix(cleaned, "../"), cleaned == "..":
		return "", errors.New("relative path must stay inside repository")
	case strings.HasPrefix(cleaned, "/"):
		return "", errors.New("relative path must be relative")
	default:
		return cleaned, nil
	}
}

func reverseCommits(commits []Commit) {
	for left, right := 0, len(commits)-1; left < right; left, right = left+1, right-1 {
		commits[left], commits[right] = commits[right], commits[left]
	}
}

func fallback(value string, fallbackValue string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallbackValue
	}
	return value
}

func ptrString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	copyValue := value
	return &copyValue
}

func ptrSignature(value object.Signature) *object.Signature {
	return &value
}

func (r *Repository) branchRef() plumbing.ReferenceName {
	return plumbing.NewBranchReferenceName(r.branch)
}

func (r *Repository) remoteBranchRef() plumbing.ReferenceName {
	return plumbing.NewRemoteReferenceName(r.remoteName, r.branch)
}
