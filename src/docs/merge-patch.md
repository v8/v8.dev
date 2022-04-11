---
title: 'Merging & patching'
description: 'This document explains how to merge V8 patches to the master branch.'
---
If you have a patch to the `master` branch (e.g. an important bug fix) that needs to be merged into one of the production V8 branches, read on.

The following examples use a branched 2.4 version of V8. Substitute `2.4` with your version number. Read the documentation on [V8’s release process](/docs/release-process) and [V8’s version numbering](/docs/version-numbers) for more information.

An associated issue on Chromium’s or V8’s issue tracker is mandatory if a patch is merged. This helps with keeping track of merges. You can use [a template](https://code.google.com/p/v8/issues/entry?template=Merge%20request) to create a merge request issue.

## What qualifies a merge candidate?

- The patch fixes a *severe* bug (in order of importance):
    1. security bug
    1. stability bug
    1. correctness bug
    1. performance bug
- The patch does not alter APIs.
- The patch does not change behavior present before branch cut (except if the behavior change fixes a bug).

More information can be found on the [relevant Chromium page](https://www.chromium.org/developers/the-zen-of-merge-requests). When in doubt, send an email to <v8-dev@googlegroups.com>.

## The merge process

The merge process in the Chromium and V8 tracker is driven by labels in the form of:

```
Merge-[Status]-[Branch]
```

The currently important labels for V8 are:

1. `Merge-Request-{Branch}` initiates the process, and means that this fix should be merged into `{Branch}`. `{Branch}` is the name/number of the V8 branch e.g. `7.2` for M72.
1. `Merge-Review-{Branch}` means the merge is not approved yet for `{Branch}` e.g. because Canary coverage is missing.
1. `Merge-Approved-{Branch}` means that the Chrome TPMs have signed off on the merge.
1. When the merge is done, the `Merge-Approved-{Branch}` label is replaced with `Merge-Merged-{Branch}`.

## How to check if a commit was already merged/reverted/has Canary coverage

Use `mergeinfo.py` to get all the commits which are connected to the `$COMMIT_HASH` according to Git.

```bash
tools/release/mergeinfo.py $COMMIT_HASH
```

If it tells you `Is on Canary: No Canary coverage` you should not merge yet because the fix was not yet deployed on a Canary build. A good rule of the thumb is to wait at least 3 days after the fix has landed until the merge is conducted.

## How to create the merge CL

### Option 1: Using [gerrit](https://chromium-review.googlesource.com/)

Note that this option only works if the patch applies cleanly on the release branch.

1. Open the CL you want to back-merge.
1. Select "Cherry pick" from the extended menu (three vertical dots in the upper right corner).
1. Enter "refs/branch-heads/*X.X*" as destination branch (replace *X.X* by the proper branch).
1. Modify the commit message:
   1. Prefix the title with "Merged: ".
   1. Remove lines from the footer that correspond to the original CL ("Change-Id", "Reviewed-on", "Reviewed-by", "Commit-Queue", "Cr-Commit-Position"). Definitely keep the "(cherry picked from commit XXX)" line, as this is needed by some tools to relate merges to original CLs.
1. In case of merge conflict, please also go ahead and create the CL. To resolve  conflicts (if any) - either using the gerrit UI or you can easily pull the patch locally by using the "download patch" command from the menu (three vertical dots in the upper right corner).
1. Send out for review.

### Option 2: Using the automated script

Let’s assume you’re merging revision af3cf11 to branch 2.4 (please specify full git hashes - abbreviations are used here for simplicity).

```bash
tools/release/merge_to_branch.py --branch 2.4 af3cf11
```

Run the script with `-h` to display its help message, which includes more options (e.g. you can specify a file containing your patch, or you can reverse a patch, specify a custom commit message, or resume a merging process you’ve canceled before). Note that the script will use a temporary checkout of V8 - it won’t touch your work space. You can also merge more than one revision at once; just list them all.

```bash
tools/release/merge_to_branch.py --branch 2.4 af3cf11 cf33f1b sf3cf09
```

### After landing: Observe the [branch waterfall](https://ci.chromium.org/p/v8)

If one of the builders is not green after handling your patch, revert the merge immediately. A bot (`AutoTagBot`) takes care of the correct versioning after a 10-minute wait.

## Patching a version used on Canary/Dev

In case you need to patch a Canary/Dev version (which should not happen often), follow these instructions:

### Step 1: Merge to roll branch

Example version used is `5.7.433`.

```bash
tools/release/roll_merge.py --branch 5.7.433 af3cf11
```

### Step 2: Make Chromium aware of the fix

Example Chromium branch used is `2978`:

```bash
git checkout chromium/2978
git merge 5.7.433.1
git push
```

### Step 3: The end

Chrome/Chromium should pick up the change when they build automatically.

## FAQ

### I get an error during merge that is related to tagging. What should I do?

When two people are merging at the same time a race condition can happen in the merge scripts. If this is the case, contact <machenbach@chromium.org> and <hablich@chromium.org>.

### Is there a TL;DR?

1. [Create an issue on the issue tracker](https://bugs.chromium.org/p/v8/issues/entry?template=Merge%20request).
1. Check status of the fix with `tools/release/mergeinfo.py`
1. Add `Merge-Request-{Branch}` to the issue.
1. Wait until somebody adds `Merge-Approved-{Branch}`.
1. [Merge](#step-1-run-the-script).
