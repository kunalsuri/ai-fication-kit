<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# System Engineering Diagrams

This document contains Mermaid-based system engineering diagrams to help developers quickly understand the operations, components, interactions, and lifecycles in the **ai-fication-kit**.

---

## 1. Use Case Diagram

The Use Case diagram outlines how a developer or automated process (like CI) interacts with the system using different CLI commands, and how the `shazam` one-shot command integrates orient, intake, and install steps.

```mermaid
graph LR
    subgraph Actors
        Dev["Developer (Operator / CI)"]
    end

    subgraph Use Cases
        UC1(["Orient Project Stack<br/>(node install.mjs orient)"])
        UC2(["Interactive Onboarding Wizard<br/>(lib/intake)"])
        UC3(["Stamp Templates into Target<br/>(node install.mjs install)"])
        UC4(["Clean Uninstall of Files<br/>(node install.mjs uninstall)"])
        UC5(["Verify Doc Path Claims<br/>(node install.mjs verify)"])
        UC6(["One-Shot Setup<br/>(node install.mjs shazam)"])
    end

    Dev --> UC1
    Dev --> UC2
    Dev --> UC3
    Dev --> UC4
    Dev --> UC5
    Dev --> UC6

    UC6 -.->|includes| UC1
    UC6 -.->|includes| UC2
    UC6 -.->|includes| UC3
```

---

## 2. Class / Module Diagram

The Class/Module diagram represents the layout of the code modules, the data schemas passed between them, and the logical dependencies of the Node.js and Python runtimes.

```mermaid
classDiagram
    class CLIWrapper {
        <<install.mjs / install.py>>
        +String command
        +String targetPath
        +Object flags
        +main()
    }
    class Util {
        <<lib/util>>
        +String KIT_VERSION
        +String PROFILE_REL
        +String MANIFEST_REL
        +die(msg)
        +confirm(question, flags)
        +ask(question, flags, fallback)
        +choose(question, options, flags, defaultIndex)
    }
    class Orient {
        <<lib/orient>>
        +Array DETECTORS
        +detectFork(targetAbs, flags)
        +detectDescription(targetAbs, flags)
        +orient(targetAbs, flags)
        +printProfile(profile)
    }
    class Intake {
        <<lib/intake>>
        +runFirstRunWizard(targetAbs, profile, flags)
        +detectBranch(targetAbs)
    }
    class Installer {
        <<lib/installer>>
        +install(targetAbs, profile, flags)
        +uninstall(targetAbs, flags)
        +placeholders(profile)
        +stamp(text, vars)
    }
    class Verify {
        <<lib/verify>>
        +verify(targetAbs, flags)
        +extractClaims(text, sourceFile)
        +buildFileIndex(root)
    }

    CLIWrapper --> Util : uses
    CLIWrapper --> Orient : calls
    CLIWrapper --> Intake : calls
    CLIWrapper --> Installer : calls
    CLIWrapper --> Verify : calls

    Orient ..> Util : uses
    Intake ..> Util : uses
    Installer ..> Util : uses
    Verify ..> Util : uses
```

---

## 3. Sequence Diagram (`shazam` workflow)

The Sequence diagram traces the step-by-step control flow and interactions between modules when running the interactive `shazam` setup.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (Operator)
    participant CLI as install.mjs / install.py (CLI)
    participant ORI as lib/orient
    participant INT as lib/intake (Wizard)
    participant INS as lib/installer
    participant FS as Target File System

    Dev->>CLI: node install.mjs shazam <path>
    CLI->>ORI: orient(<path>)
    ORI->>FS: Probe files (package.json, pyproject.toml, etc.)
    FS-->>ORI: Exists / Content details
    ORI-->>CLI: Return profile data
    CLI->>CLI: printProfile(profile)
    
    alt is Interactive (TTY) and not --yes
        CLI->>INT: runFirstRunWizard(<path>, profile)
        INT->>Dev: Prompt Dev: Skill level & familiarity
        Dev-->>INT: Answers
        INT->>FS: Inspect .git/HEAD for branch name
        FS-->>INT: Branch (e.g. main/master)
        INT->>Dev: Warn if default branch, prompt to continue
        Dev-->>INT: Confirm / Abort
        INT->>Dev: Prompt structure confirmation
        Dev-->>INT: Single stack / Split stack answers
        INT-->>CLI: Return humanContext
        CLI->>CLI: Merge humanContext into profile
    else Non-Interactive or --yes
        Note over CLI: Skip Wizard (humanContext = null)
    end

    CLI->>INS: install(<path>, profile, flags)
    INS->>FS: Read templates/
    FS-->>INS: Template contents
    INS->>CLI: Print planned writes / skips
    CLI->>Dev: Confirm write? (if not --yes)
    Dev-->>CLI: Yes
    INS->>FS: Write stamped files & ai/repo-profile.json
    INS->>FS: Write ai/install-manifest.json
    INS-->>CLI: Complete
    CLI->>Dev: Print Next Steps
```
---
