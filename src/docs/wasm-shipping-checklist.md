---
title: 'Checklist for staging and shipping of WebAssembly features'
description: 'This document provides checklists of engineering requirements on when to stage and ship a WebAssembly feature in V8.'
---
This document provides checklists of engineering requirements for staging and shipping WebAssembly features in V8. These checklists are meant as a guideline and may not be applicable to all features. The actual launch process is described in the [V8 Launch process](https://v8.dev/docs/feature-launch-process).

# Staging

## When to stage a WebAssembly feature

The [staging](https://docs.google.com/document/d/1ZgyNx7iLtRByBtbYi1GssWGefXXciLeADZBR_FxG-hE) of a WebAssembly feature defines the end of its implementation phase. The implementation phase is finished when the following checklist is done:

- The implementation in V8 is complete. This includes:
    - Implementation in TurboFan (if applicable)
    - Implementation in Liftoff (if applicable)
    - Implementation in the interpreter (if applicable)
- Tests in V8 are available
- Spec tests are rolled into V8 by running [`tools/wasm/update-wasm-spec-tests.sh`](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh)
- All existing proposal spec tests pass. Missing spec tests are unfortunate but should not block staging.

Note that the stage of the feature proposal in the standardization process does not matter for staging the feature in V8. The proposal should, however, be mostly stable.

## How to stage a WebAssembly feature

- In [`src/wasm/wasm-feature-flags.h`](https://cs.chromium.org/chromium/src/v8/src/wasm/wasm-feature-flags.h), move the feature flag from the `FOREACH_WASM_EXPERIMENTAL_FEATURE_FLAG` macro list to the `FOREACH_WASM_STAGING_FEATURE_FLAG` macro list.
- In [`tools/wasm/update-wasm-spec-tests.sh`](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh), add the proposal repository name to the `repos` list of repositories.
- Run [`tools/wasm/update-wasm-spec-tests.sh`](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh) to create and upload the spec tests of the new proposal.
- In [`test/wasm-spec-tests/testcfg.py`](https://cs.chromium.org/chromium/src/v8/test/wasm-spec-tests/testcfg.py), add the proposal repository name and the feature flag to the `proposal_flags` list.
- In [`test/wasm-js/testcfg.py`](https://cs.chromium.org/chromium/src/v8/test/wasm-js/testcfg.py), add the proposal repository name and the feature flag to the `proposal_flags` list.

See the [staging of type reflection](https://crrev.com/c/1771791) as a reference.

# Shipping

## When is a WebAssembly feature ready to be shipped

- The [V8 Launch process](https://v8.dev/docs/feature-launch-process) is satisfied.
- The implementation is covered by a fuzzer (if applicable).
- The feature has been staged for several weeks to get fuzzer coverage.
- The feature proposal is [stage 4](https://github.com/WebAssembly/proposals).
- All [spec tests](https://github.com/WebAssembly/spec/tree/master/test) pass.
- The [Chromium DevTools checklist for new WebAssembly features](https://docs.google.com/document/d/1WbL-fGuLbbNr5-n_nRGo_ILqZFnh5ZjRSUcDTT3yI8s/preview) is satisfied.

## How to ship a WebAssembly Feature

- In [`src/wasm/wasm-feature-flags.h`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/wasm/wasm-feature-flags.h), move the feature flag from the `FOREACH_WASM_STAGING_FEATURE_FLAG` macro list to the `FOREACH_WASM_SHIPPED_FEATURE_FLAG` macro list.
    - Ensure to add a blink CQ bot on the CL to check for [blink web test](https://v8.dev/docs/blink-layout-tests) failures caused by enabling the feature (add this line to the footer of the CL description: `Cq-Include-Trybots: luci.v8.try:v8_linux_blink_rel`).
- Additionally, enable the feature by default by changing the third parameter in `FOREACH_WASM_SHIPPED_FEATURE_FLAG` to `true`.
- Set a reminder to remove the feature flag after two milestones.
