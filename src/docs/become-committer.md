---
title: 'Becoming a committer'
description: 'How does one become a V8 committer? This document explains.'
---
Technically, committers are people who have write access to the V8 Git repository. Committers can submit their own patches or patches from others.

This privilege is granted with some expectation of responsibility: committers are people who care about the V8 project and want to help meet its goals. Committers are not just people who can make changes, but people who have demonstrated their ability to collaborate with the team, get the most knowledgeable people to review code, contribute high-quality code, and follow through to fix issues (in code or tests).

A committer is a contributor to the V8 project’s success and a citizen helping the projects succeed. See [Committer’s Responsibility](/docs/committer-responsibility).

## How do I become a committer?

*Note to Googlers: There is a [slightly different approach for V8 team members](http://go/v8/setup_permissions.md).*

In a nutshell, contribute 20 non-trivial patches and get at least three different people to review them (you'll need three people to support you). Then ask someone to nominate you. You're demonstrating your:

- commitment to the project (20 good patches requires a lot of your valuable time),
- ability to collaborate with the team,
- understanding of how the team works (policies, processes for testing and code review, etc),
- understanding of the projects' code base and coding style, and
- ability to write good code (last but certainly not least)

A current committer nominates you by sending email to <v8-committers@googlegroups.com> containing:

- your first and last name
- your Google Code email address
- an explanation of why you should be a committer,
- embedded list of links to revisions (about top 10) containing your patches

Two other committers need to second your nomination. If no one objects in 5 working days (U.S.), you're a committer.  If anyone objects or wants more information, the committers discuss and usually come to a consensus (within the 5 working days). If issues cannot be resolved, there's a vote among current committers.

Once you get approval from the existing committers, we'll send you instructions for write access to Git. You'll also be added to v8-committers@googlegroups.com.

In the worst case, this can drag out for two weeks. Keep writing patches! Even in the rare cases where a nomination fails, the objection is usually something easy to address like “more patches” or “not enough people are familiar with this person’s work.”

### Setting up push access to the repository

When you are accepted as a committer make sure to [set up push access to the repo](/docs/source-code#instructions).

## Maintaining committer status

You don't really need to do much to maintain committer status: just keep being awesome and helping the V8 project!

In the unhappy event that a committer continues to disregard good citizenship (or actively disrupts the project), we may need to revoke that person's status. The process is the same as for nominating a new committer: someone suggests the revocation with a good reason, two people second the motion, and a vote may be called if consensus cannot be reached. I hope that's simple enough, and that we never have to test it in practice.

(This document was inspired by <https://dev.chromium.org/getting-involved/become-a-committer>.)
