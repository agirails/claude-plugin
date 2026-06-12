# Releasing the AGIRAILS Claude Code plugin

The plugin is distributed straight from this Git repository
(`github.com/agirails/claude-plugin`). There is **no separate marketplace
submission step** — Claude Code reads `.claude-plugin/marketplace.json` and
`.claude-plugin/plugin.json` directly from the repo. Pushing to `main` is
publishing.

## Release checklist

1. **Bump the version in all three places, in lockstep:**
   - `.claude-plugin/plugin.json` → `version`
   - `.claude-plugin/marketplace.json` → `metadata.version`
   - `.claude-plugin/marketplace.json` → `plugins[0].version`

   They must always match. A drift here is how users end up unsure which
   version they actually have.

2. **Validate both manifests parse:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"
   node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"
   ```

3. **Commit** with a conventional message (`fix:`, `feat:`, `docs:`…).

4. **Tag the release commit** `v<version>` and push the tag:
   ```bash
   git tag -a v3.1.0 -m "Release v3.1.0"
   git push origin main v3.1.0
   ```
   Tagging is new as of v3.1.0 — earlier releases were untagged, which made
   it impossible to see what shipped when. Tag every release from here on.

## How users get the update

Claude Code does **not** auto-update an installed plugin. A user on an old
version (e.g. the cache showed `1.0.0` while the repo was at `3.0.0`) keeps
running their cached copy until they explicitly refresh it:

- `/plugin` → reinstall / update `agirails`, **or**
- remove the cached copy and reinstall:
  ```bash
  rm -rf ~/.claude/plugins/cache/agirails
  # then reinstall via /plugin
  ```

Because of this, **a fix is not "live" for existing users on push alone** —
they must re-pull. When a fix matters for someone specific, tell them to
reinstall. (For a truly urgent hotfix you can also overwrite the cached
files directly under `~/.claude/plugins/cache/agirails/agirails/<version>/`
and `~/.claude/plugins/marketplaces/agirails/`, but that is a local
workaround, not distribution.)

## Versioning

Semver:
- **patch** (`3.1.0` → `3.1.1`) — doc/content fixes, no behavior change for
  command/skill consumers.
- **minor** (`3.0.0` → `3.1.0`) — new commands/skills, or a meaningful
  rewrite of an existing one (e.g. the `init` defer-to-AGIRAILS.md rewrite).
- **major** — removing/renaming commands or skills, or any change that
  breaks a user's existing invocation.
