# docs/ — guides, report, diagrams, talks

Available now:
- [AUDIT-GUIDE.md](AUDIT-GUIDE.md) — how to do the 30-minute human audit (the step the method hinges on).
- [FAQ.md](FAQ.md) — troubleshooting: misdetection, monorepos, re-runs, non-Claude tools.
- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) — maintainer release procedure.
- [AI-fication-Kit-TR-2026-01.md](AI-fication-Kit-TR-2026-01.md) — the technical report (method, reference implementation, contribution statement, implemented-vs-designed table). Markdown source of record; build the PDF with [`build-report.sh`](build-report.sh) (`pandoc` + a PDF engine).

Reserved for the project's public materials:
- `AI-fication-Kit-TR-2026-01.pdf` — the report rendered to PDF, attached to the GitHub/Zenodo release. Generated on demand from the Markdown above; not checked into the repo.
- `diagrams/` — method figures used in the report and talks.
- Video walkthrough: linked from the README when published (hosted externally; Zenodo record keeps the link, not the file).
