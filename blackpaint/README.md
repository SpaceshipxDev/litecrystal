# Estara (Blackpaint)

This folder contains the Electron wrapper for the `taintedpaint` web
application. The app now always loads the same web interface and relies on user
logins to determine whether the full or restricted view is shown.

### SMB share

Task folders live on a shared network disk. The application ships with a
default path of "\\\\192.168.5.21\\d\\Estara\\Tasks". If your network share is different, set the
`SMB_CLIENT_ROOT` environment variable **before** running `npm run make` so the
path is embedded into the build, e.g.

```bash
SMB_CLIENT_ROOT=\\YOUR-SERVER\CrystalData npm run make
```

You no longer need to set this variable when launching the installed
application; the compiled value will be used automatically.

Run this inside this folder after installing dependencies:

```bash
npm run make
```

The generated installers will be in `out/`.
