# Font Sources for RGX-Framework

Fonts must be downloaded manually and placed in `media/fonts/` before packaging.

## Available Fonts

### Roboto (Apache 2.0)
**Source:** https://github.com/google/fonts/tree/main/apache/roboto

```bash
# Download from GitHub
curl -L -o Roboto-Regular.ttf \
  "https://github.com/google/fonts/raw/main/apache/roboto/Roboto%5Bwdth,wght%5D.ttf"
```

Note: This is a variable font file containing all weights.

### Open Sans (OFL 1.1)
**Source:** https://github.com/google/fonts/tree/main/ofl/opensans

```bash
curl -L -o OpenSans-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/opensans/OpenSans%5Bwdth,wght%5D.ttf"
```

### Inter (OFL 1.1)
**Source:** https://github.com/rsms/inter/releases

```bash
curl -L -o Inter-4.0.zip \
  "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip"
# Extract OTF files from the zip
```

### Fira Code (OFL 1.1)
**Source:** https://github.com/tonsky/FiraCode/releases

```bash
curl -L -o Fira_Code_v6.2.zip \
  "https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip"
# Extract TTF files from ttf/ folder
```

### JetBrains Mono (OFL 1.1)
**Source:** https://github.com/JetBrains/JetBrainsMono/releases

```bash
curl -L -o JetBrainsMono-2.304.zip \
  "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip"
# Extract TTF files from fonts/ttf/ folder
```

### Bebas Neue (OFL 1.1)
**Source:** https://github.com/google/fonts/tree/main/ofl/bebasneue

```bash
curl -L -o BebasNeue-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf"
```

## Manual Download

1. Download fonts from sources above
2. Extract if needed
3. Copy TTF/OTF files to `RGX-Framework/media/fonts/`
4. Update `modules/fonts/fonts.lua` to match your file names

## WoW Default Fonts (Always Available)

These are built into WoW and always available:
- `Fonts/FRIZQT__.TTF` - Friz Quadrata (default UI font)
- `Fonts/ARIALN.TTF` - Arial Narrow
- `Fonts/skurri.ttf` - Skurri
- `Fonts/MORPHEUS.ttf` - Morpheus

## License Notes

- **Apache 2.0** - Roboto
- **OFL 1.1** - Open Sans, Inter, Fira Code, JetBrains Mono, Bebas Neue

All fonts are open source and free to redistribute.
