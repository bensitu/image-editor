# Accessibility

## Scope and goals

Image Editor is a JavaScript and TypeScript library with optional controls,
examples, and documentation. Applications supply their own interface around the
canvas. Accessibility depends on the library, the chosen plugins, and that
application interface working together.

Our accessibility goal is to improve access to editing workflows and documentation
using [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) as a reference for design
and review. This is a goal, not a claim that the library, examples, or applications
built with it currently conform to WCAG. We do not currently publish a formal
accessibility audit or a verified browser and assistive technology compatibility
matrix.

## Current capabilities and known barriers

- The optional DOM Controls plugin binds application-provided HTML controls to
  editor actions. Applications remain responsible for accessible names, labels,
  focus management, and feedback.
- Keyboard shortcuts are opt-in through the DOM Controls `keyboard` option.
  Configured plugins can provide undo, redo, session cancellation, and removal of
  selected unlocked overlays. Editable fields are excluded by default. See
  [DOM Controls keyboard actions](docs/plugins/dom-controls.md#keyboard-actions)
  for the required bindings and shortcut behavior.
- These shortcuts do not provide a complete keyboard editing workflow. Spatial
  tasks such as drawing, cropping, and manipulating canvas objects can still
  require pointer input unless the application supplies equivalent controls.
- Canvas graphics do not by themselves provide a semantic representation of the
  image, selection, annotations, or editing state for screen readers. Applications
  need meaningful descriptions and DOM-based alternatives where appropriate.
- Examples demonstrate integration and are not a verified accessible reference
  interface. Third-party plugins and host applications require their own review.

## Guidance for applications and contributions

When building or changing an interface:

- Use native buttons, inputs, headings, and landmarks where possible. Provide
  visible labels and accessible names, including for icon-only controls.
- Make controls operable by keyboard with a logical focus order, visible focus,
  and a way to leave every interaction. Avoid overriding browser or assistive
  technology shortcuts unnecessarily; scope editor shortcuts to the relevant UI.
- Provide alternatives to pointer-only gestures, such as numeric position and
  size inputs or DOM-based object lists where the editing task permits them.
- Present selection, progress, errors, and important state changes in text.
  Announce relevant updates without moving focus unexpectedly or flooding live
  regions.
- Use sufficient contrast, avoid relying on color alone, and preserve usability
  when text is enlarged or the page is zoomed. Respect reduced-motion preferences
  when adding animation.
- Provide meaningful text alternatives for images and documentation examples,
  without exposing private or redacted content through labels or descriptions.

For UI changes, manually check keyboard navigation, focus, zoom, and a relevant
screen reader and browser combination. Automated checks can help find issues but
do not replace manual assessment. Include the environment and checks performed
in the pull request; do not describe untested combinations as supported.

## Reporting an accessibility barrier

Open a [GitHub issue](https://github.com/bensitu/image-editor/issues) with
**[Accessibility]** in the title. If GitHub's issue form is itself a barrier, or
if the report contains private information, email the project maintainer at
[sito163@163.com](mailto:sito163@163.com) with the subject **Image Editor
Accessibility**.

Where possible, include:

- The package version, example or page URL, and task you were trying to complete.
- Steps to reproduce, the barrier encountered, and the expected behavior.
- Browser, operating system, assistive technology, and their versions.
- Relevant keyboard, zoom, contrast, or other settings and any useful workaround.

You do not need to disclose a disability or provide medical information. Remove
personal data and private images from public reports. Reports that describe a
software vulnerability should follow [Security Policy](SECURITY.md).

## Ownership and follow-up

Project maintainers review accessibility reports and contributions. Reports are
prioritized by impact, available workarounds, and maintainer capacity. Follow-up
and remediation are on a best-effort basis without a guaranteed response or fix
date. This page should be updated when capabilities, known barriers, or reporting
channels change.
