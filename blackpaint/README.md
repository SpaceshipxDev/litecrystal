# Estara (Blackpaint)

This folder contains the Electron wrapper for the `taintedpaint` web
application. Two distributable versions exist:

- **Administrator** – no restrictions, loads the web app directly.
- **Production** – restricted view. The Electron window loads the web URL with
  `?restricted=1` appended. Inside `taintedpaint` this query param disables the
  商务 tab so production workers only see the 生产 section.

The build script `npm run make:restricted` sets the `RESTRICTED` environment
variable and Webpack's `EnvironmentPlugin` embeds its value into the compiled
code. The main process checks this value and appends the query parameter when
creating the browser window.

### SMB share

Task folders live on a shared network disk. The application ships with a
default path of `\\FWQ88\Estara`. If your network share is different, set the
`SMB_CLIENT_ROOT` environment variable **before** running `npm run make` so the
path is embedded into the build, e.g.

```bash
SMB_CLIENT_ROOT=\\YOUR-SERVER\CrystalData npm run make
```

You no longer need to set this variable when launching the installed
application; the compiled value will be used automatically.

Run one of these inside this folder after installing dependencies:

```bash
npm run make        # Administrator build
npm run make:restricted  # Production build
```

The generated installers will be in `out/`.
