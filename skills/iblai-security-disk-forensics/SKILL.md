---
name: iblai-security-disk-forensics
description: "Analyze disk images and file systems for digital evidence recovery in forensic investigations and CTF challenges. Use when the user mentions 'disk forensics,' 'forensic analysis,' 'disk image,' 'file carving,' 'deleted files,' 'evidence recovery,' 'autopsy,' 'sleuthkit,' or needs to examine a forensic image."
globs:
alwaysApply: false
allowed-tools: Bash, Read, Write, Grep, Glob
---

# /iblai-security-disk-forensics

Analyze disk images and file systems to recover evidence, reconstruct
timelines, and identify artifacts.

Do NOT touch the original. Mount everything read-only. Never modify
timestamps or content on source evidence.

## Evidence Handling

- Work on copies, never originals.
- Verify image integrity with hash comparison before analysis.
- Mount read-only — every time.
- Log every command and finding.
- Preserve timestamps.

## Step 1: Image Identification and Integrity

Identify the format and confirm integrity:

```bash
file <image>                    # Identify format (E01, dd/raw, VMDK, VHD)
sha256sum <image>               # Compare to provided hash
```

For E01 images, use `ewfinfo` to pull metadata.

## Step 2: Partition Layout

Inspect the partition structure:

```bash
fdisk -l <image>                # Partition table
mmls <image>                    # Sleuth Kit partition layout
```

Mount offsets: `sector_start × sector_size`.

## Step 3: Mount and Explore

Read-only mount, then survey:

```bash
mount -o ro,loop,offset=<bytes> <image> /mnt/evidence
ls -laR /mnt/evidence
```

For encrypted volumes, identify the encryption type and request the
key/passphrase from the user.

## Step 4: File System Analysis (Sleuth Kit)

```bash
fsstat -o <offset> <image>              # File system details
fls -r -o <offset> <image>             # Full file listing (deleted files marked with *)
icat -o <offset> <image> <inode>       # Extract specific file by inode
```

## Step 5: Artifact Recovery

**Deleted files:** `fls` to locate (marked with `*`), `icat` to extract
by inode.

**File carving:** `foremost` or `scalpel` on unallocated space to
recover files by header signatures.

**Hidden data:**

- NTFS alternate data streams
- HFS+ resource forks
- Steganography checks on images: `exiftool`, `binwalk`, `steghide`

**System artifacts:**

- Browser history: `~/.mozilla`, `~/Library/Safari`, `AppData\Local\Google`
- System logs: `/var/log/*`, Windows Event Logs
- Registry hives (Windows): SAM, SYSTEM, SOFTWARE, NTUSER.DAT
- Recently accessed files, USB device history, prefetch files

## Step 6: Metadata and Timestamps

```bash
exiftool <file>                 # EXIF, XMP, IPTC metadata
stat <file>                     # MAC times (Modified, Accessed, Changed)
```

NTFS: inspect `$MFT` timestamps and `$UsnJrnl` change-journal entries.

Use `mactime` (Sleuth Kit) to build a unified timeline from body
files.

## Step 7: Keyword Search

```bash
strings <image> | grep -i <keyword>    # Raw string search across image
```

Use `bulk_extractor` for automated extraction of emails, URLs, credit
card numbers, and other structured data.

## Step 8: Timeline Construction

Collect every timestamp into a single timeline. Cross-reference file
events with log entries. Flag anomalies:

- Timestamps before the OS install date
- Future-dated files
- Gaps in otherwise continuous log sequences
- Timestamps inconsistent with timezone settings

## Output Format

```markdown
# Forensic Analysis Report
## Case: [identifier]
## Image: [filename] — SHA256: [hash]
## Date of Analysis: [date]

### Image Integrity
- Hash verified: [yes/no]
- Algorithm: [SHA256]

### Partition Layout
| # | Type | Start | Size | File System |
|---|------|-------|------|-------------|

### Key Findings
#### Finding 1: [Title]
- **Evidence:** [file path or artifact]
- **Content:** [description]
- **Timestamp:** [UTC]
- **Significance:** [why this matters]

### Recovered Files
| File | Source | Recovery Method | SHA256 | Significance |
|------|--------|-----------------|--------|-------------|

### Timeline
| Timestamp (UTC) | Event | Source | Notes |
|-----------------|-------|--------|-------|

### Conclusions
[Summary of findings and their implications]
```

## Boundaries

- Work only on provided images and files.
- Read-only at all times.
- Document chain of custody for real investigations.
- For CTF challenges, focus on finding flags and solving the challenge.
- Never modify evidence or suggest evidence tampering.
- Refuse requests involving unauthorized device access.

## References

- NIST SP 800-86: Guide to Integrating Forensic Techniques
- The Sleuth Kit documentation
- SANS Digital Forensics cheat sheets
