---
title: 'Triaging issues'
---
This document explains how to deal with issues in [V8’s bug tracker](https://v8.dev/bugs).

## How to get an issue triaged

- *V8 tracker*: Set the state to `Untriaged`
- *Chromium tracker*: Set the state to `Untriaged` and add the component `Blink>JavaScript`

## How to assign V8 issues in the Chromium tracker

Please move issues to the V8 specialty sheriffs queue of one of the
following categories:

- Memory: `component:blink>javascript status=Untriaged label:Performance-Memory`
    - Will show up in [this](https://bugs.chromium.org/p/chromium/issues/list?can=2&q=component%3Ablink%3Ejavascript+status%3DUntriaged+label%3APerformance-Memory+&colspec=ID+Pri+M+Stars+ReleaseBlock+Cr+Status+Owner+Summary+OS+Modified&x=m&y=releaseblock&cells=tiles) query
- Stability: `status=available,untriaged component:Blink>JavaScript label:Stability -label:Clusterfuzz`
    - Will show up in [this](https://bugs.chromium.org/p/chromium/issues/list?can=2&q=status%3Davailable%2Cuntriaged+component%3ABlink%3EJavaScript+label%3AStability+-label%3AClusterfuzz&colspec=ID+Pri+M+Stars+ReleaseBlock+Component+Status+Owner+Summary+OS+Modified&x=m&y=releaseblock&cells=ids) query
    - No CC needed, will be triaged by a sheriff automatically
- Performance: <mvstanton@chromium.org>
- Clusterfuzz: Set the bug to the following state:
    - `label:ClusterFuzz component:Blink>JavaScript status:Untriaged`
    - Will show up in [this](https://bugs.chromium.org/p/chromium/issues/list?can=2&q=label%3AClusterFuzz+component%3ABlink%3EJavaScript+status%3AUntriaged&colspec=ID+Pri+M+Stars+ReleaseBlock+Component+Status+Owner+Summary+OS+Modified&x=m&y=releaseblock&cells=ids) query.
    - No CC needed, will be triaged by a sheriff automatically
- Security: All security issues are triaged by Chromium Security sheriffs. Please see [reporting security bugs](/docs/security-bugs) for more information.

If you need the attention of a sheriff, please consult the rotation information.

Use the component `Blink>JavaScript` on all issues.

**Please note that this only applies to issues tracked in the Chromium issue tracker.**
