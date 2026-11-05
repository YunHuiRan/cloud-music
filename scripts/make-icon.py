"""Generate the Cloud Music app icon (PNG + Windows ICO) with Pillow."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZE = 1024
SCALE = 2
CANVAS = SIZE * SCALE

background_top = (79, 124, 255)
background_bottom = (123, 97, 255)
cream = (255, 255, 255)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


icon = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

# Soft vertical gradient inside a squircle-ish rounded square.
gradient = Image.new("RGBA", (CANVAS, CANVAS))
pixels = gradient.load()
for y in range(CANVAS):
    mix = y / (CANVAS - 1)
    color = tuple(
        round(background_top[i] * (1 - mix) + background_bottom[i] * mix)
        for i in range(3)
    )
    for x in range(CANVAS):
        pixels[x, y] = (*color, 255)

icon.paste(gradient, (0, 0), rounded_mask(CANVAS, int(CANVAS * 0.235)))

draw = ImageDraw.Draw(icon)

# A five-bar equalizer, white on the blue-violet brand gradient.
bar_width = int(CANVAS * 0.052)
gap = int(CANVAS * 0.062)
heights = [0.20, 0.34, 0.46, 0.34, 0.20]
total_width = len(heights) * bar_width + (len(heights) - 1) * gap
start_x = (CANVAS - total_width) / 2
center_y = CANVAS / 2
for index, ratio in enumerate(heights):
    height = CANVAS * ratio
    x0 = start_x + index * (bar_width + gap)
    y0 = center_y - height / 2
    draw.rounded_rectangle(
        (x0, y0, x0 + bar_width, y0 + height),
        radius=bar_width / 2,
        fill=cream,
    )

# A small basin shadow grounds the mark without adding another shape.

icon = icon.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
icon.save(ROOT / "icon.png")

build_dir = ROOT / "build"
build_dir.mkdir(exist_ok=True)
icon.save(
    build_dir / "icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print(f"wrote {ROOT / 'icon.png'} and {build_dir / 'icon.ico'}")
