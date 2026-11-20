# Atlas architecture overview

> Fictional document for demo purposes.

The Atlas web app is a React single-page application served from the client's Azure tenant. It talks only to a Node.js backend-for-frontend (BFF). The BFF handles session management and calls Northbridge's core banking APIs.

**Environments:** dev (shared, synthetic data), UAT (client-run, masked data), production (live customer data, tightly restricted).

**Release flow:** merge to main in GitLab, automated tests, deploy to dev, fortnightly promotion to UAT, client-approved release to production.

**Key repositories:** atlas-web (front end), atlas-bff (BFF), atlas-e2e (Playwright tests).
