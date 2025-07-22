# CrystalPaint Setup

This repository contains two parts:

- `taintedpaint` – the Next.js web app.
- `blackpaint` – the Electron wrapper named **Eldaline**.

Two Electron builds can be produced:

1. **Administrator build** – full access.
2. **Production build** – locked to production view with some UI disabled.

## Web App

```
cd taintedpaint
npm install
npm run dev
```

By default the web app runs on `http://localhost:3000`. Set `NEXT_PUBLIC_APP_URL` in the environment if the Electron app should point elsewhere.

## Building Electron Apps

```
cd blackpaint
npm install
```

### Administrator version

```
npm run make
```

### Production version

```
npm run make:restricted
```

The production build adds `?restricted=1` to the web URL so the web interface automatically hides the Business switcher and Holistic view.

The packaged apps can be found in `blackpaint/out` after running the commands.
