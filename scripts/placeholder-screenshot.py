#!/usr/bin/env python3
"""Write a 1440x900 placeholder PNG (pure Python, no PIL) that says the real
screenshot is pending. Used until scripts/capture-screenshots.mjs runs.

    python3 scripts/placeholder-screenshot.py <out.png> [<out2.png> ...]
"""
import struct, sys, zlib

W, H = 1440, 900
BG, BAR, INK = (250, 251, 252), (0, 88, 204), (55, 65, 81)

# 5x7 bitmap glyphs for the message; 1 = ink.
F = {
 "A": ["01110","10001","10001","11111","10001","10001","10001"],
 "C": ["01110","10001","10000","10000","10000","10001","01110"],
 "D": ["11110","10001","10001","10001","10001","10001","11110"],
 "E": ["11111","10000","10000","11110","10000","10000","11111"],
 "G": ["01110","10001","10000","10111","10001","10001","01111"],
 "H": ["10001","10001","10001","11111","10001","10001","10001"],
 "I": ["11111","00100","00100","00100","00100","00100","11111"],
 "J": ["00111","00010","00010","00010","00010","10010","01100"],
 "M": ["10001","11011","10101","10101","10001","10001","10001"],
 "N": ["10001","11001","10101","10011","10001","10001","10001"],
 "O": ["01110","10001","10001","10001","10001","10001","01110"],
 "P": ["11110","10001","10001","11110","10000","10000","10000"],
 "R": ["11110","10001","10001","11110","10100","10010","10001"],
 "S": ["01111","10000","10000","01110","00001","00001","11110"],
 "T": ["11111","00100","00100","00100","00100","00100","00100"],
 "U": ["10001","10001","10001","10001","10001","10001","01110"],
 "-": ["00000","00000","00000","11111","00000","00000","00000"],
 ".": ["00000","00000","00000","00000","00000","01100","01100"],
 "/": ["00001","00010","00100","01000","10000","00000","00000"],
 " ": ["00000"]*7,
}
LINES = ["SCREENSHOT PENDING", "RUN SCRIPTS/CAPTURE-SCREENSHOTS.MJS", "THEN COMMIT THE REAL IMAGE"]

def render():
    px = bytearray()
    rows = [bytearray(BG * W) for _ in range(H)]
    for y in range(0, 72):  # brand bar
        rows[y] = bytearray(BAR * W)
    scale = 5
    y0 = 360
    for li, text in enumerate(LINES):
        glyph_w = 6 * scale
        x0 = (W - len(text) * glyph_w) // 2
        for ci, ch in enumerate(text):
            g = F.get(ch, F[" "])
            for gy, row in enumerate(g):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        for dy in range(scale):
                            r = rows[y0 + li * 70 + gy * scale + dy]
                            for dx in range(scale):
                                x = x0 + ci * glyph_w + gx * scale + dx
                                r[x*3:x*3+3] = bytes(INK)
    for r in rows:
        px += b"\x00" + r
    return bytes(px)

def png(data):
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(data, 9)) + chunk(b"IEND", b""))

if __name__ == "__main__":
    blob = png(render())
    for out in sys.argv[1:]:
        with open(out, "wb") as f:
            f.write(blob)
        print("wrote", out, len(blob), "bytes")
