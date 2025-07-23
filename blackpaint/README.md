# Estara (Blackpaint)

This folder contains the Electron wrapper for the `taintedpaint` web
application. Two distributable versions exist:

- **Administrator** – no restrictions, loads the web app directly.
- **Production** – restricted view. The Electron window loads the web URL with
  `?restricted=1` appended. Inside `taintedpaint` this query param disables the
  商务 tab and 总揽 switcher so production workers only see the 生产 section.

The build script `npm run make:restricted` sets the `RESTRICTED` environment
variable and Webpack's `EnvironmentPlugin` embeds its value into the compiled
code. The main process checks this value and appends the query parameter when
creating the browser window.

Run one of these inside this folder after installing dependencies:

```bash
npm run make        # Administrator build
npm run make:restricted  # Production build
```

The generated installers will be in `out/`.
