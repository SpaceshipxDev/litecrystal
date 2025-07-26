# Migrating CrystalPaint Storage

This guide explains how to move existing task files and metadata from
`taintedpaint/public/storage` to the new `storage` directory in the repository
root. The change is necessary because the old location was only served as static
assets and files disappeared when running `npm run build && npm run start`.

## 1. Stop the server
If the development server is running, stop it now.

## 2. Create the new directory
In the project root run:

```bash
mkdir storage
```

## 3. Copy existing data
Move everything from `taintedpaint/public/storage` into the new directory:

```bash
mv taintedpaint/public/storage/* storage/
```

(You can also copy the files if you prefer to keep a backup.)

## 4. Clean up
Remove the now-empty `taintedpaint/public/storage` folder:

```bash
rmdir taintedpaint/public/storage
```

## 5. Install dependencies
From within `taintedpaint` install packages and build the project:

```bash
cd taintedpaint
npm install
npm run build
```

## 6. Start the server
Run the production server from the `taintedpaint` directory:

```bash
npm start
```

The application will now read and write dynamic data under `../storage` which
remains available in production.
