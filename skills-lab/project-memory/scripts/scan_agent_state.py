#!/usr/bin/env python3
"""Scan all AI agent state directories and output consolidated JSON summary.

Reads: Claude Code, Codex CLI, Gemini/Antigravity, Aider, Augment.
Outputs: JSON to stdout with each agent's last session, model, cost, and status.

Usage:
    python3 scan_agent_state.py /path/to/project

Design notes (2026):
    - Each agent stores state differently: JSONL, SQLite, TOML, Protobuf, Markdown
    - This script handles the format diversity so the calling agent doesn't have to
    - Deliberately avoids importing any non-stdlib packages
    - Handles large files by reading tails, not loading entire contents
"""

import json
import os
import sys
import glob
import subprocess
from pathlib import Path
from datetime import datetime


def get_home():
    """Get home directory."""
    return Path.home()


def path_to_claude_key(project_path: str) -> str:
    """Convert /home/user/projects/3_RESOURCES/foo -> -home-user-projects-3-RESOURCES-foo

    Claude Code replaces both / and _ with dashes in project directory keys.
    """
    return project_path.replace("/", "-").replace("_", "-")


def read_tail(filepath: str, lines: int = 50) -> list[str]:
    """Read last N lines of a file efficiently in pure Python (cross-platform)."""
    try:
        with open(filepath, 'rb') as f:
            f.seek(0, os.SEEK_END)
            filesize = f.tell()
            blocksize = 8192
            if filesize == 0:
                return []
            
            blocks = []
            lines_found = 0
            position = filesize

            while position > 0 and lines_found <= lines:
                read_size = min(blocksize, position)
                position -= read_size
                f.seek(position)
                block = f.read(read_size)
                blocks.append(block)
                lines_found += block.count(b'\n')

            data = b''.join(reversed(blocks))
            output_lines = data.decode('utf-8', errors='replace').splitlines()
            return output_lines[-lines:] if output_lines else []
    except Exception:
        return []


def scan_claude_code(project_path: str) -> dict:
    """Scan Claude Code state for the given project.

    Reads:
        - ~/.claude/projects/-<path-dashed>/*.jsonl (session logs)
        - ~/.claude/projects/-<path-dashed>/memory/ (learned feedback)
        - ~/.claude/plans/*.md (named plans)
        - ~/.claude.json (global state with per-project metrics)
    """
    home = get_home()
    key = path_to_claude_key(project_path)
    project_dir = home / ".claude" / "projects" / key
    result = {"found": False}

    if not project_dir.exists():
        return result

    result["found"] = True

    # Find latest session log
    jsonl_files = sorted(
        project_dir.glob("*.jsonl"),
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )

    for jsonl_file in jsonl_files:
        lines = read_tail(str(jsonl_file), 30)
        last_prompt = None
        last_response = None
        stop_reason = None
        last_timestamp = None
        is_rate_limited = False

        for line in lines:
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            t = obj.get("type", "")

            if t == "user" and not obj.get("isMeta"):
                msg = obj.get("message", {})
                content = msg.get("content", "")
                if isinstance(content, str) and content.strip():
                    last_prompt = content[:300]
                    last_timestamp = obj.get("timestamp")

            elif t == "assistant":
                msg = obj.get("message", {})
                if obj.get("error") == "rate_limit":
                    is_rate_limited = True
                    for block in msg.get("content", []):
                        if block.get("type") == "text":
                            stop_reason = f"rate_limit: {block['text']}"
                    continue

                for block in msg.get("content", []):
                    if block.get("type") == "text":
                        last_response = block["text"][:300]
                stop_reason = msg.get("stop_reason", "unknown")
                last_timestamp = obj.get("timestamp")

        # Skip sessions that are just /clear → /exit
        if last_prompt and last_prompt not in ("clear", "exit"):
            result["last_session_file"] = jsonl_file.name
            result["last_prompt"] = last_prompt
            result["last_response"] = last_response
            result["stop_reason"] = "rate_limit" if is_rate_limited else stop_reason
            result["last_timestamp"] = last_timestamp
            break

    # Memory
    memory_dir = project_dir / "memory"
    if memory_dir.exists():
        memory_index = memory_dir / "MEMORY.md"
        if memory_index.exists():
            result["memory_entries"] = [
                f.stem for f in memory_dir.glob("*.md") if f.name != "MEMORY.md"
            ]
        else:
            result["memory_entries"] = []

    # Plans
    plans_dir = home / ".claude" / "plans"
    if plans_dir.exists():
        plans = []
        for plan in sorted(plans_dir.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True):
            # Read first line to get the title
            try:
                with open(plan) as f:
                    title_line = f.readline().strip().lstrip("# ")
                plans.append({"file": plan.name, "title": title_line})
            except Exception:
                plans.append({"file": plan.name, "title": "?"})
        result["plans"] = plans[:5]  # Top 5 most recent

    # Global state
    claude_json = home / ".claude.json"
    if claude_json.exists():
        try:
            with open(claude_json) as f:
                data = json.load(f)
            proj = data.get("projects", {}).get(project_path, {})
            if proj:
                result["model"] = list(proj.get("lastModelUsage", {}).keys())
                result["cost_usd"] = proj.get("lastCost")
                result["last_session_id"] = proj.get("lastSessionId")
        except Exception:
            pass

    return result


def scan_codex(project_path: str) -> dict:
    """Scan Codex CLI state.

    Reads:
        - ~/.codex/config.toml (model, trust levels)
        - ~/.codex/history.jsonl (command history)
        - ~/.codex/sessions/YYYY/MM/DD/ (session rollouts - by date, not project)

    Gotchas:
        - Guardian subagent messages look like USER: but are risk assessments
        - SQLite files can be 80MB+ — we skip them and use history.jsonl
    """
    home = get_home()
    codex_dir = home / ".codex"
    result = {"found": False}

    if not codex_dir.exists():
        return result

    result["found"] = True

    # Config
    config_path = codex_dir / "config.toml"
    if config_path.exists():
        try:
            with open(config_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("model ="):
                        result["config_model"] = line.split("=", 1)[1].strip().strip('"')
                    elif line.startswith("model_reasoning_effort"):
                        result["reasoning_effort"] = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass

    # History (last 10 entries)
    history_path = codex_dir / "history.jsonl"
    if history_path.exists():
        lines = read_tail(str(history_path), 10)
        result["history_lines"] = len(lines)
        recent_prompts = []
        for line in lines:
            try:
                obj = json.loads(line)
                prompt = obj.get("prompt", obj.get("text", obj.get("input", "")))
                if prompt:
                    recent_prompts.append(prompt[:200])
            except json.JSONDecodeError:
                continue
        result["recent_prompts"] = recent_prompts[-3:]  # Last 3

    # Latest session rollout
    sessions_dir = codex_dir / "sessions"
    if sessions_dir.exists():
        # Find latest date directory
        date_dirs = sorted(sessions_dir.rglob("rollout-*.jsonl"), key=lambda f: f.name, reverse=True)
        if date_dirs:
            latest = date_dirs[0]
            result["latest_rollout"] = str(latest.relative_to(sessions_dir))
            result["latest_rollout_date"] = latest.name.split("rollout-")[1][:10] if "rollout-" in latest.name else None

    # Trust level for this project
    if config_path.exists():
        try:
            with open(config_path) as f:
                content = f.read()
            # Simple TOML parsing for project trust
            # Actual format: [projects."/path"] \n trust_level = "trusted"
            key = f'[projects."{project_path}"]'
            if key in content:
                idx = content.index(key)
                chunk = content[idx:idx+200]
                import re
                match = re.search(r'trust_level\s*=\s*"(\w+)"', chunk)
                if match:
                    result["trust_level"] = match.group(1)
                else:
                    result["trust_level"] = "unknown"
        except Exception:
            pass

    return result


def scan_antigravity(project_path: str) -> dict:
    """Scan Gemini/Antigravity state.

    Reads:
        - ~/.gemini/antigravity/brain/ (per-conversation artifacts)
        - ~/.gemini/antigravity/knowledge/ (curated KIs)
        - ~/.gemini/antigravity/conversations/ (protobuf - existence only)
        - ~/.gemini/history/ (per-project history for project filtering)

    Note: .pb files are binary protobuf — we don't parse them.
    We look for readable artifacts in brain/ directories instead.
    """
    home = get_home()
    gemini_dir = home / ".gemini" / "antigravity"
    result = {"found": False}

    if not gemini_dir.exists():
        return result

    result["found"] = True

    # Try to find project-specific conversation IDs.
    # Gemini maps project paths to slugs in ~/.gemini/projects.json,
    # history dirs use those slugs, but brain dirs use UUIDs.
    # Strategy: path -> slug -> history dir -> conversation IDs from history.
    project_convo_ids = set()
    projects_json = home / ".gemini" / "projects.json"
    history_dir = home / ".gemini" / "history"

    if projects_json.exists() and history_dir.exists():
        try:
            with open(projects_json) as f:
                proj_data = json.load(f)
            # proj_data["projects"] maps path -> slug
            projects_map = proj_data.get("projects", proj_data)
            slug = None
            real_project = os.path.realpath(project_path)
            for path, s in projects_map.items():
                if os.path.realpath(path) == real_project:
                    slug = s
                    break

            if slug:
                # The history dir named by slug may contain conversation refs
                slug_dir = history_dir / slug
                if slug_dir.exists():
                    # Look for conversation log files or subdirs
                    for item in slug_dir.iterdir():
                        if item.is_dir() or item.suffix in ('.jsonl', '.json'):
                            project_convo_ids.add(item.stem)
        except Exception:
            pass

    # Fallback: check history dirs for .project_root files
    if not project_convo_ids and history_dir and history_dir.exists():
        for hist_entry in history_dir.iterdir():
            if hist_entry.is_dir():
                project_root_file = hist_entry / ".project_root"
                if project_root_file.exists():
                    try:
                        with open(project_root_file) as f:
                            root = f.read().strip()
                        if os.path.realpath(root) == os.path.realpath(project_path):
                            # This slug matches our project — mark it
                            result["gemini_project_slug"] = hist_entry.name
                    except Exception:
                        pass

    # Brain — find latest conversation dir, preferring project-matched ones
    brain_dir = gemini_dir / "brain"
    if brain_dir.exists():
        convo_dirs = sorted(
            [d for d in brain_dir.iterdir() if d.is_dir()],
            key=lambda d: d.stat().st_mtime,
            reverse=True
        )

        # Prefer project-matched conversations if we found any
        if project_convo_ids:
            matched = [d for d in convo_dirs if d.name in project_convo_ids]
            if matched:
                convo_dirs = matched

        if convo_dirs:
            latest = convo_dirs[0]
            result["last_conversation"] = latest.name
            result["project_matched"] = latest.name in project_convo_ids if project_convo_ids else False

            # Check for readable artifacts
            artifacts = {}
            for artifact_name in ["task.md", "implementation_plan.md", "walkthrough.md", "overview.txt"]:
                sys_dir = latest / ".system_generated" / "logs"
                artifact_path = latest / artifact_name
                if artifact_path.exists():
                    try:
                        with open(artifact_path) as f:
                            first_lines = f.readline().strip()
                        artifacts[artifact_name] = first_lines[:200]
                    except Exception:
                        artifacts[artifact_name] = "(exists)"

                # Also check for overview in .system_generated/logs
                overview = sys_dir / "overview.txt" if sys_dir.exists() else None
                if overview and overview.exists() and "overview.txt" not in artifacts:
                    lines = read_tail(str(overview), 5)
                    artifacts["overview.txt"] = " | ".join(lines)[:300]

            result["artifacts"] = artifacts

    # Knowledge items
    knowledge_dir = gemini_dir / "knowledge"
    if knowledge_dir.exists():
        ki_dirs = [d for d in knowledge_dir.iterdir() if d.is_dir()]
        result["knowledge_item_count"] = len(ki_dirs)
        # Include KI names for context
        result["knowledge_items"] = [d.name for d in ki_dirs[:10]]

    # Conversation count
    convo_dir = gemini_dir / "conversations"
    if convo_dir.exists():
        result["conversation_count"] = len(list(convo_dir.glob("*.pb")))

    return result


def scan_aider(project_path: str) -> dict:
    """Scan Aider state.

    Aider stores most state in-project, not globally:
        - .aider.chat.history.md (conversation log — in project root)
        - .aider.tags.cache.v3/ (code index — in project root)
        - ~/.aider/ (global analytics only)
    """
    result = {"found": False}

    # Check project-local state
    history = Path(project_path) / ".aider.chat.history.md"
    if history.exists():
        result["found"] = True
        lines = read_tail(str(history), 20)
        result["recent_history"] = "\n".join(lines)[:500]

    # Check global
    global_dir = get_home() / ".aider"
    if global_dir.exists():
        result["global_exists"] = True

    return result


def scan_augment(project_path: str) -> dict:
    """Scan Augment state.

    Augment stores minimal local state:
        - ~/.augment/skills/ (installed skills)
        - ~/.augment/rules/ (custom rules)
        - ~/.augment/commands/ (custom commands)
    """
    home = get_home()
    augment_dir = home / ".augment"
    result = {"found": False}

    if not augment_dir.exists():
        return result

    result["found"] = True
    for subdir in ["skills", "rules", "commands"]:
        d = augment_dir / subdir
        if d.exists():
            items = list(d.iterdir())
            result[subdir] = [i.name for i in items] if items else []

    return result


def scan_unknown_agents() -> list[str]:
    """Scan for any unrecognized agent config directories in ~/."""
    home = get_home()
    known = {
        ".claude", ".codex", ".gemini", ".aider", ".augment",
        ".cache", ".config", ".local", ".ssh", ".git", ".gitconfig",
        ".npm", ".nvm", ".bash_history", ".bashrc", ".profile",
        ".bash_logout", ".sudo_as_admin_successful", ".lesshst",
        ".wget-hsts", ".docker", ".gradle", ".pm2", ".pki",
        ".hawtjni", ".redhat", ".camoufox", ".camoufox-sessions",
        ".supabase", ".ngrok", ".antigravity-server",
    }

    agent_candidates = []
    for item in home.iterdir():
        if item.name.startswith(".") and item.is_dir() and item.name not in known:
            # Check if it looks like an agent (has config, history, or session files)
            hints = list(item.glob("*.json")) + list(item.glob("*.jsonl")) + list(item.glob("*.toml"))
            if hints:
                agent_candidates.append(item.name)

    return agent_candidates


def scan_project_memory(project_path: str) -> dict:
    """Check for project-level memory files."""
    result = {}
    project = Path(project_path)

    for filename in ["CONTEXT.md", "DECISIONS.md", "STACK.md"]:
        # Check root first, then memory/
        for location in [project / filename, project / "memory" / filename]:
            if location.exists():
                result[filename] = {
                    "path": str(location),
                    "exists": True,
                    "last_modified": datetime.fromtimestamp(
                        location.stat().st_mtime
                    ).isoformat()
                }
                # Read first few lines for summary
                try:
                    with open(location) as f:
                        lines = [f.readline() for _ in range(5)]
                    result[filename]["preview"] = "".join(lines).strip()[:200]
                except Exception:
                    pass
                break
        else:
            result[filename] = {"exists": False}

    return result


def main():
    """Main entry point. Accepts project path as argument."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: scan_agent_state.py <project-path>"}))
        sys.exit(1)

    project_path = os.path.realpath(sys.argv[1])

    output = {
        "project": project_path,
        "scanned_at": datetime.now().isoformat(),
        "agents": {
            "claude_code": scan_claude_code(project_path),
            "codex": scan_codex(project_path),
            "antigravity": scan_antigravity(project_path),
            "aider": scan_aider(project_path),
            "augment": scan_augment(project_path),
        },
        "unknown_agents": scan_unknown_agents(),
        "project_memory": scan_project_memory(project_path),
    }

    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
