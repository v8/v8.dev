---
title: 'Implementing and shipping JavaScript/WebAssembly language features'
description: 'This document explains the process for implementing and shipping JavaScript or WebAssembly language features and larger general changes in V8.'
---
In general, V8 follows the [Blink intent process for already-defined consensus-based standards](https://www.chromium.org/blink/launching-features/#process-existing-standard) for JavaScript and WebAssembly language features. V8-specific differences are laid out below. In cases where the text below does not specify differences, the Blink intent process applies.

If you have any questions on this topic, please email [v8-features@chromium.org and v8-dev@googlegroups.com](mailto:v8-features@chromium.org?cc=v8-dev@googlegroups.com).

This document also covers non-language features like larger architectural changes or performance improvements. For these features, many of the steps do not apply (e.g. Chromestatus entries, intent process, TC39/WebAssembly CG proposal process) while others do (launch stages, fuzzing requirements, launch reviews, experimentation). Examples for such features are launches of new compilers/interpreters or major refactorings of critical code.

# Terminology

Throughout this document we will use certain terms in a specific meaning that might differ from what you expect. This is due to overlapping and conflicting definitions in different contexts.

## Features

When we are talking about *features* we usually mean both an observable change to the spec which is following a TC39 or WebAssembly CG proposal or a larger architectural change or optimization that might justify following this process in order to guarantee stability and security for our users.

When specifically talking about proposals, we use the term *spec feature* or *proposal*. When talking specifically about JavaScript or WebAssembly we will use *JavaScript feature* and *WebAssembly feature* respectively.

When specifically talking about complex architectural changes, refactorings and optimizations within V8, we use the term *V8 features*. For these, the proposal process does not apply, but the V8 process does.

For WebAssembly specifically, we also distinguish between *Wasm feature flags* and regular *V8 flags* as these have slightly different implementations in V8. But we also use *V8 flag* in a more generic manner to mean both when the distinction is not required.

## Stages, phases and steps

The TC39 and WebAssembly CG proposal process both define different steps a proposal needs to go through. They mostly overlap in meaning, but they are called "stages" in TC39 and "phases" for WebAssembly. We will use the term *stage/phase* throughout when we are talking about the standardization process.

For the V8 process, we also follow a multi-step process. We will call these *steps* to distinguish them from the proposal process, even though there is obviously some correlation to it too. These are also closely related to the "stages" on [Chromestatus](https://chromestatus.com/)

# Overview

As outlined earlier, a feature can be anything from a visible addition to the JavaScript/WebAssembly API which is driven by a W3C community group proposal to a larger architectural change that improves performance, stability or user experience.

For *spec features*, we always follow this process even if the proposal is comparably small. In that case, field trials can be skipped if there is enough confidence in the design. But all other requirements are mandatory. For *V8 features*, the application of this process depends on the complexity and the risk associated with it. E.g., a simple compiler optimization would not require going through the steps while adding a new compiler all together certainly would. If an optimization can be merged in a few CLs during one milestone development phase, it's small enough to ship directly.

All *features* of this complexity start off behind an experimental flag which enables the *feature* for developers that would like to try it out and provide feedback and allows us to test the feature in a limited capacity. As these *features* require explicit command line arguments, we don't expect users to enable them and if they do, it's at their own risk.

Once we consider a *feature* sufficiently stable that we consider experimentation or even shipping, we pre-stage it. This enables the feature on our fuzzers, test and benchmarking infrastructure and allows us to detect issues early on. Once it has shown to be sufficiently stable (usually after ~2 weeks without major incidents), we stage it, which additionally opens it up to the [Vulnerability Reward Program (VRP)](https://bughunters.google.com/about/rules/5745167867576320/chrome-vulnerability-reward-program-rules) to incentivize external security researchers to test it too and file bugs on it.

Some *features* might ship directly from this phase, if we don't expect to gain any insights from further experimentation. Others will go through one or more *steps* of experimentation, e.g. developer trial, origin trial or Finch trial where we collect data from partners or in-the-wild usage.

An overview over the shipping *steps* together with their respective properties and requirements is shown here:

![Overview of shipping phases](/_svg/launch-process/phases.svg)

The full list of requirements and steps to be taken is listed below.

## Flags { #flags}

We usually define one or more command line flags that guard the *feature* from being active in production environments before it's ready for general use. These flags allow fine-grained control for testing and debugging and can be kept beyond the release of a feature to switch it off when needed. This is mostly not necessary and not worth maintaining the alternative code path, but can sometimes be useful (e.g. we kept the flags for lazy compilation and dynamic tiering).

### *WebAssembly feature flags* vs. *V8 flags*

In WebAssembly, we have the option of using a *WebAssembly feature flag* (`--experimental-wasm-*`) which is defined via a macro in [`src/wasm/wasm-feature-flags.h`](https://cs.chromium.org/chromium/src/v8/src/wasm/wasm-feature-flags.h) (different macros for different phases of development). These flags are usually used for *spec features*, e.g. related to a new WebAssembly proposal.

For JavaScript or general architectural changes or optimizations, one can use a regular *V8 flag* as defined in [`src/flags/flag-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/flags/flag-definitions.h). In early stages, you should use `DEFINE_EXPERIMENTAL_FEATURE()`.

### Flags for (pre-)staging

There are also common flags which bundle multiple experimental flags together through implications. `--experimental-fuzzing` is for enabling experimental features on our fuzzers in the pre-staging phase. JavaScript features can be fuzzed by moving the feature flag to the `JAVASCRIPT_STAGED_FEATURES_BASE` macro in [`src/flags/flag-definitions.h`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/flags/flag-definitions.h). WebAssembly feature flags defined in the `FOREACH_WASM_PRE_STAGING_FEATURE_FLAG` macro are automatically implied by this flag. V8 flags for pre-staged features require an explicit implication in [`src/flags/flag-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/flags/flag-definitions.h).

WebAssembly feature flags also require a use counter to be added (or explicitly disabled this using `kIntentionallyNoUseCounter`). It's generally advisable to add a use counter to track adoption unless there are good reasons against it (e.g. overhead for feature detection). You can pick a `WebFeature` or a `WebDXFeature` for your implementation. If it's linked to a W3C proposal, `WebDXFeature` is recommended. Otherwise, a `WebFeature` can be used which requires no approval process.

For staged features, that are ready for public evaluation (including the VRP) before their launch, we have the `--wasm-staging` flag which implies all WebAssembly feature flags defined in the `FOREACH_WASM_STAGING_FEATURE_FLAG` and covers new functionality about to be launched in the near future. For JavaScript or non-functional features like optimizations, one can add an explicit implication from `--future`. This flag is also used for benchmarking the performance of upcoming V8 versions.

## Chromestatus { #chromestatus }

It is best practice to create a [Chromestatus feature entry](https://chromestatus.com/features) early on, but at latest it needs to exist once the first stage of the intent process is triggered.

### Intent process { #cc }

Intent mails are only required for JavaScript and WebAssembly *spec features* that enable the *feature* for end users without explicitly setting a flag. This covers origin and Finch trials (*intent to experiment*) as well as shipping (*intent to ship*). Other parts of the intent process are optional.

**Every** *intent to `$something`* email (e.g. *intent to implement*) should CC [v8-users@googlegroups.com](mailto:v8-users@googlegroups.com) in addition to [blink-dev@chromium.org](mailto:blink-dev@chromium.org). This way, other embedders of V8 are kept in the loop too.

### Link to the spec repo { #spec }

The Blink intent process requires an explainer. Instead of writing a new doc, feel free to link to the respective spec repository instead (e.g. [`import.meta`](https://github.com/tc39/proposal-import-meta)).

### Review gates

The Blink intent process includes a series of review gates that must be approved on the *spec feature*'s entry in Chromestatus before an *intent to ship* is sent out seeking API OWNER approvals.

These gates are tailored towards web APIs, and some gates may not be applicable to JavaScript and WebAssembly *spec features*. The following is broad guidance. The specifics differ from feature to feature; do not apply guidance blindly!

#### Privacy

Most JavaScript and WebAssembly *features* do not affect privacy. Rarely, *features* may add new fingerprinting vectors that reveal information about a user's operating system or hardware.

### Security

While JavaScript and WebAssembly are common attack vectors in security exploits, most new *features* should be sufficiently well covered through our own V8 launch reviews. [Fuzzing](#fuzzing) is required, and mitigates some of the risk.

*Features* that affect known popular attack vectors, such as `ArrayBuffer`s in JavaScript, and *features* that might enable side-channel attacks, need extra scrutiny and must be reviewed.

#### Enterprise

Throughout their standardization process in TC39 and the WebAssembly CG, JavaScript and WebAssembly *spec features* already undergo heavy backwards compatibility scrutiny. It is exceedingly rare for *features* to be willfully backwards incompatible.

For JavaScript, recently shipped *spec features* can also be disabled via `chrome://flags/#disable-javascript-harmony-shipping`.

#### Debuggability

JavaScript and WebAssembly *features*' debuggability differs significantly from *feature* to *feature*. *JavaScript features* that only add new built-in methods do not need additional debugger support, while *WebAssembly features* that add new capabilities may need significant additional debugger support.

For more details, see the [JavaScript feature debugging checklist](https://docs.google.com/document/d/1_DBgJ9eowJJwZYtY6HdiyrizzWzwXVkG5Kt8s3TccYE/edit#heading=h.u5lyedo73aa9) and the [WebAssembly feature debugging checklist](https://goo.gle/devtools-wasm-checklist).

When in doubt, this gate is applicable.

#### Testing { #tests }

Instead of Web Platform Tests (WPTs), Test262 tests are sufficient for *JavaScript features*, and WebAssembly spec tests are sufficient for *WebAssembly features*. It should be verified that the latest tests are imported, active and passing in the V8 repository.

Adding WPTs is not required, as *JavaScript and WebAssembly features* have their own interoperable test repositories that are run by multiple implementations. Feel free to add some though, if you think it is beneficial.

For *JavaScript features*, explicit correctness tests in [Test262](https://github.com/tc39/test262) are required. Note that tests in the [staging directory](https://github.com/tc39/test262/blob/main/CONTRIBUTING.md#staging) suffice.

For *WebAssembly features*, explicit correctness tests in the [WebAssembly Spec Test repo](https://github.com/WebAssembly/spec/tree/master/test) or the proposal repo are required.

For performance tests, JavaScript already underlies most existing performance benchmarks, like Speedometer and JetStream.

## Fuzzing { #fuzzing }

All *features* must be fuzzed for a minimum period of 4 weeks, with all fuzz bugs fixed, before they can be shipped or enabled in a trial.

## Steps {#steps}

### Inception

This is the *step* in which implementation in V8 is starting, but there might not be a [Chrome feature entry](https://chromestatus.com/features) or even a proper name for the *feature*. Code might be in local branches only or submitted to the main branch, guarded behind a *feature flag*.

As a rule of thumb, V8 waits to implement *JavaScript feature* proposals until they advance to [*stage* 3 or later in TC39](https://tc39.es/process-document/){ #stage3plus }. TC39 has its own consensus process, and *stage* 3 or later signals explicit consensus among TC39 delegates, including all browser vendors, that a feature proposal is ready to implement. This external consensus process means *stage* 3+ *features* do not need to send intent emails other than *intent to ship*.

For *WebAssembly features*, a similar [process for the WebAssembly Community Group](https://github.com/WebAssembly/meetings/blob/main/process/phases.md) exists. Implementation may start already in earlier phases, especially the ones driven by V8. Implementation usually starts in *phase* 1 to 3 of the proposal process.

### Developer trial (optional)

We can optionally ask external partners for feedback on the scope, interface or performance of the feature. During the developer trial, they can only test locally, because enabling the *feature* requires explicitly enabling the *feature flag* via the command line. A developer trial may start before staging and can continue until shipping.

### Pre-staged

The pre-staging phase is enabled by adding the feature flag as an implication to `--experimental-fuzzing`. This step can either happen early in development if there is already fuzzer coverage that would allow us detecting bugs early on or as a prerequisite before opening the *feature* up to the VRP. In either case, there needs to be some fuzzer coverage for this step to have a meaningful impact.

### Staged

After pre-staging is not producing a constant stream of new findings anymore and we believe the *feature* is mature enough, we will move the implication to `--wasm-staging` or `--future` depending on whether it's a *WebAssembly feature flag* or *JavaScript/V8 feature* respectively. This increases coverage on our test and fuzzing infrastructure and will open it for the VRP to encourage external researchers to find issues with the code. During this phase, we usually hold a [V8 launch review](#v8-launch-review) where the development team assesses the test and fuzzer coverage and decides on requirements for the following phases.

### Origin/field trial

If we need more data to decide on the readiness of a *feature*, we can schedule a trial. This can either be an origin trial in tight collaboration with partners or a broader field trial (Finch). Origin trials tend to run for longer than field trials, but complex features might also spend several months in a field trial until they are sufficiently mature.

### Shipped

Once a *feature* is stable, complete and fully spec'd (*stage 4* in the TC39 Community Group or *phase* 4 in the WebAssembly Community Group), we can ship it. This enables the *feature* for all users, even though only a tiny fraction of websites might use it in the beginning. We keep the flag around for 1-2 more milestones to be able to switch the *feature* off in case of unexpected side-effects.

### Clean up

After 1-2 milestones, we can remove the *feature flag*, outdated code and do other clean-up work. For some *features*, it might be worth keeping the flag around to allow easier debugging, A/B comparisons, etc.

# Pre-staging { #pre-staging }

## When to pre-stage a feature

Pre-staging allows getting early feedback from fuzzing and ensuring that there are no obvious bugs left from fuzzing before opening up the *feature* further in staging.

This should happen two weeks before staging at latest to give the fuzzers enough time to find bugs, but can happen as soon as any fuzzer coverage is available and fuzzing can meaningfully test the code, even while the *feature* is still in development.

## How to pre-stage a feature

### Pre-staging a JavaScript or V8 feature

Pre-stage the *feature* to collect fuzzer coverage for at least two weeks, if not pre-staged earlier in feature development.

- In [`src/flags/flag-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/flags/flag-definitions.h) add an implication from `experimental_fuzzing` to the *feature flag* using `DEFINE_WEAK_IMPLICATION()`.

### Pre-staging a WebAssembly feature

Pre-stage the *feature* to collect fuzzer coverage for at least two weeks, if not pre-staged earlier in feature development.

- In [`src/wasm/wasm-feature-flags.h`](https://cs.chromium.org/chromium/src/v8/src/wasm/wasm-feature-flags.h), move the *feature flag* from the `FOREACH_WASM_EXPERIMENTAL_FEATURE_FLAG` macro list to the `FOREACH_WASM_PRE_STAGING_FEATURE_FLAG` macro list.
- In [`tools/wasm/update-wasm-spec-tests.sh`](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh), add the proposal repository name to the `repos` list of repositories.
- Run [`tools/wasm/update-wasm-spec-tests.sh`](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh) to create and upload the spec tests of the new proposal.
- In [`test/wasm-spec-tests/testcfg.py`](https://cs.chromium.org/chromium/src/v8/test/wasm-spec-tests/testcfg.py), add the proposal repository name and the *feature flag* to the `proposal_flags` list.
- In [`test/wasm-js/testcfg.py`](https://cs.chromium.org/chromium/src/v8/test/wasm-js/testcfg.py), add the proposal repository name and the *feature flag* to the `proposal_flags` list.

# Staging { #staging }

## When to stage a feature

The staging of a *feature* defines the end of its implementation phase. The implementation phase is finished when the following checklist is done:

- The implementation in V8 is complete. This includes:
    - Implementation in Turbolev/Turboshaft (if applicable)
    - Implementation in Ignition, Sparkplug and Maglev (if applicable)
    - Implementation in Liftoff (if applicable)
    - Basic fuzzer coverage (if applicable)
- Tests in V8 are available.
- Spec tests are rolled into V8. For JavaScript this is done by ((tbd test262)). For WebAssembly this can be done by running [`tools/wasm/update-wasm-spec-tests.sh`](https://cs.chromium.org/chromium/src/v8/tools/wasm/update-wasm-spec-tests.sh). If Web Platform Tests are available, they should also be rolled into V8.
- All existing proposal spec tests pass. Missing spec tests should be added before entering staging.

Note that the *phase/stage* of the *spec feature* in the standardization process does not matter for staging the *feature* in V8. The proposal should, however, be mostly stable.

## How to stage a feature

To inform the Chrome Security team of the new state, move the tracking issue to the "V8 Feature staged" hotlist. This signals that the *feature* has reached some level of external scrutiny. To link the *feature* to the command line flag, make sure that the corresponding field in the issue is set correctly.

### Staging a JavaScript or V8 feature

After at least two weeks of fuzzer coverage in pre-staging, we can stage the *feature* to open it to the VRP, encouraging external bug reporting.

- Switch the flag definition from `DEFINE_EXPERIMENTAL_FEATURE` to `DEFINE_BOOL` with a `false` default.
- In [`src/flags/flag-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/flags/flag-definitions.h), move the feature flag implication from the `experimental_fuzzing` to `future` (pure performance optimizations) or to `wasm_staging` (other changes). Either implication will continue fuzzing coverage, but an implication from `future` will also enable it for benchmarking which might or might not be desired.

### Staging a WebAssembly feature

After at least two weeks of fuzzer coverage in pre-staging, we can stage the *feature* to open it to the VRP, encouraging external bug reporting.

- In [`src/wasm/wasm-feature-flags.h`](https://cs.chromium.org/chromium/src/v8/src/wasm/wasm-feature-flags.h), move the feature flag from the `FOREACH_WASM_PRE_STAGING_FEATURE_FLAG` macro list to the `FOREACH_WASM_STAGING_FEATURE_FLAG` macro list.

# V8 launch review { #v8-launch-review }

V8 launch reviews are held before a *feature* reaches the general public, i.e. before it either goes into an origin or Finch trial or gets launched. The goal is to ensure that all necessary and useful steps were taken beforehand. Any *spec feature*, but also major refactorings like launching a new compiler phase, qualifies for this process.

The launch review can be held online or offline. The latter is most suitable for smaller *features* which are quite straightforward. But in case of doubt, it might be worth setting up a short meeting to get everyone on the same page and have some time for discussion.

## Launch review doc

To ensure that all relevant information is available for the V8 launch review, some pre-work needs to happen which will mostly be driven by the *feature* owner and the V8 Bug Detection team.

The relevant items are listed in the [launch review template doc](https://docs.google.com/document/d/1hoAt2Se9PO_Uv3xDf8Qhinwc__Rr_mgrHM5FRc7r4Pc/edit?usp=sharing) which can be used either for preparation and documentation of a launch review meeting or to facilitate an offline review.

### Fuzzing coverage report

The V8 Bug Detection team will compile a coverage report from Fuzzilli and other relevant fuzzers. This will be shared with the *feature* owner. They should go over the report and mark each uncovered code as to whether fuzzing coverage is not needed (debug/logging code, experimental aspects not in scope for this launch, etc.) or fuzzing coverage should be added (unexpected lack of coverage, missed aspects). Ideally, any gaps can be resolved before the launch review meeting. Otherwise, action items (what? who? until when?) should be added to the meeting notes.

### Spec coverage report

The *feature* owner should go over the spec text (if available) and go over each change and check if there is sufficient fuzzing and test coverage. If not, coverage should be added before the meeting or added as action items to the launch review.

For WebAssembly, independent of the phase the proposal is in, a draft of the spec changes should be available and covered through spec tests. This ensures that potential issues that arise from integrating the proposal into the existing spec become visible and that spec tests will uncover any discrepancies between the implementation and the spec. If possible, a formal verification of the spec draft should be carried out using the tools available for [SpecTec](https://github.com/Wasm-DSL/spectec/tree/main/spectec).

## Additional dependencies

This is a good moment to clarify if there are any additional dependencies on other Chromium components that need to be made aware of the upcoming changes. One example is debuggability which often requires alignment with the *DevTools* team. If there is a need to make major changes, it can take several months to get them ready and it might block shipping. It's therefore in the *feature* owner's interest to reach out to those teams as early as possible to avoid getting blocked in the shipping approvals.

## V8 launch review meeting

Once the pre-work is completed, a V8 launch review meeting can be set up if a pure offline review is insufficient or ineffecient. Mandatory participants are the feature owner, collaborators and key ICs that can provide feedback on the impact of potential gaps in coverage and at least one member of the V8 Bug Detection team should be present (basically the list of reviewers/contributors to the review doc). It is best practice to invite the whole development team of the *feature* owner (e.g. JavaScript or WebAssembly Runtime) and the whole Bug Detection team to the meeting.

### Feature overview

The *feature* owner will provide a brief overview of the scope of the *feature*, challenges during implementation, spec changes, etc. They will re-iterate the test and fuzzer coverage and potential shortcomings and known gaps. Any unresolved action items should be added to the list. Coverage reports should be linked from the meeting notes.

### Launch/trial plan

The *feature* owner will explain the planned launch/trial *steps* and milestones together with the expected timelines.

### Feedback

An open discussion should then answer open questions and challenge potential gaps in the analysis which might lead to additional action items. These can range from additional tests, adding stress modes and more fuzzing coverage to additional code/spec reviews and static code analysis. Also changes in the launch/trial process can be requested.

### Requirements decision

The group as a whole should reach an agreement on whether the *feature* is sufficiently well tested to be launched or if any of the action items are launch blocking. For each action item it needs to be clearly stated for which *step* they are considered a requirement or if not, if and when they should be completed instead.

## Post work

Shortly after collecting all approvals, the review doc will be shared with [v8-status-updates@](https://teams.googleplex.com/v8-status-updates) for full transparency and documentation.

Before initiating any next step, the *feature* owner should work with the assigned AI owners on completing all respective blocking AIs. They should clearly mark in the meeting notes when an AI is completed. If they deviated from the recommendation, they should communicate the justification and alternative plan clearly.

If needed, additional V8 launch reviews can be held for later *steps* (e.g. before full shipping). But it's also fine to only have one as long as no major deviations from the discussed plans occur.

## TAG review { #tag }

For smaller *JavaScript or WebAssembly features*, a TAG review is not required, as TC39 and the WebAssembly CG already provide significant technical oversight. If the feature is large or cross-cutting (e.g., requires changes to other Web Platform APIs or modifications to Chromium), TAG review is recommended.

# Experimentation (optional) { #experimentation }

There are multiple ways of experimenting with a new feature and gathering information on its stability and viability. The successful completion of the staging *step* ensures that our users are not exposed to experimental code that might be harmful to them. However, full stability is not always guaranteed which is why such experimentation must be executed with great care.

## Developer trial

This is the easiest trial to run. It often does not require any changes to the code, but developers are encouraged to try it out. This can happen via the existing command line flag, by adding a Chrome flag that developers can enable via the `chrome://flags` or by staging a *WebAssembly feature flag* which automatically adds it to the existing *Experimental WebAssembly* option there (`chrome://flags#enable-experimental-webassembly-features`). Because the latter option might be switched on by users accidentally (e.g. because they tried another *feature* earlier and forgot to disable it afterwards), the bar for adding *features* there is higher and one should carefully evaluate if the *feature* meets the criteria for staging before choosing this option.

### Steps to enable a developer trial

- Reach out to partners and collect feedback (direct communication, issues or polls).

## Origin trial

*Features* that web developers want to try out with their own users are ideal for an origin trial. This is often a new proposal that requires feedback from real-world scenarios to evaluate its shape and potential readiness for publication. Developers can set up their own trials where they compare different populations that have the *feature* enabled or disabled. Sometimes, even different versions of a *feature* can be compared against each other.

The feedback can be collected from partners or via Chrome's metric collection. It is usually reported back to the W3C community group and to the Blink API owners.

### Steps to launch an origin trial

To get the experiment going, do the following

- Request all required reviews for experimentation on the Chromestatus entry.
- Send *intent to experiment* (up to 6 months/milestones) to Blink API Owners and get one LGTM.
- Inform the origin trial team and wait for the resolution.
- Inform the Chrome Security Team about the pending experiment by moving the tracking issue to the "V8 Feature in trial" hotlist and linking the origin trial in a comment. Remove the issue from the "V8 Feature staged" hotlist.
- Distribute the signup link to interested partners.

To get an extension (up to 3 months/milestones)

- Summarize feedback of the experiment so far.
- Motivate extension and summarize progress in an *intent to extend experiment* to the Blink API Owners and get one LGTM.
- Update Chromestatus entry and wait for its resolution.
- Ask partners to update their tokens.

## Finch trial

When a *feature* does not require any changes to user code, V8 can decide to run a trial without partner engagement. Such trials are ideal for performance improvements or larger architectural changes. Chrome's metric collection can then be used to compare different configurations and their impact on common performance and stability metrics.

### Steps to launch a Finch trial

- Consider adding GWS ids and inform partners of the experiment to track any changes in application metrics that are not covered by Chrome (e.g. performance metrics).
- [Submit a configuration](https://uma.googleplex.com/p/chrome/variations/creator/) to be tested in the Chrome repository.
- Make the Chrome Security Team aware of the pending experiment by moving the tracking issue to the "V8 Feature in trial" hotlist and linking the Finch configuration in a comment. Remove the issue from the "V8 Feature staged" hotlist.
- Enable the Finch experiment, starting with 50% of canary/dev users.
- Inform potentially affected partners of the upcoming change, especially if they should monitor changes in GWS metrics more closely.
- Consider announcing the upcoming experiment with details on how to test them in the [Chrome Enterprise release notes](https://support.google.com/chrome/a/answer/7679408?hl=en&co=CHROME_ENTERPRISE._Product%3DChromeBrowser).
- Regularly check metrics and follow up on alerts.

Progress through the stages using the one-click study advancement or following the best practices:

- After at least 2 weeks of successful experimentation, advance the experiment to 50% of beta users (can be triggered via the 1-click study advancement).
- After at least 2 weeks of successful experimentation, advance the experiment to 1% of stable users (can be triggered via the 1-click study advancement).
- After at least 2 weeks of successful experimentation, advance the experiment to 10% of stable users (can be triggered via the 1-click study advancement).
- After at least 2 weeks (4 weeks for critical features) of successful experimentation, advance the experiment to 50% of stable users (in case *WebView* is not part of the trial, one can jump straight to shipping from here, but it's recommended to include WebView into each trial).
- After at least 2 weeks of stable experimentation, you can consider shipping.

The optional longer experimentation time for critical features at 10% of stable users is to accommodate for manually detected bugs and reporting which tend to have a longer lead time than signals gathered from metrics and automated testing. At 10% the impact of the experiment is still limited while providing good visibility for partners to identify issues.

# Shipping { #shipping }

## When is a feature ready to be shipped?

- The *feature* went through all previous phases (skipping optional phases if applicable) including a successful V8 launch review.
- The implementation is covered by one or more fuzzers (if applicable).
- The feature has been staged and opened to the VRP for several weeks to get fuzzer coverage and feedback.
- The *feature* proposal is phase/stage 4 (if applicable).
- All spec tests ([JavaScript](https://github.com/tc39/test262), [WebAssembly](https://github.com/WebAssembly/spec/tree/master/test)) pass.
- For *WebAssembly features*, the [Chromium DevTools checklist](https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/checklist/webassembly.md) is satisfied.

## How to ship a feature

### Prerequisites

- Request all required reviews for shipping on the Chromestatus entry.
- Send *intent to ship* to Blink API Owners and get three LGTMs.

### Ship WebAssembly feature flags

- In [`src/wasm/wasm-feature-flags.h`](https://source.chromium.org/chromium/chromium/src/+/master:v8/src/wasm/wasm-feature-flags.h), move the *feature flag* from the `FOREACH_WASM_STAGING_FEATURE_FLAG` macro list to the `FOREACH_WASM_SHIPPED_FEATURE_FLAG` macro list.
- Additionally, enable the feature by default by changing the third parameter in `FOREACH_WASM_SHIPPED_FEATURE_FLAG` to `true`.

### Ship JavaScript and V8 feature flags

- In [`src/flags/flag-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/flags/flag-definitions.h), remove any implication from `future` and `wasm-staging`.
- Set the default value of the *feature* in [`src/flags/flag-definitions.h`](https://cs.chromium.org/chromium/src/v8/src/flags/flag-definitions.h) to `true`.

### After enabling the feature

- Ensure to add a blink CQ bot on the CL to check for [blink web test](https://v8.dev/docs/blink-layout-tests) failures caused by enabling the *feature* (add this line to the footer of the CL description: `Cq-Include-Trybots: luci.v8.try:v8_linux_blink_rel`).
- If the *feature* has been tried in a Finch experiment, you can soft-launch the *feature* via Finch by setting its experiment to 100% of users. This allows faster shipping and can be rolled back easily.
- Set a reminder to remove the *feature* flag, the Finch configuration and outdated code after two milestones.

### Disabling an already shipped feature

If there are any issues during early stages, a *reverse Finch trial* can disable the *feature* if the flag has not been removed yet and the Finch config is still there. After a prolonged time, this might not be a viable option anymore even if the *feature flag* is still active, because the alternative code path is no longer tested and poses a higher risk.

