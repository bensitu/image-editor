# AUD-011 Performance Baseline

This report records the evidence-only performance pass requested by AUD-011. No production
optimization was made, so every `after` value is `N/A` rather than a fabricated comparison.

## Environment and method

- Command: `npm run benchmark:audit-hotspots`
- Recorded: 2026-07-29T07:39:37.008Z
- Platform: Windows x64, Node v24.16.0, V8 13.6.233.17-node.49, 20 logical CPUs
- Clock: `performance.now()`
- Percentiles: nearest-rank median and p95
- Memory: `heapUsed` delta around each operation after a forced pre-run GC
- Snapshot payload size: total bytes distributed across all slices, not bytes per slice
- Source state: the post-AUD-005 baseline before any AUD-011 production change

Timing and heap figures are process-local diagnostic evidence, not cross-machine release budgets.
Small sample counts on the 5,000-mask transaction cases limit their statistical precision.

## A. Mask traversal

Fixture-retained heap was 194,352 bytes at 10 masks, 1,612,888 at 100, 16,026,048 at
1,000, and 80,373,136 at 5,000.

| Scenario                | Masks | Iterations | Before median (ms) | Before p95 (ms) | Before median heap delta (bytes) | After |
| ----------------------- | ----: | ---------: | -----------------: | --------------: | -------------------------------: | ----- |
| `getAll`                |    10 |         40 |              0.063 |           0.089 |                            3,056 | N/A   |
| selection change        |    10 |         20 |              0.184 |           0.343 |                           23,824 | N/A   |
| callback dispatch       |    10 |         40 |              0.052 |           0.071 |                            3,000 | N/A   |
| create transaction      |    10 |          5 |              2.850 |          11.182 |                        1,444,688 | N/A   |
| `removeAll` transaction |    10 |          5 |              1.118 |           1.361 |                          680,752 | N/A   |
| `getAll`                |   100 |         40 |              0.101 |           0.170 |                           13,712 | N/A   |
| selection change        |   100 |         20 |              0.239 |           0.488 |                           61,216 | N/A   |
| callback dispatch       |   100 |         40 |              0.101 |           0.162 |                           13,816 | N/A   |
| create transaction      |   100 |          5 |             10.369 |          23.762 |                        8,802,776 | N/A   |
| `removeAll` transaction |   100 |          5 |              4.451 |           4.718 |                        3,947,912 | N/A   |
| `getAll`                | 1,000 |         20 |              0.613 |           0.728 |                          131,088 | N/A   |
| selection change        | 1,000 |         10 |              1.557 |           1.688 |                          554,728 | N/A   |
| callback dispatch       | 1,000 |         20 |              0.544 |           0.788 |                          131,096 | N/A   |
| create transaction      | 1,000 |          3 |             93.648 |         228.526 |                        7,305,072 | N/A   |
| `removeAll` transaction | 1,000 |          3 |             44.929 |          52.180 |                       53,055,192 | N/A   |
| `getAll`                | 5,000 |          8 |              2.430 |           3.639 |                          677,088 | N/A   |
| selection change        | 5,000 |          5 |              9.000 |          10.238 |                        2,746,672 | N/A   |
| callback dispatch       | 5,000 |          8 |              2.595 |           3.423 |                          677,280 | N/A   |
| create transaction      | 5,000 |          2 |            404.439 |       1,198.999 |                       48,721,120 | N/A   |
| `removeAll` transaction | 5,000 |          3 |            719.090 |         839.580 |                       26,111,456 | N/A   |

Decision: retain the current Overlay Foundation truth. Traversal itself remains below 3.7 ms p95
at 5,000 masks, and selection synchronization remains below 10.3 ms p95. The extreme transaction
costs are dominated by atomic Memento, persistence, and rollback work; a Mask-side index would not
remove those costs and would create a second persistent-object truth. If thousands of masks become
a supported interactive product target, profile transaction serialization separately before
changing ownership.

## B. Snapshot and state clone

|  Slices | Total payload (KiB) | Scenario          | Iterations | Before median (ms) | Before p95 (ms) | Before median heap delta (bytes) | After |
| ------: | ------------------: | ----------------- | ---------: | -----------------: | --------------: | -------------------------------: | ----- |
|       1 |                   1 | capture           |         12 |              0.085 |           0.179 |                            6,160 | N/A   |
|       1 |                   1 | prepare           |         12 |              0.172 |           0.215 |                           20,272 | N/A   |
|       1 |                   1 | load prepared     |         12 |              0.108 |           0.150 |                           11,128 | N/A   |
|       1 |                 256 | capture           |         12 |              0.208 |           0.333 |                          267,192 | N/A   |
|       1 |                 256 | prepare           |         12 |              1.306 |           2.174 |                          799,776 | N/A   |
|       1 |                 256 | load prepared     |         12 |              0.113 |           0.175 |                            7,040 | N/A   |
|       1 |               1,024 | capture           |          8 |              0.799 |           0.836 |                        1,053,624 | N/A   |
|       1 |               1,024 | prepare           |          8 |              5.094 |           7.127 |                        3,159,072 | N/A   |
|       1 |               1,024 | load prepared     |          8 |              0.108 |           0.247 |                            7,040 | N/A   |
|      10 |                   1 | capture           |         12 |              0.095 |           0.140 |                           23,712 | N/A   |
|      10 |                   1 | prepare           |         12 |              0.195 |           0.304 |                           62,968 | N/A   |
|      10 |                   1 | load prepared     |         12 |              0.108 |           0.130 |                           11,176 | N/A   |
|      10 |                 256 | capture           |         12 |              0.151 |           0.355 |                          291,048 | N/A   |
|      10 |                 256 | prepare           |         12 |              1.269 |           2.550 |                          871,864 | N/A   |
|      10 |                 256 | load prepared     |         12 |              0.113 |           0.166 |                           11,176 | N/A   |
|      10 |               1,024 | capture           |          8 |              0.274 |           0.322 |                        1,262,824 | N/A   |
|      10 |               1,024 | prepare           |          8 |              4.339 |           4.890 |                        3,622,944 | N/A   |
|      10 |               1,024 | load prepared     |          8 |              0.102 |           0.111 |                           11,176 | N/A   |
|      50 |                   1 | capture           |         12 |              0.174 |           0.223 |                          104,640 | N/A   |
|      50 |                   1 | prepare           |         12 |              0.375 |           0.775 |                          275,248 | N/A   |
|      50 |                   1 | load prepared     |         12 |              0.109 |           0.140 |                           28,984 | N/A   |
|      50 |                 256 | capture           |         12 |              0.229 |           0.340 |                          365,880 | N/A   |
|      50 |                 256 | prepare           |         12 |              1.352 |           1.504 |                        1,062,736 | N/A   |
|      50 |                 256 | load prepared     |         12 |              0.116 |           0.254 |                           28,984 | N/A   |
|      50 |               1,024 | capture           |          8 |              0.325 |           0.351 |                        1,186,472 | N/A   |
|      50 |               1,024 | prepare           |          8 |              4.675 |           5.021 |                        3,527,696 | N/A   |
|      50 |               1,024 | load prepared     |          8 |              0.111 |           0.121 |                           28,984 | N/A   |
| Control |               1,024 | `cloneStateValue` |          8 |              0.630 |           0.679 |                        1,052,256 | N/A   |

Decision: retain safe validation, cloning, freezing, stable serialization, and payload limits.
The highest observed p95 was 7.127 ms for preparing a one-slice 1 MiB payload. No unsafe
validation removal or alternate aliasing policy is justified.

## C. History retained-byte estimation

| Scenario            |     Input size | Iterations | Estimated retained bytes | Before median (ms) | Before p95 (ms) | Before median heap delta (bytes) | After |
| ------------------- | -------------: | ---------: | -----------------------: | -----------------: | --------------: | -------------------------------: | ----- |
| ASCII data URL      |          1 MiB |         12 |                1,048,598 |              4.611 |           5.187 |                            6,192 | N/A   |
| ASCII data URL      |          4 MiB |          8 |                4,194,326 |             12.825 |          13.614 |                            6,192 | N/A   |
| ASCII data URL      |         16 MiB |          5 |               16,777,238 |             43.042 |          50.054 |                            6,192 | N/A   |
| Unicode metadata    | 256 KiB source |         12 |                  917,536 |              0.918 |           1.600 |                            1,448 | N/A   |
| shared/cyclic graph |  5,000 entries |         12 |                  314,055 |              2.249 |           4.707 |                        4,116,272 | N/A   |

Decision: retain the generic UTF-8 estimator. The 16 MiB maximum-size ASCII case is visible at
50.054 ms p95, but it allocates almost no transient heap and no product latency budget establishes
it as a release bottleneck. A speculative ASCII branch would add a second string-classification
pass or a large encoder allocation. Revisit only with representative History records and a stated
latency target.

## D. Geometry participant sorting

| Scenario                |          Input size | Iterations | Before median (ms) | Before p95 (ms) | Before median heap delta (bytes) | After |
| ----------------------- | ------------------: | ---------: | -----------------: | --------------: | -------------------------------: | ----- |
| mutation                |       1 participant |         40 |              0.279 |           0.382 |                           34,904 | N/A   |
| mutation                |     10 participants |         40 |              0.263 |           0.315 |                           41,248 | N/A   |
| mutation                |     50 participants |         40 |              0.291 |           0.493 |                           69,800 | N/A   |
| mutation                |    250 participants |         40 |              0.331 |           0.388 |                          213,248 | N/A   |
| register and invalidate |    10 registrations |         10 |              0.044 |           0.068 |                           20,440 | N/A   |
| register and invalidate |   100 registrations |         10 |              0.085 |           0.166 |                          195,800 | N/A   |
| register and invalidate | 1,000 registrations |          5 |              0.583 |           0.862 |                        1,952,728 | N/A   |
| register and invalidate | 5,000 registrations |          5 |              3.607 |           4.133 |                        9,001,752 | N/A   |

Decision: do not cache participant order. Mutation latency did not grow materially even at 250
participants, and typical official plans register far fewer. Cache invalidation would add state and
correctness risk without demonstrated benefit.

## Outcome

AUD-011 is resolved as `BENCHMARKED — NO PRODUCTION CHANGE`. The benchmark remains an explicit
developer command and is not a timing-sensitive CI gate. All safety checks and single-source
ownership boundaries remain intact.
