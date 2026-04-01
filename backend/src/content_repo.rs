use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use git2::{
    Commit, Cred, DiffFormat, DiffOptions, FetchOptions, FileMode, IndexAddOption, ObjectType, Oid,
    RemoteCallbacks, Repository, Signature, Sort, Tree,
};

use crate::config::AppConfig;

const EXPORT_PATH: &str = "public/export.json";
const DEPLOY_LIVE_REF: &str = "refs/publish/deploy/live";

#[derive(Debug, Clone)]
pub struct RepoCommit {
    pub sha: String,
    pub created_at: String,
    pub author: String,
    pub author_email: String,
    pub summary: String,
    pub body: String,
}

#[derive(Clone)]
pub struct ContentRepo {
    path: PathBuf,
    remote_url: String,
    remote_name: String,
    remote_username: String,
    remote_password: String,
    branch: String,
}

impl ContentRepo {
    pub fn commit_public_export_with_author(
        &self,
        payload: &[u8],
        actor: &str,
        author_name: &str,
        author_email: &str,
    ) -> Result<String, String> {
        self.commit_file_with_author(
            EXPORT_PATH,
            payload,
            "publish site snapshot",
            &format!("actor: {}", actor.trim()),
            author_name,
            author_email,
        )
    }

    pub fn path(&self) -> &str {
        self.path.to_str().unwrap_or_default()
    }

    pub fn from_config(config: &AppConfig) -> Option<Self> {
        let path = config.content_repo_dir.trim();
        if path.is_empty() {
            return None;
        }
        Some(Self {
            path: PathBuf::from(path),
            remote_url: config.content_repo_source_url.trim().to_owned(),
            remote_name: "source".to_owned(),
            remote_username: config.content_repo_source_username.trim().to_owned(),
            remote_password: config.content_repo_source_password.trim().to_owned(),
            branch: config.editorial_git_branch.trim().to_owned(),
        })
    }

    pub fn ensure_ready(&self) -> Result<(), String> {
        let repo = self.open_or_init()?;
        self.ensure_remote(&repo)?;
        self.sync_remote(&repo)?;
        self.ensure_head(&repo)?;
        Ok(())
    }

    pub fn commit_file_with_author(
        &self,
        relative_path: &str,
        payload: &[u8],
        subject: &str,
        body: &str,
        author_name: &str,
        author_email: &str,
    ) -> Result<String, String> {
        let repo = self.open_or_init()?;
        self.ensure_head(&repo)?;

        let normalized_path = normalize_relative_path(relative_path)?;
        let tree = if let Some(workdir) = repo.workdir() {
            let absolute_path = workdir.join(&normalized_path);
            if let Some(parent) = absolute_path.parent() {
                fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            fs::write(&absolute_path, payload).map_err(|err| err.to_string())?;

            let mut index = repo.index().map_err(|err| err.to_string())?;
            index
                .add_all([normalized_path.as_str()], IndexAddOption::DEFAULT, None)
                .map_err(|err| err.to_string())?;
            index.write().map_err(|err| err.to_string())?;
            let tree_id = index.write_tree().map_err(|err| err.to_string())?;
            repo.find_tree(tree_id).map_err(|err| err.to_string())?
        } else {
            build_tree_with_blob(&repo, &normalized_path, payload)?
        };

        let signature = self
            .signature(author_name, author_email)
            .map_err(|err| err.to_string())?;
        let message = compose_commit_message(subject, body);
        let oid = match self.head_commit(&repo)? {
            Some(parent) => repo
                .commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    &message,
                    &tree,
                    &[&parent],
                )
                .map_err(|err| err.to_string())?,
            None => repo
                .commit(Some("HEAD"), &signature, &signature, &message, &tree, &[])
                .map_err(|err| err.to_string())?,
        };
        Ok(oid.to_string())
    }

    pub fn read_file_at_commit(
        &self,
        relative_path: &str,
        commit_sha: &str,
    ) -> Result<Vec<u8>, String> {
        let repo = self.open_existing()?;
        let normalized_path = normalize_relative_path(relative_path)?;
        let commit = repo
            .find_commit(Oid::from_str(commit_sha.trim()).map_err(|err| err.to_string())?)
            .map_err(|err| err.to_string())?;
        let tree = commit.tree().map_err(|err| err.to_string())?;
        let entry = tree
            .get_path(Path::new(&normalized_path))
            .map_err(|err| err.to_string())?;
        let blob = repo.find_blob(entry.id()).map_err(|err| err.to_string())?;
        Ok(blob.content().to_vec())
    }

    pub fn get_commit(&self, commit_sha: &str) -> Result<RepoCommit, String> {
        let repo = self.open_existing()?;
        let commit = repo
            .find_commit(Oid::from_str(commit_sha.trim()).map_err(|err| err.to_string())?)
            .map_err(|err| err.to_string())?;
        Ok(repo_commit_from_object(&commit))
    }

    pub fn commit_body(&self, commit_sha: &str) -> Result<String, String> {
        self.get_commit(commit_sha).map(|commit| commit.body)
    }

    pub fn file_history(&self, relative_path: &str) -> Result<Vec<RepoCommit>, String> {
        self.commits_for_path_between(relative_path, "", "")
    }

    pub fn commits_for_path_between(
        &self,
        relative_path: &str,
        from_sha: &str,
        to_sha: &str,
    ) -> Result<Vec<RepoCommit>, String> {
        let repo = self.open_existing()?;
        let normalized_path = normalize_relative_path(relative_path)?;
        let start_oid = if to_sha.trim().is_empty() {
            self.head_commit(&repo)?
                .map(|commit| commit.id())
                .ok_or_else(|| "repository does not have commits".to_owned())?
        } else {
            Oid::from_str(to_sha.trim()).map_err(|err| err.to_string())?
        };

        let mut walk = repo.revwalk().map_err(|err| err.to_string())?;
        walk.set_sorting(Sort::TIME)
            .map_err(|err| err.to_string())?;
        walk.push(start_oid).map_err(|err| err.to_string())?;

        let mut commits = Vec::new();
        for oid in walk {
            let oid = oid.map_err(|err| err.to_string())?;
            if !from_sha.trim().is_empty() && oid.to_string() == from_sha.trim() {
                break;
            }
            let commit = repo.find_commit(oid).map_err(|err| err.to_string())?;
            if commit_touches_path(&repo, &commit, &normalized_path)? {
                commits.push(repo_commit_from_object(&commit));
            }
        }
        commits.reverse();
        Ok(commits)
    }

    pub fn diff_path(
        &self,
        from_sha: &str,
        to_sha: &str,
        relative_path: &str,
    ) -> Result<String, String> {
        let repo = self.open_existing()?;
        let normalized_path = normalize_relative_path(relative_path)?;
        let from_commit = lookup_commit(&repo, from_sha)?;
        let to_commit = lookup_commit(&repo, to_sha)?;
        let from_tree = match from_commit.as_ref() {
            Some(commit) => Some(commit.tree().map_err(|err| err.to_string())?),
            None => None,
        };
        let to_tree = match to_commit.as_ref() {
            Some(commit) => Some(commit.tree().map_err(|err| err.to_string())?),
            None => None,
        };

        let mut options = DiffOptions::new();
        options.pathspec(&normalized_path);
        let diff = repo
            .diff_tree_to_tree(from_tree.as_ref(), to_tree.as_ref(), Some(&mut options))
            .map_err(|err| err.to_string())?;
        diff_to_string(&diff)
    }

    pub fn commit_diff(&self, commit_sha: &str, relative_path: &str) -> Result<String, String> {
        let repo = self.open_existing()?;
        let commit = repo
            .find_commit(Oid::from_str(commit_sha.trim()).map_err(|err| err.to_string())?)
            .map_err(|err| err.to_string())?;
        let from_sha = if commit.parent_count() > 0 {
            commit
                .parent_id(0)
                .map_err(|err| err.to_string())?
                .to_string()
        } else {
            String::new()
        };
        self.diff_path(&from_sha, commit_sha, relative_path)
    }

    pub fn create_annotated_tag(
        &self,
        name: &str,
        target_commit_sha: &str,
        subject: &str,
        body: &str,
        author_name: &str,
        author_email: &str,
    ) -> Result<String, String> {
        let repo = self.open_or_init()?;
        let target = repo
            .find_object(
                Oid::from_str(target_commit_sha.trim()).map_err(|err| err.to_string())?,
                Some(ObjectType::Commit),
            )
            .map_err(|err| err.to_string())?;
        let signature = self
            .signature(author_name, author_email)
            .map_err(|err| err.to_string())?;
        match repo
            .tag(
                name.trim(),
                &target,
                &signature,
                &compose_commit_message(subject, body),
                false,
            )
            .map(|oid| oid.to_string())
        {
            Ok(oid) => Ok(oid),
            Err(err) => {
                let message = compose_commit_message(subject, body);
                run_git_with_env_and_stdin(
                    &self.path,
                    [
                        "tag",
                        "-a",
                        name.trim(),
                        target_commit_sha.trim(),
                        "--cleanup=verbatim",
                        "--file=-",
                    ],
                    [
                        ("GIT_AUTHOR_NAME", author_name.trim()),
                        ("GIT_AUTHOR_EMAIL", author_email.trim()),
                        ("GIT_COMMITTER_NAME", author_name.trim()),
                        ("GIT_COMMITTER_EMAIL", author_email.trim()),
                    ],
                    &message,
                )
                .map_err(|fallback_err| format!("{err}; fallback: {fallback_err}"))?;
                let output = run_git(
                    &self.path,
                    ["rev-parse", &format!("refs/tags/{}", name.trim())],
                )
                .map_err(|fallback_err| format!("{err}; fallback: {fallback_err}"))?;
                Ok(output.trim().to_owned())
            }
        }
    }

    pub fn update_reference(&self, name: &str, target_sha: &str) -> Result<(), String> {
        let repo = self.open_or_init()?;
        let oid = Oid::from_str(target_sha.trim()).map_err(|err| err.to_string())?;
        let result = match repo.find_reference(name.trim()) {
            Ok(mut reference) => reference
                .set_target(oid, "update reference")
                .map(|_| ())
                .map_err(|err| err.to_string()),
            Err(_) => repo
                .reference(name.trim(), oid, true, "create reference")
                .map(|_| ())
                .map_err(|err| err.to_string()),
        };
        if let Err(err) = result {
            run_git(&self.path, ["update-ref", name.trim(), target_sha.trim()])
                .map_err(|fallback_err| format!("{err}; fallback: {fallback_err}"))?;
        }
        Ok(())
    }

    pub fn record_deploy_success(
        &self,
        commit_sha: &str,
        manifest_yaml: &str,
        author_name: &str,
        author_email: &str,
    ) -> Result<(), String> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|err| err.to_string())?;
        let published_at = humantime::format_rfc3339_seconds(SystemTime::now()).to_string();
        let tag_name = format!(
            "publish/{}-{:09}Z",
            published_at
                .chars()
                .filter(|ch| ch.is_ascii_digit() || *ch == 'T')
                .collect::<String>()
                .replace('T', "-"),
            timestamp.subsec_nanos()
        );
        let subject = format!("deploy: {published_at}");
        let tag_object_sha = self.create_annotated_tag(
            &tag_name,
            commit_sha,
            &subject,
            manifest_yaml,
            author_name,
            author_email,
        )?;
        self.update_reference(DEPLOY_LIVE_REF, &tag_object_sha)
    }

    pub fn resolve_reference(&self, name: &str) -> Result<(String, String), String> {
        let repo = self.open_existing()?;
        let reference = repo
            .find_reference(name.trim())
            .map_err(|err| err.to_string())?
            .resolve()
            .map_err(|err| err.to_string())?;
        let object_oid = reference
            .target()
            .ok_or_else(|| "reference target is missing".to_owned())?;
        Ok((
            object_oid.to_string(),
            peel_to_commit_oid(&repo, object_oid)?.to_string(),
        ))
    }

    pub fn list_files(&self, prefix: &str, suffix: &str) -> Result<Vec<String>, String> {
        let repo = self.open_existing()?;
        let Some(head) = self.head_commit(&repo)? else {
            return Ok(Vec::new());
        };
        let tree = head.tree().map_err(|err| err.to_string())?;
        let mut files = Vec::new();
        collect_tree_files(&repo, &tree, "", prefix.trim(), suffix.trim(), &mut files)?;
        files.sort();
        Ok(files)
    }

    pub fn list_files_at_commit(
        &self,
        commit_sha: &str,
        prefix: &str,
        suffix: &str,
    ) -> Result<Vec<String>, String> {
        let repo = self.open_existing()?;
        let commit = repo
            .find_commit(Oid::from_str(commit_sha.trim()).map_err(|err| err.to_string())?)
            .map_err(|err| err.to_string())?;
        let tree = commit.tree().map_err(|err| err.to_string())?;
        let mut files = Vec::new();
        collect_tree_files(&repo, &tree, "", prefix.trim(), suffix.trim(), &mut files)?;
        files.sort();
        Ok(files)
    }

    pub fn list_references(&self, prefix: &str) -> Result<Vec<(String, String, String)>, String> {
        let repo = self.open_existing()?;
        let mut refs = Vec::new();
        let iter = if prefix.trim().is_empty() {
            repo.references().map_err(|err| err.to_string())?
        } else {
            repo.references_glob(&format!("{}*", prefix.trim()))
                .map_err(|err| err.to_string())?
        };
        for reference in iter {
            let reference = reference.map_err(|err| err.to_string())?;
            let Some(name) = reference.name() else {
                continue;
            };
            if !prefix.trim().is_empty() && !name.starts_with(prefix.trim()) {
                continue;
            }
            let resolved = reference.resolve().map_err(|err| err.to_string())?;
            let Some(object_oid) = resolved.target() else {
                continue;
            };
            let commit_oid = peel_to_commit_oid(&repo, object_oid)?;
            refs.push((
                name.to_owned(),
                object_oid.to_string(),
                commit_oid.to_string(),
            ));
        }
        Ok(refs)
    }

    fn open_existing(&self) -> Result<Repository, String> {
        Repository::open(&self.path).map_err(|err| err.to_string())
    }

    fn open_or_init(&self) -> Result<Repository, String> {
        if let Ok(repo) = Repository::open(&self.path) {
            return Ok(repo);
        }
        fs::create_dir_all(&self.path).map_err(|err| err.to_string())?;
        Repository::init(&self.path).map_err(|err| err.to_string())
    }

    fn ensure_remote(&self, repo: &Repository) -> Result<(), String> {
        if self.remote_url.trim().is_empty() {
            return Ok(());
        }
        if repo.find_remote(&self.remote_name).is_ok() {
            repo.remote_set_url(&self.remote_name, &self.remote_url)
                .map_err(|err| err.to_string())?;
            return Ok(());
        }
        repo.remote(&self.remote_name, &self.remote_url)
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    fn sync_remote(&self, repo: &Repository) -> Result<(), String> {
        if self.remote_url.trim().is_empty() {
            return Ok(());
        }

        let mut callbacks = RemoteCallbacks::new();
        let username = self.remote_username.clone();
        let password = self.remote_password.clone();
        callbacks.credentials(move |_url, username_from_url, _allowed| {
            if !username.is_empty() || !password.is_empty() {
                Cred::userpass_plaintext(
                    if username.is_empty() {
                        username_from_url.unwrap_or("git")
                    } else {
                        username.as_str()
                    },
                    password.as_str(),
                )
            } else {
                Cred::default()
            }
        });

        let mut fetch_options = FetchOptions::new();
        fetch_options.remote_callbacks(callbacks);

        let mut remote = repo
            .find_remote(&self.remote_name)
            .or_else(|_| repo.remote_anonymous(&self.remote_url))
            .map_err(|err| err.to_string())?;

        let refspecs = [
            "+refs/heads/*:refs/remotes/source/*",
            "+refs/tags/*:refs/tags/*",
            "+refs/publish/*:refs/publish/*",
        ];
        match remote.fetch(&refspecs, Some(&mut fetch_options), None) {
            Ok(()) => {}
            Err(err) => {
                let message = err.message();
                if !message.contains("not found")
                    && !message.contains("couldn't find remote ref")
                    && !message.contains("no such remote")
                    && !message.contains("authentication required")
                    && !message.contains("repository not found")
                    && !message.contains("unborn branch")
                    && !message.contains("no references")
                {
                    let remote_url = self.remote_url_with_auth();
                    run_git(
                        &self.path,
                        [
                            "fetch",
                            "--force",
                            &remote_url,
                            "+refs/heads/*:refs/remotes/source/*",
                            "+refs/tags/*:refs/tags/*",
                            "+refs/publish/*:refs/publish/*",
                        ],
                    )
                    .map_err(|fallback_err| format!("{err}; fallback: {fallback_err}"))?;
                }
            }
        }

        let remote_branch = format!("refs/remotes/{}/{}", self.remote_name, self.branch_name());
        if let Ok(reference) = repo.find_reference(&remote_branch)
            && let Some(target) = reference.target()
        {
            let head_ref = format!("refs/heads/{}", self.branch_name());
            match repo.find_reference(&head_ref) {
                Ok(mut head) => {
                    head.set_target(target, "sync remote branch")
                        .map_err(|err| err.to_string())?;
                }
                Err(_) => {
                    repo.reference(&head_ref, target, true, "create branch from remote")
                        .map_err(|err| err.to_string())?;
                }
            }
        }
        Ok(())
    }

    fn ensure_head(&self, repo: &Repository) -> Result<(), String> {
        let head_ref = format!("refs/heads/{}", self.branch_name());
        if repo.head().is_err() {
            repo.set_head(&head_ref).map_err(|err| err.to_string())?;
            return Ok(());
        }
        if repo
            .head()
            .ok()
            .and_then(|head| head.name().map(str::to_owned))
            .as_deref()
            != Some(head_ref.as_str())
        {
            repo.set_head(&head_ref).map_err(|err| err.to_string())?;
        }
        Ok(())
    }

    fn head_commit<'a>(&self, repo: &'a Repository) -> Result<Option<git2::Commit<'a>>, String> {
        let Ok(head) = repo.head() else {
            return Ok(None);
        };
        let Some(target) = head.target() else {
            return Ok(None);
        };
        repo.find_commit(target)
            .map(Some)
            .map_err(|err| err.to_string())
    }

    fn signature(
        &self,
        author_name: &str,
        author_email: &str,
    ) -> Result<Signature<'static>, git2::Error> {
        let name = author_name.trim();
        let email = author_email.trim();
        if name.is_empty() {
            return Err(git2::Error::from_str("git author name is required"));
        }
        if email.is_empty() {
            return Err(git2::Error::from_str("git author email is required"));
        }
        Signature::now(&name, &email)
    }

    fn branch_name(&self) -> &str {
        if self.branch.trim().is_empty() {
            "main"
        } else {
            self.branch.as_str()
        }
    }

    fn remote_url_with_auth(&self) -> String {
        if self.remote_url.trim().is_empty()
            || self.remote_username.trim().is_empty()
            || self.remote_password.trim().is_empty()
            || !self.remote_url.starts_with("https://")
        {
            return self.remote_url.clone();
        }
        let rest = self.remote_url.trim_start_matches("https://");
        format!(
            "https://{}:{}@{}",
            self.remote_username.trim(),
            self.remote_password.trim(),
            rest
        )
    }
}

fn compose_commit_message(subject: &str, body: &str) -> String {
    let subject = subject.trim();
    let body = body.trim();
    if body.is_empty() {
        subject.to_owned()
    } else {
        format!("{subject}\n\n{body}")
    }
}

fn run_git_with_env_and_stdin<const N: usize, const M: usize>(
    repo_path: &Path,
    args: [&str; N],
    envs: [(&str, &str); M],
    stdin: &str,
) -> Result<String, String> {
    let mut command = Command::new("git");
    command.args(args).current_dir(repo_path);
    for (key, value) in envs {
        if !value.trim().is_empty() {
            command.env(key, value);
        }
    }
    command.stdin(std::process::Stdio::piped());
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let mut child = command.spawn().map_err(|err| err.to_string())?;
    if let Some(mut child_stdin) = child.stdin.take() {
        use std::io::Write as _;
        child_stdin
            .write_all(stdin.as_bytes())
            .map_err(|err| err.to_string())?;
    }
    let output = child.wait_with_output().map_err(|err| err.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    if stderr.is_empty() {
        Err(format!("git {} failed", args.join(" ")))
    } else {
        Err(stderr)
    }
}

fn normalize_relative_path(relative_path: &str) -> Result<String, String> {
    let normalized = relative_path.trim().replace('\\', "/");
    if normalized.is_empty() || normalized.starts_with('/') || normalized.contains("..") {
        return Err("invalid relative path".to_owned());
    }
    Ok(normalized)
}

fn build_tree_with_blob<'repo>(
    repo: &'repo Repository,
    relative_path: &str,
    payload: &[u8],
) -> Result<Tree<'repo>, String> {
    let blob_id = repo.blob(payload).map_err(|err| err.to_string())?;
    let parent_tree = head_tree(repo)?;
    let parts = relative_path
        .split('/')
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>();
    if parts.is_empty() {
        return Err("invalid relative path".to_owned());
    }
    let tree_id = write_tree_path(repo, parent_tree.as_ref(), &parts, blob_id)?;
    repo.find_tree(tree_id).map_err(|err| err.to_string())
}

fn head_tree(repo: &Repository) -> Result<Option<Tree<'_>>, String> {
    let Ok(head) = repo.head() else {
        return Ok(None);
    };
    let Some(target) = head.target() else {
        return Ok(None);
    };
    let commit = repo.find_commit(target).map_err(|err| err.to_string())?;
    commit.tree().map(Some).map_err(|err| err.to_string())
}

fn write_tree_path(
    repo: &Repository,
    current: Option<&Tree<'_>>,
    parts: &[&str],
    blob_id: Oid,
) -> Result<Oid, String> {
    let mut builder = match current {
        Some(tree) => repo
            .treebuilder(Some(tree))
            .map_err(|err| err.to_string())?,
        None => repo.treebuilder(None).map_err(|err| err.to_string())?,
    };

    if parts.len() == 1 {
        builder
            .insert(parts[0], blob_id, FileMode::Blob.into())
            .map_err(|err| err.to_string())?;
    } else {
        let subtree = current
            .and_then(|tree| tree.get_name(parts[0]))
            .and_then(|entry| {
                if entry.kind() == Some(git2::ObjectType::Tree) {
                    repo.find_tree(entry.id()).ok()
                } else {
                    None
                }
            });
        let subtree_id = write_tree_path(repo, subtree.as_ref(), &parts[1..], blob_id)?;
        builder
            .insert(parts[0], subtree_id, FileMode::Tree.into())
            .map_err(|err| err.to_string())?;
    }

    builder.write().map_err(|err| err.to_string())
}

fn repo_commit_from_object(commit: &Commit<'_>) -> RepoCommit {
    let summary = commit.summary().unwrap_or_default().trim().to_owned();
    let full_message = commit.message().unwrap_or_default().replace("\r\n", "\n");
    let body = full_message
        .split_once("\n\n")
        .map(|(_, body)| body.trim().to_owned())
        .unwrap_or_default();
    let author = commit.author();
    RepoCommit {
        sha: commit.id().to_string(),
        created_at: humantime::format_rfc3339_seconds(
            std::time::UNIX_EPOCH
                + std::time::Duration::from_secs(commit.time().seconds().max(0) as u64),
        )
        .to_string(),
        author: author.name().unwrap_or_default().trim().to_owned(),
        author_email: author.email().unwrap_or_default().trim().to_owned(),
        summary,
        body,
    }
}

fn lookup_commit<'repo>(
    repo: &'repo Repository,
    commit_sha: &str,
) -> Result<Option<Commit<'repo>>, String> {
    let commit_sha = commit_sha.trim();
    if commit_sha.is_empty() {
        return Ok(None);
    }
    repo.find_commit(Oid::from_str(commit_sha).map_err(|err| err.to_string())?)
        .map(Some)
        .map_err(|err| err.to_string())
}

fn peel_to_commit_oid(repo: &Repository, oid: Oid) -> Result<Oid, String> {
    if repo.find_commit(oid).is_ok() {
        return Ok(oid);
    }
    let tag = repo.find_tag(oid).map_err(|err| err.to_string())?;
    peel_to_commit_oid(repo, tag.target_id())
}

fn diff_to_string(diff: &git2::Diff<'_>) -> Result<String, String> {
    let mut output = Vec::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        output.extend_from_slice(line.content());
        true
    })
    .map_err(|err| err.to_string())?;
    Ok(String::from_utf8_lossy(&output).trim().to_owned())
}

fn collect_tree_files(
    repo: &Repository,
    tree: &Tree<'_>,
    base: &str,
    prefix: &str,
    suffix: &str,
    out: &mut Vec<String>,
) -> Result<(), String> {
    for entry in tree {
        let Some(name) = entry.name() else {
            continue;
        };
        let path = if base.is_empty() {
            name.to_owned()
        } else {
            format!("{base}/{name}")
        };
        match entry.kind() {
            Some(ObjectType::Blob) => {
                if (prefix.is_empty() || path.starts_with(prefix))
                    && (suffix.is_empty() || path.ends_with(suffix))
                {
                    out.push(path);
                }
            }
            Some(ObjectType::Tree) => {
                let subtree = repo.find_tree(entry.id()).map_err(|err| err.to_string())?;
                collect_tree_files(repo, &subtree, &path, prefix, suffix, out)?;
            }
            _ => {}
        }
    }
    Ok(())
}

fn run_git<I, S>(repo_path: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|err| err.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    if stderr.is_empty() {
        Err(format!("git exited with status {}", output.status))
    } else {
        Err(stderr)
    }
}

fn commit_touches_path(repo: &Repository, commit: &Commit<'_>, path: &str) -> Result<bool, String> {
    let tree = commit.tree().map_err(|err| err.to_string())?;
    let old_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|err| err.to_string())?
                .tree()
                .map_err(|err| err.to_string())?,
        )
    } else {
        None
    };

    let mut options = DiffOptions::new();
    options.pathspec(path);
    let diff = repo
        .diff_tree_to_tree(old_tree.as_ref(), Some(&tree), Some(&mut options))
        .map_err(|err| err.to_string())?;
    Ok(diff.deltas().len() > 0)
}
