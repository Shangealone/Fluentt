# Administrator application

See [the application setup guide](../../README.md) for backend setup and shared configuration. Run the following commands from this directory after installing a supported Node.js version:

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open http://localhost:3000. The environment template connects the public health indicator and server-side administrator proxy to the API at http://localhost:8001. Set both `NEXT_PUBLIC_API_URL` and `FLUENTT_API_URL` if the API uses another address; `FLUENTT_ADMIN_WEB_ORIGIN` must match the browser origin and backend configuration. Restart Next.js after editing environment variables.

The application includes curriculum, question-bank and research screens. Real administrator sign-in requires the backend's operator-provisioned administrator account, OIDC provider configuration and matching callback URL. When that configuration is absent, real sign-in remains disabled or unavailable. Do not add credentials to `NEXT_PUBLIC_*` variables. A public page or successful build does not verify authenticated backend operations.

The optional sample workspace requires `FLUENTT_ENABLE_ADMIN_DEMO=1` in `.env.local` and `npm run dev`; it is off by default and always disabled in production. It uses demonstration data, cannot publish real data and does not establish a backend administrator session. Leave this flag off when testing real sign-in and backend permissions.

Run `npm run typecheck`, `npm run lint` and `npm run build` to check the application. Next.js 16 keeps development output in `.next/dev`, separate from production output. Production requires HTTPS for the API and administrator origins; use `npm run start` after building with the intended production configuration.

For an isolated build while developing, set `$env:FLUENTT_ADMIN_BUILD_DIR = "build/production-check"` before `npm run build`. Use that same value for `npm run start` to serve the isolated build, and remove it with `Remove-Item Env:FLUENTT_ADMIN_BUILD_DIR` before normal development commands. Run the demo access regression checks with `node --test tests/admin-demo-access.test.mjs`.
