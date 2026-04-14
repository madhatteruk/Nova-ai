#!/usr/bin/env python3
"""Generate PNG icons for all Nova Chrome extensions using only stdlib."""
import struct, zlib, os

def make_png(size, r, g, b, r2=None, g2=None, b2=None):
    """Create a simple gradient/solid PNG icon."""
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(size):
        raw += b'\x00'
        for x in range(size):
            # Rounded corner mask
            cx, cy = x - size/2, y - size/2
            rad = size * 0.18
            corner = size/2 - rad
            in_corner = abs(cx) > corner and abs(cy) > corner
            dist = ((abs(cx) - corner)**2 + (abs(cy) - corner)**2)**0.5
            if in_corner and dist > rad:
                raw += bytes([240, 240, 240])  # background
            else:
                # gradient
                t = y / size
                if r2 is not None:
                    pr = int(r + (r2-r)*t)
                    pg = int(g + (g2-g)*t)
                    pb = int(b + (b2-b)*t)
                else:
                    pr, pg, pb = r, g, b
                raw += bytes([pr, pg, pb])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

extensions = {
    'nova-grammar': (99, 102, 241, 79, 70, 229),   # indigo gradient
    'nova-tab':     (16, 185, 129, 5, 150, 105),    # emerald gradient
    'nova-recorder':(239, 68, 68, 220, 38, 38),     # red gradient
    'nova-ai':      (245, 158, 11, 217, 119, 6),    # amber gradient
}

base = os.path.dirname(os.path.abspath(__file__))
for ext, (r,g,b,r2,g2,b2) in extensions.items():
    icons_dir = os.path.join(base, ext, 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    for size in [16, 32, 48, 128]:
        data = make_png(size, r, g, b, r2, g2, b2)
        path = os.path.join(icons_dir, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(data)
        print(f'  Created {path}')

print('\nAll icons generated successfully!')
