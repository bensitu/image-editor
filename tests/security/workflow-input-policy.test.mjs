import assert from 'node:assert/strict';
import test from 'node:test';

import { findUnsafeWorkflowRunInputs } from '../../scripts/workflow-input-policy.mjs';

test('workflow input policy rejects dispatch expressions embedded in shell source', () => {
    const maliciousWorkflow = `
jobs:
  release:
    steps:
      - run: echo "\${{ inputs.version }}"
      - run: |
          VERSION="\${{ github.event.inputs.version }}"
          npm publish --tag "\${{ inputs.npm_tag }}"
      - run: >-
          node publish.mjs "\${{ inputs.npm_tag }}"
`;

    assert.deepEqual(
        findUnsafeWorkflowRunInputs(maliciousWorkflow).map(({ expression, line }) => ({
            expression,
            line,
        })),
        [
            { expression: '${{ inputs.version }}', line: 5 },
            { expression: '${{ github.event.inputs.version }}', line: 7 },
            { expression: '${{ inputs.npm_tag }}', line: 8 },
            { expression: '${{ inputs.npm_tag }}', line: 10 },
        ],
    );
});

test('workflow input policy permits expressions in declarative fields and shell environment reads', () => {
    const safeWorkflow = `
concurrency:
  group: release-\${{ inputs.version }}
jobs:
  release:
    if: \${{ inputs.version != '' }}
    steps:
      - env:
          INPUT_VERSION: \${{ inputs.version }}
        with:
          label: \${{ github.event.inputs.version }}
        run: |
          VERSION="\${INPUT_VERSION}"
          echo "\${VERSION}"
`;

    assert.deepEqual(findUnsafeWorkflowRunInputs(safeWorkflow), []);
});
