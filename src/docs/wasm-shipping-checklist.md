---
title: 'Checklist for Staging and Shipping of WebAssembly features'
description: 'This document provides checklists of engineering requirements on when to stage and ship a WebAssembly feature in V8.'
---
This document should provide checklists of engineering requirements on when to
stage and when to ship a WebAssembly feature in V8. These checklists are meant
as a guideline and may not be applicable to all features. The actual launch
process is described in the [V8 Launch process](https://v8.dev/docs/feature-launch-process).

## Staging { #staging }

### When to stage a WebAssembly Feature { #when-to-stage }

The [staging](https://docs.google.com/document/d/1ZgyNx7iLtRByBtbYi1GssWGefXXciLeADZBR_FxG-hE) of a WebAssembly feature defines the end of its implementation phase. The implementation phase is finished when the following checklist is done:
* The implementation in V8 is complete. This includes:
  * Implementation in TurboFan (if applicable)
  * Implementation in Liftoff (if applicable)
  * Implementation in the interpreter (if applicable)
* Tests in V8 are available
* Spec tests are rolled into V8 by running [./tools/wasm/update-wasm-spec-tests.sh](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh)
* Pass all existing proposal spec tests (It would be better if spec tests existed. However, missing spec tests should not be a blocker.)

Note that the stage of the feature proposal in the standardization process does not matter for staging the feature in V8. The proposal should, however, be mostly stable.

### How to stage a WebAssembly Feature { #how-to-stage }

* In [src/wasm/wasm-feature-flags.h](https://cs.chromium.org/chromium/src/v8/src/wasm/wasm-feature-flags.h), move the feature flag from the `FOREACH_WASM_EXPERIMENTAL_FEATURE_FLAG` macro list to the `FOREACH_WASM_STAGING_FEATURE_FLAG` macro list.
In [tools/wasm/update-wasm-spec-tests.sh](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh), add the proposal repository name to the repos list of repositories.
Run [tools/wasm/update-wasm-spec-tests.sh](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh) to create and upload the spec tests of the new proposal.
In [test/wasm-spec-tests/testcfg.py](https://cs.chromium.org/chromium/src/v8/test/wasm-spec-tests/testcfg.py), add the proposal repository name and the feature flag to the `proposal_flags` list.
In [test/wasm-js/testcfg.py](https://cs.chromium.org/chromium/src/v8/test/wasm-js/testcfg.py), add the proposal repository name and the feature flag to the `proposal_flags` list.

See the [staging of type reflection](https://crrev.com/c/1771791) as a reference: .

## Shipping { #shipping }

### When is a WebAssembly ready to be shipped { #when-to-ship }

* The [V8 Launch process](https://v8.dev/docs/feature-launch-process) is satisfied.
* The feature has been staged for several weeks to get fuzzer coverage.
* The feature proposal is [stage 4](https://github.com/WebAssembly/proposals).
* All [spec tests](https://github.com/WebAssembly/spec/tree/master/test).
* The implementation is covered by a fuzzer (if applicable).
