# Deploying QORTA to Render (Existing Repository)

This guide assumes your code is already pushed to GitHub. Since we've added a `render.yaml` file, deployment is automated via Render Blueprints.

## Step 1: Push Changes to GitHub

Ensure the new `render.yaml` file is pushed to your repository:

```bash
git add render.yaml
git commit -m "Add render.yaml for deployment"
git push
```

## Step 2: Create Service on Render

1.  Log in to your [Render Dashboard](https://dashboard.render.com).
2.  Click **New +** and select **Blueprint**.
3.  Connect your GitHub account if needed.
4.  Select your **qorta-backend** repository.
5.  Render will automatically detect the `render.yaml` configuration.
6.  Click **Apply**.

## Step 3: Configure Environment Variables

Render will ask you to provide values for the variables defined in `render.yaml`. Enter these carefully:

| Variable | Description | Value to Enter |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment Mode | `production` (already set) |
| `CORS_ORIGIN` | Allowed Frontend URL | `https://qorta.onrender.com` (Use `*` temporarily if unsure) |
| `FIREBASE_PROJECT_ID` | Project ID | `qorta-production` (or your actual ID) |
| `FIREBASE_CLIENT_EMAIL` | Service Account Email | Check your `serviceAccountKey.json` or Firebase Console |
| `FIREBASE_PRIVATE_KEY` | Private Key | Paste the **entire** private key string from your JSON file. Include `-----BEGIN...` and `\n`. |

## Step 4: Verify Deployment

1.  Wait for the build to complete. The service status will change to **Live**.
2.  Click the deployment URL (e.g., `https://qorta.onrender.com`).
3.  Append `/health` to verify the API is running: `https://.../health` -> `{"status":"ok"}`.
4.  Your frontend is served at the root URL.

## Troubleshooting

-   **Depedency Errors**: Make sure `package.json` includes all necessary packages.
-   **Firebase Auth Errors**: Double-check the Private Key formatting. It must be exact.
-   **CORS Issues**: If the frontend can't reach the backend, update `CORS_ORIGIN` to match your frontend URL exactly.
