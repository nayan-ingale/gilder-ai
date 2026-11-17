# Deploying GilderAi

This is an overview of how the app runs in production, and the steps to put it on a fresh server. The files in this folder are what the server runs:

| File          | What it is                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| `compose.yml` | The whole app: gateway, services, web server, MongoDB, Redis, Qdrant and Caddy |
| `Caddyfile`   | The one public entrance, with automatic HTTPS                                  |
| `backup.sh`   | A nightly copy of MongoDB to S3                                                |

## How it fits together

```
visitor ── https://<your-domain> ──▶ server
                                       Caddy (80/443, automatic HTTPS)
                                         └─▶ web app (Next.js)
                                               └─ /api/* ─▶ gateway ─▶ auth · chat · agent · billing
                                                                          └─ MongoDB · Redis · Qdrant
browser ── signed upload and download links ──▶ S3 bucket
Razorpay ── webhook ──▶ https://<your-domain>/api/webhooks/razorpay
```

- **Images, not code, go to the server.** GitHub Actions builds two images, one for the backend and one for the web app, and pushes them to GitHub's container registry, tagged with the commit.
- **Secrets stay on the server.** Each app reads its own `env/<app>.env` there. The images and the repository hold none.
- **A deploy is one click.** The Deploy workflow (`.github/workflows/deploy.yml`, started by hand) copies this folder's files to the server over SSH and restarts whatever changed. Data lives in Docker volumes, so it survives restarts and deploys.

## What you need

- A Linux server with at least 2 GB of RAM (plus swap), Docker with the Compose plugin, and a fixed public IP. Ports 80 and 443 must be open, and 22 for SSH.
- A domain whose `A` record points at that IP.
- The accounts behind the features: Firebase for Google sign-in, an S3 bucket, Razorpay, and the AI and search keys. The key table in the main README lists them.

## Setting it up

1. **Server.**
   - Create it and give it a fixed IP.
   - Open ports 80 and 443.
   - Install updates, add swap and install Docker.
   - Create `~/gilder-ai/env/`.
2. **Domain.** Point the domain's `A` record at the server. Caddy can get a certificate only once the name reaches the server.
3. **Settings files**, next to `compose.yml` on the server:
   - `.env` with `DOMAIN=<your-domain>`;
   - `env/gateway.env`, `auth.env`, `chat.env`, `agent.env`, `billing.env` and `frontend.env`, each in the format of that app's `.env.example`.

   Use production values:
   - fresh signing keys, not the development ones (`setup-keys.ts --rotate` makes new ones);
   - `AUTH_DEV_LOGIN=false` and `LLM_MODE=live`;
   - a new random `RAZORPAY_WEBHOOK_SECRET`.

   The addresses between containers are already set in `compose.yml`, so the files need only keys and settings. Make them readable only by their owner (`chmod 600`).

4. **SSH access for GitHub.**
   - Make a key pair used only for deploys, and add its public half to the server's `~/.ssh/authorized_keys`.
   - Save the server's host key with `ssh-keyscan`, after checking its fingerprint on the server itself. The deploy job then connects only to your server.
5. **GitHub settings**, under Settings → Secrets and variables → Actions:
   - **Secrets:** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (the private deploy key) and `DEPLOY_KNOWN_HOSTS` (the `ssh-keyscan` line).
   - **Variables:** the `NEXT_PUBLIC_*` values and `S3_BUCKET_ORIGIN` (`https://<bucket>.s3.<region>.amazonaws.com`). They're built into the web app, which is why they live here and not on the server.
6. **Deploy.** Run Actions → Deploy → Run workflow, or `gh workflow run deploy.yml --ref main`. The first run takes a few minutes. Caddy then gets the HTTPS certificate on its own.
7. **Point the outside services at the new domain:**
   - **Firebase:** Authentication → Settings → Authorized domains → add the domain.
   - **Google Cloud:** on the OAuth consent screen, publish the app so any Google account can sign in.
   - **S3 bucket CORS:** allow `https://<your-domain>` for `POST` and `GET`, because uploads go straight from the browser to S3.
   - **Razorpay webhook:** URL `https://<your-domain>/api/webhooks/razorpay`, event `payment.captured`, with the same secret as `RAZORPAY_WEBHOOK_SECRET`.
8. **Check.** `curl https://<your-domain>/api/health` should answer `{"status":"ok"}`. Then sign in, chat, upload a PDF, open a generated file and make a test payment.
9. **Safety nets:**
   - **Uptime monitor** on `/api/health`, which answers 200 only when Caddy, the web server, the gateway and Redis all work.
   - **Spending limits** on the AI keys, and a budget alert on the cloud account.
   - **Backups:**
     1. Write `env/backup.env`, for a bucket the app's own key can't read or delete.
     2. Add the cron line from the top of `backup.sh`.
     3. Run it once, and try a restore into a throwaway database.

## Everyday commands

Run these on the server, in `~/gilder-ai`:

| Task                     | Command                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| See what's running       | `docker compose ps`                                                     |
| Follow one app's logs    | `docker compose logs --tail 100 -f agent`                               |
| Find the live version    | `docker inspect --format '{{.Config.Image}}' gilder-prod-gateway-1`     |
| Apply a changed env file | `TAG=<live sha> docker compose up -d --no-deps --force-recreate agent`  |
| Roll back                | `TAG=<older sha> docker compose up -d`, or revert the commit and deploy |
| Back up now              | `./backup.sh`                                                           |

The images are private, and the server keeps only the versions it was deployed with. So any command that creates containers needs `TAG` set to one of them (the Deploy workflow sets it itself). `docker compose restart` keeps the old container, so it doesn't pick up a changed env file.
