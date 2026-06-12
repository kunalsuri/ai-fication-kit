---
name: Stack detection problem
about: Report a case where 'orient' detected the wrong build system, language, test command, etc.
title: '[DETECTION] Incorrect stack detection on <marker file name>'
labels: detection, bug
assignees: ''

---

**What went wrong?**
A description of what `orient` detected versus what the actual stack of the project is.

**Project structure info:**
- What are the build configuration files at the root of your project? (e.g. `package.json`, `pom.xml`, `pyproject.toml`)
- What language(s) and framework(s) does your project use?
- What are the correct build and test commands for your project?

**Detected Output (`ai/repo-profile.json` contents or console printout):**
```json
<Paste the contents of ai/repo-profile.json or the CLI console printout here>
```

**Expected Detection Output:**
- Detected Languages:
- Detected Build System:
- Detected Build Command:
- Detected Test Command:

**Environment (please complete the following information):**
- OS: [e.g. Windows, macOS, Ubuntu]
- Node version: [e.g. 18.20.0, 20.9.0] or Python version: [e.g. 3.10.12]
- `ai-fication-kit` version: [e.g. 0.1.0]

**Additional context**
Add any other details about the codebase structure or workspace type (e.g. monorepo, git submodules).
