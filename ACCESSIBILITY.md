# Accessibility

## Our approach

Image Editor provides a canvas editing library, optional DOM controls, examples,
and documentation. Applications build their own interface around it. An accessible
editing workflow requires both usable library features and an accessible host
interface.

[WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) guides accessibility improvements
to the interface and documentation. Conformance has not been established. The
project does not currently publish a formal accessibility audit or a verified
browser and assistive technology compatibility matrix.

## Available controls

The optional DOM Controls plugin binds HTML controls supplied by the application
to editor actions. Keyboard shortcuts are enabled only when the application
provides the `keyboard` option and the corresponding plugin bindings.

| Action                            | Shortcut                           | Required configuration                      |
| --------------------------------- | ---------------------------------- | ------------------------------------------- |
| Undo                              | `Ctrl/Cmd+Z`                       | History binding with an available undo step |
| Redo                              | `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` | History binding with an available redo step |
| Cancel an editing session         | `Escape`                           | A configured tool with an active session    |
| Remove selected unlocked overlays | `Delete` or `Backspace`            | `keyboard.overlays` binding                 |

Editable fields are excluded by default. Applications can disable action groups
and scope shortcuts to a particular element. See
[DOM Controls keyboard actions](docs/plugins/dom-controls.md#keyboard-actions)
for configuration and behavior.

## Known limitations

- Keyboard shortcuts cover only the actions above. Drawing, cropping, selection,
  and spatial manipulation may still require pointer input unless the application
  provides alternatives.
- Canvas content does not automatically expose a meaningful image description,
  object list, selection, or editing status to screen readers.
- Accessible names, focus handling, status announcements, and the accessibility
  of application controls remain the host application's responsibility.
- Examples demonstrate integration; they are not verified accessible reference
  interfaces. Third-party plugins also need their own assessment.

## Building and reviewing an interface

Applications and UI contributions should address the following:

- **Semantics:** use native controls and visible labels; give icon-only controls
  accessible names and images meaningful text alternatives.
- **Keyboard and focus:** provide a logical focus order, visible focus, and a way
  to leave each interaction. Keep editor shortcuts from interfering with unrelated
  controls or browser and assistive technology commands.
- **Editing alternatives:** offer DOM-based selection and property controls where
  possible, such as an object list or numeric position and size inputs.
- **Feedback:** communicate selection, progress, errors, and state changes in text.
  Announce important updates without unexpectedly moving focus or overwhelming
  screen reader users.
- **Presentation:** preserve contrast, zoom, and enlarged-text usability. Do not
  rely on color alone, and respect reduced-motion preferences for animation.
- **Privacy:** keep sensitive image content out of accessible descriptions, object
  names, and other alternatives when that content should be redacted.

For UI changes, check the affected task using only the keyboard, with page zoom
or enlarged text, and with a relevant screen reader and browser combination.
Record the environment, results, and remaining barriers in the pull request.
Automated checks complement these manual checks; they do not establish full
accessibility or support for untested environments.

## Reporting an accessibility barrier

Open an
[accessibility issue](https://github.com/bensitu/image-editor/issues/new?title=%5BAccessibility%5D%20).
A short description of the task and barrier is enough to start; a code fix or
technical diagnosis is not required. If submitting an issue is a barrier, someone
you trust may report it on your behalf.

Details that help reproduce the problem include:

- The package version, example or page URL, and task you were trying to complete.
- Steps to reproduce, the barrier encountered, and the expected behavior.
- Browser, operating system, assistive technology, and their versions.
- Relevant keyboard, zoom, contrast, or other settings and any useful workaround.

Issues are public. Use synthetic examples and omit private images, personal data,
and medical information. If sensitive details are essential, request a private
reporting channel without posting those details, and wait for one to be arranged.
For a software vulnerability, follow [Security Policy](SECURITY.md).

## Ownership and follow-up

Maintainers review reports by the impact on completing a task, available
workarounds, and capacity to investigate. They may ask for clarification or record
a workaround in the issue. Response and remediation are on a best-effort basis,
without a guaranteed deadline. Changes to capabilities or known barriers should
update this page alongside the relevant code or documentation.
