# Project Atlas: brief

> Fictional project for demo purposes.

## Client and goal

Northbridge Bank is replacing its customer-facing online banking website. Atlas delivers the new web experience in phases: account overview and payments first, then savings and loan applications. Phase 1 goes live in Q2 next year.

## Technology

- Front end: React 18, TypeScript, Redux Toolkit, the bank's own design system (Storybook)
- Backend-for-frontend: Node.js with Express, calling the bank's core banking APIs
- Testing: Jest, React Testing Library, Playwright for end-to-end
- Hosting: client Azure tenant. Code lives in the client's GitLab, not our GitHub.
- Environments: dev, UAT, production. Production data is highly sensitive.

## Team and ways of working

Two-week sprints. Daily stand-up at 9:30 ET with the client product owner. The client requires all consultants to sign an NDA and pass a background check before receiving any client system access. Client systems are only reachable over the client VPN.

## What new joiners typically work on

Frontend developers build payment and account screens against the design system and write component and end-to-end tests. Backend developers extend the BFF and its integration tests, and investigate production defects reported by the client, which requires read access to the production database. QA engineers own the Playwright suite and UAT test runs.
