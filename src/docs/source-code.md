---
title: 'Checking out the V8 source code'
---
## Quick links

- [browse](https://chromium.googlesource.com/v8/v8/)
- [browse bleeding edge](https://chromium.googlesource.com/v8/v8/+/master)
- [changes](https://chromium.googlesource.com/v8/v8/+log/master).

## Using Git

V8’s Git repository is located at <https://chromium.googlesource.com/v8/v8.git>, with an official mirror on GitHub: <https://github.com/v8/v8>.

Don’t just `git clone` either of these URLs! if you want to build V8 from your checkout, instead follow the instructions below to get everything set up correctly.

## Prerequisites

1. **Git**. To install using `apt-get`:

    ```bash
    apt-get install git
    ```

1. `depot_tools`. See [instructions](https://dev.chromium.org/developers/how-tos/install-depot-tools).

1. For **push access**, you need to setup a `.netrc` file with your Git password:

    1. Go to <https://chromium.googlesource.com/new-password> and log in with your committer account (usually an `@chromium.org` account). Note: creating a new password doesn’t automatically revoke any previously-created passwords. Please make sure you use the same email as the one set for `git config user.email`.
    1. Have a look at the big, grey box containing shell commands. Paste those lines into your shell.

## How to start

Make sure `depot_tools` are up-to-date:

```bash
gclient
```

Then get V8, including all branches and dependencies:

```bash
mkdir ~/v8
cd ~/v8
fetch v8
cd v8
```

After that you’re intentionally in a detached head state.

Optionally you can specify how new branches should be tracked:

```bash
git config branch.autosetupmerge always
git config branch.autosetuprebase always
```

Alternatively, you can create new local branches like this (recommended):

```bash
git new-branch fix-bug-1234
```

## Staying up-to-date

Update your current branch with `git pull`. Note that if you’re not on a branch, `git pull` won’t work, and you’ll need to use `git fetch` instead.

```bash
git pull
```

Sometimes dependencies of V8 are updated. You can synchronize those by running:

```bash
gclient sync
```

## Sending code for reviewing

```bash
git cl upload
```

## Committing

You can use the CQ checkbox on codereview for committing (preferred). See also the [chromium instructions](https://www.chromium.org/developers/testing/commit-queue) for CQ flags and troubleshooting.

If you need more trybots than the default, add the following to your commit message on Gerrit (e.g. for adding a nosnap bot):

```
CQ_INCLUDE_TRYBOTS=tryserver.v8:v8_linux_nosnap_rel
```

To land manually, update your branch:

```bash
git pull --rebase origin
```

Then commit using

```bash
git cl land
```

## Try jobs

This section is only useful for V8 project members.

### Creating a try job from codereview

1. Upload a CL to Gerrit.

    ```bash
    git cl upload
    ```

1. Try the CL by sending a try job to the try bots like this:

    ```
    git cl try
    ```

1. Wait for the try bots to build and you get an email with the result. You can also check the try state at your patch on Gerrit.

1. If applying the patch fails you either need to rebase your patch or specify the V8 revision to sync to:

```bash
git cl try --revision=1234
```

### Creating a try job from a local branch

1. Commit some changes to a git branch in the local repo.

1. Try the change by sending a try job to the try bots like this:

    ```bash
    git cl try
    ```

1. Wait for the try bots to build and you get an email with the result. Note: There are issues with some of the slaves at the moment. Sending try jobs from codereview is recommended.

### Useful arguments

The revision argument tells the try bot what revision of the code base is used for applying your local changes to. Without the revision, our LKGR revision is used as the base (https://v8-status.appspot.com/lkgr).

```bash
git cl try --revision=1234
```

To avoid running your try job on all bots, use the `--bot` flag with a comma-separated list of builder names. Example:

```bash
git cl try --bot=v8_mac_rel
```

### Viewing the try server

<https://build.chromium.org/p/tryserver.v8/waterfall>

If asked for access credentials, use your `@chromium.org` email address and your generated password from [googlecode.com](http://code.google.com/hosting/settings).

## Source code branches

There are several different branches of V8; if you're unsure of which version to get, you most likely want the up-to-date stable version. Have a look at our [[Release Process|Release Process]] for more information about the different branches used.

You may want to follow the V8 version that Chrome is shipping on its stable (or beta) channels, see <https://omahaproxy.appspot.com/>.
