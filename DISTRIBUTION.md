# Distribution Guide

This document explains how to package and distribute this application to other Ubuntu users.

## Current State - Ready for GitHub Distribution

The application is **already ready** for basic distribution via GitHub! Users can:

```bash
git clone https://github.com/YOUR_USERNAME/localVoiceApp.git
cd localVoiceApp
./setup.sh
./install-service.sh
```

The `setup.sh` script handles everything automatically.

## Distribution Options

### 1. GitHub Repository (Current - Recommended)

**Pros:**
- ✅ Already set up and working
- ✅ Easy to maintain and update
- ✅ Users get latest version
- ✅ Simple installation process

**Cons:**
- ❌ Requires git/manual download
- ❌ Not in Ubuntu Software Center
- ❌ Users need to trust and run scripts

**What's needed:**
- [x] Working application
- [x] Automated setup script
- [x] Clear documentation (README.md, INSTALL.md)
- [ ] Push to GitHub
- [ ] Create releases with tags
- [ ] Add screenshots/demo

### 2. Debian Package (.deb)

**Pros:**
- Native Ubuntu integration
- Handles dependencies automatically
- Can be added to PPAs
- Professional distribution

**Cons:**
- Complex to create and maintain
- Need to handle large Vosk model separately
- Must maintain for multiple Ubuntu versions

**What's needed:**
```
debian/
├── control           # Package metadata and dependencies
├── changelog         # Version history
├── copyright         # License info
├── rules            # Build instructions
├── postinst         # Post-installation script (download model)
├── prerm            # Pre-removal script
└── service          # Systemd service file
```

**Dependencies to declare:**
```
Depends: nodejs (>= 14), sox, xdotool, yad
```

**Build command:**
```bash
dpkg-deb --build localvoiceapp
```

### 3. Snap Package

**Pros:**
- Auto-updates
- Sandboxed security
- Ubuntu Software Center listing
- Single file installation

**Cons:**
- Larger package size
- Need to request interface permissions
- Snap ecosystem learning curve

**What's needed:**

Create `snapcraft.yaml`:
```yaml
name: localvoiceapp
version: '1.0'
summary: Local voice-to-text with real-time transcription
description: |
  Offline voice-to-text application with real-time transcription.
  Press F9 to record, text appears at your cursor.

base: core22
confinement: classic  # Need classic for keyboard/typing access

parts:
  localvoiceapp:
    plugin: nodejs
    source: .
    stage-packages:
      - sox
      - libsox-fmt-all
      - xdotool
      - yad

apps:
  localvoiceapp:
    command: node index.js
    daemon: simple
    restart-condition: always
```

**Build:**
```bash
snapcraft
sudo snap install localvoiceapp_1.0_amd64.snap --dangerous --classic
```

### 4. AppImage

**Pros:**
- Single portable file
- No installation needed
- Works on any Linux distro

**Cons:**
- Still needs system dependencies (sox, xdotool)
- Larger file size (~100MB+ with Node.js)
- No auto-updates

**Not recommended** for this app due to system dependency requirements.

### 5. npm Package

**Pros:**
- Easy for developers
- `npm install -g` installation
- Handles Node dependencies

**Cons:**
- Still needs system packages (sox, xdotool, yad)
- Not for non-technical users

**What's needed:**
- Add `bin` field to package.json
- Publish to npm registry
- Still need post-install for system deps

## Recommended Distribution Strategy

For maximum reach with minimum maintenance:

### Phase 1: GitHub (Current)
1. ✅ Create comprehensive README
2. ✅ Automated setup script
3. [ ] Push to GitHub
4. [ ] Create initial release (v1.0.0)
5. [ ] Add demo GIF/video
6. [ ] Share on Reddit (/r/linux, /r/ubuntu)

### Phase 2: Make it More Accessible
1. Create one-line installer:
   ```bash
   bash <(wget -qO- https://raw.githubusercontent.com/USER/localVoiceApp/main/install.sh)
   ```
2. Add to awesome lists (awesome-linux-apps, etc.)
3. Create project website/landing page

### Phase 3: Package Distribution (Optional)
1. Create .deb package
2. Set up PPA (Personal Package Archive)
3. Submit to Ubuntu repositories

## Handling the Vosk Model

The 1.8GB Vosk model is too large for packaging. Options:

**Option A: Download on Install (Current)**
- Setup script downloads on first run
- User chooses small vs large model
- ✅ Best user experience

**Option B: Separate Download**
- Provide download link in README
- User manually downloads and places in models/
- ❌ More steps for user

**Option C: Model Package**
- Create separate package for models
- Users install: `localvoiceapp` and `localvoiceapp-model-large`
- ✅ Good for .deb distribution

## Testing Checklist for Distribution

Before releasing:

- [ ] Test on fresh Ubuntu 20.04 install
- [ ] Test on Ubuntu 22.04
- [ ] Test on Ubuntu 24.04
- [ ] Test with different audio devices
- [ ] Test all error cases (no mic, no internet for model, etc.)
- [ ] Verify uninstall script cleans everything
- [ ] Check permissions (doesn't require sudo except for apt)
- [ ] Test service auto-start after reboot
- [ ] Verify indicator appears correctly
- [ ] Test in different desktop environments (GNOME, KDE, XFCE)

## License Considerations

Before distributing:

1. **Check Vosk license** - Apache 2.0 (OK for distribution)
2. **Check all npm dependencies** - Most are MIT/Apache (OK)
3. **Add LICENSE file** - Recommend MIT or GPL-3
4. **Attribution** - Credit Vosk project

## Support & Documentation

For public distribution, add:

- [ ] CONTRIBUTING.md - How others can contribute
- [ ] Issue templates on GitHub
- [ ] FAQ section in README
- [ ] Troubleshooting guide
- [ ] Demo video/GIF
- [ ] Screenshots
- [ ] Changelog

## Current Status

**The app is ready for GitHub distribution NOW!**

Just need to:
1. Push to GitHub
2. Create a release
3. Share with the community

For anything more (Snap, .deb, PPA), it's extra polish but not required for users to benefit from the app.
