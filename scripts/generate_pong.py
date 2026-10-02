import os
import math
import random
from PIL import Image, ImageDraw, ImageFont

def create_pong_simulation():
    W, H = 800, 240
    fps = 25
    total_frames = 72  # ~2.88 seconds seamless loop

    court_top = 42
    court_bottom = 228
    court_left = 24
    court_right = 776
    net_x = W // 2

    # Paddles
    paddle_w = 10
    paddle_h = 48
    p1_x = court_left + 16       # Left paddle
    p2_x = court_right - 16 - paddle_w  # Right paddle

    # Initial ball state
    bx, by = 200.0, 120.0
    vx, vy = 12.0, 5.5
    ball_r = 5.0

    p1_y = 120.0
    p2_y = 120.0

    # Colors
    c_bg = (13, 17, 23)          # #0d1117 GitHub dark
    c_court = (18, 24, 38)       # #121826 Court dark
    c_border = (51, 65, 85)      # #334155
    c_net = (71, 85, 105)        # #475569
    c_grid = (26, 34, 50)        # #1a2232
    
    c_cyan_core = (56, 189, 248) # #38bdf8
    c_cyan_glow = (14, 165, 233) # #0ea5e9
    c_cyan_deep = (3, 105, 161)  # #0369a1
    c_cyan_light = (186, 230, 253)

    c_purp_core = (192, 132, 252) # #c084fc
    c_purp_glow = (147, 51, 234)  # #9333ea
    c_purp_deep = (109, 40, 217)  # #6d28d9
    c_purp_light = (243, 232, 255)

    c_white = (255, 255, 255)
    c_spark = (251, 191, 36)     # Amber spark
    c_live_green = (16, 185, 129)
    c_text_muted = (148, 163, 184)
    c_text_bright = (241, 245, 249)

    frame_history = []
    sparks = []

    # Simulation loop
    for f in range(total_frames):
        bx += vx
        by += vy

        hit = False
        hit_type = None
        hit_x, hit_y = bx, by

        # Wall collisions
        if by - ball_r <= court_top:
            by = court_top + ball_r
            vy = abs(vy)
            hit = True
            hit_type = "wall"
        elif by + ball_r >= court_bottom:
            by = court_bottom - ball_r
            vy = -abs(vy)
            hit = True
            hit_type = "wall"

        # AI tracking paddles
        # P1 (Denis - Cyan)
        target_p1 = by + math.sin(f * 0.15) * 6 if vx < 0 else H / 2 + math.sin(f * 0.1) * 16
        p1_y += (target_p1 - p1_y) * 0.24
        p1_y = max(court_top + paddle_h / 2, min(court_bottom - paddle_h / 2, p1_y))

        # P2 (AI Bot - Purple)
        target_p2 = by - math.cos(f * 0.14) * 6 if vx > 0 else H / 2 - math.cos(f * 0.1) * 16
        p2_y += (target_p2 - p2_y) * 0.24
        p2_y = max(court_top + paddle_h / 2, min(court_bottom - paddle_h / 2, p2_y))

        # P1 Paddle collision
        if vx < 0 and (bx - ball_r <= p1_x + paddle_w) and (bx + ball_r >= p1_x):
            if (p1_y - paddle_h / 2 - 5) <= by <= (p1_y + paddle_h / 2 + 5):
                bx = p1_x + paddle_w + ball_r
                offset = (by - p1_y) / (paddle_h / 2)
                vx = abs(vx)
                vy = offset * 6.5 + math.sin(f) * 0.5
                hit = True
                hit_type = "p1"
                hit_x = p1_x + paddle_w
                hit_y = by

        # P2 Paddle collision
        if vx > 0 and (bx + ball_r >= p2_x) and (bx - ball_r <= p2_x + paddle_w):
            if (p2_y - paddle_h / 2 - 5) <= by <= (p2_y + paddle_h / 2 + 5):
                bx = p2_x - ball_r
                offset = (by - p2_y) / (paddle_h / 2)
                vx = -abs(vx)
                vy = offset * 6.5 + math.cos(f) * 0.5
                hit = True
                hit_type = "p2"
                hit_x = p2_x
                hit_y = by

        # Safety clamp
        if bx < court_left:
            bx = court_left + 10
            vx = abs(vx)
        elif bx > court_right:
            bx = court_right - 10
            vx = -abs(vx)

        # Trigger impact sparks
        if hit:
            num_sparks = 10 if hit_type in ("p1", "p2") else 5
            color = c_cyan_light if hit_type == "p1" else (c_purp_light if hit_type == "p2" else c_spark)
            for _ in range(num_sparks):
                ang = random.uniform(0, math.pi * 2)
                spd = random.uniform(2.0, 5.0)
                sparks.append({
                    "x": hit_x, "y": hit_y,
                    "vx": math.cos(ang) * spd,
                    "vy": math.sin(ang) * spd,
                    "life": 7,
                    "color": color
                })

        # Update sparks
        alive_sparks = []
        for s in sparks:
            s["x"] += s["vx"]
            s["y"] += s["vy"]
            s["life"] -= 1
            if s["life"] > 0:
                alive_sparks.append(s)
        sparks = alive_sparks

        frame_history.append({
            "bx": bx, "by": by,
            "p1_y": p1_y, "p2_y": p2_y,
            "sparks": [dict(s) for s in sparks]
        })

    # Render frames
    print(f"Rendering {total_frames} frames using Pillow...")
    images = []

    # Basic digit font bitmaps for retro scoreboard
    DIGITS_7SEG = {
        '0': ['111', '101', '101', '101', '111'],
        '1': ['010', '110', '010', '010', '111'],
        '2': ['111', '001', '111', '100', '111'],
        '3': ['111', '001', '111', '001', '111'],
        '4': ['101', '101', '111', '001', '001'],
        '5': ['111', '100', '111', '001', '111'],
        '6': ['111', '100', '111', '101', '111'],
        '7': ['111', '001', '010', '010', '010'],
        '8': ['111', '101', '111', '101', '111'],
        '9': ['111', '101', '111', '001', '111']
    }

    def draw_digit(draw, x0, y0, d_char, color, scale=3):
        pattern = DIGITS_7SEG.get(str(d_char), DIGITS_7SEG['0'])
        for r, row in enumerate(pattern):
            for c, bit in enumerate(row):
                if bit == '1':
                    draw.rectangle([x0 + c * scale, y0 + r * scale, x0 + (c + 1) * scale - 1, y0 + (r + 1) * scale - 1], fill=color)

    for f in range(total_frames):
        cur = frame_history[f]
        im = Image.new("RGB", (W, H), c_bg)
        draw = ImageDraw.Draw(im)

        # 1. Court Background
        draw.rounded_rectangle([court_left, court_top, court_right, court_bottom], radius=6, fill=c_court, outline=c_border, width=2)

        # Subtle court grid lines
        for gy in range(court_top + 30, court_bottom, 36):
            draw.line([(court_left + 1, gy), (court_right - 1, gy)], fill=c_grid, width=1)
        for gx in range(court_left + 50, court_right, 60):
            draw.line([(gx, court_top + 1), (gx, court_bottom - 1)], fill=c_grid, width=1)

        # Center Net Line (Dashed)
        for ny in range(court_top + 6, court_bottom - 4, 12):
            draw.line([(net_x, ny), (net_x, ny + 6)], fill=c_net, width=2)

        # Center court circle
        draw.ellipse([net_x - 30, (court_top + court_bottom) // 2 - 30, net_x + 30, (court_top + court_bottom) // 2 + 30], outline=c_grid, width=2)
        draw.ellipse([net_x - 3, (court_top + court_bottom) // 2 - 3, net_x + 3, (court_top + court_bottom) // 2 + 3], fill=c_net)

        # 2. Top HUD Bar
        # P1 Tag & Score (Denis Alves)
        draw.rounded_rectangle([court_left, 10, court_left + 10, 22], radius=2, fill=c_cyan_core)
        draw.text((court_left + 18, 10), "DENIS ALVES [P1]", fill=c_cyan_light)
        draw_digit(draw, court_left + 160, 8, '0', c_cyan_core, scale=3)
        draw_digit(draw, court_left + 174, 8, '7', c_cyan_core, scale=3)

        # Center Tournament Banner
        draw.rounded_rectangle([net_x - 110, 7, net_x + 110, 25], radius=6, fill=(24, 30, 44), outline=c_border, width=1)
        # Live green indicator
        draw.ellipse([net_x - 98, 13, net_x - 90, 21], fill=c_live_green)
        draw.text((net_x - 84, 10), "AUTONOMOUS PONG // AI LIVE", fill=c_text_bright)

        # P2 Tag & Score (AI Bot)
        draw_digit(draw, court_right - 188, 8, '0', c_purp_core, scale=3)
        draw_digit(draw, court_right - 174, 8, '5', c_purp_core, scale=3)
        draw.text((court_right - 150, 10), "AI BOT [P2]", fill=c_purp_light)
        draw.rounded_rectangle([court_right - 10, 10, court_right, 22], radius=2, fill=c_purp_core)

        # 3. Motion Trail behind Ball
        for t in range(1, 6):
            if f - t >= 0:
                past = frame_history[f - t]
                tr_r = max(1, int(ball_r - t * 0.7))
                factor = (6 - t) / 6.0
                tr_col = (
                    int(c_cyan_glow[0] * factor + c_court[0] * (1 - factor)),
                    int(c_cyan_glow[1] * factor + c_court[1] * (1 - factor)),
                    int(c_cyan_glow[2] * factor + c_court[2] * (1 - factor))
                )
                draw.ellipse([past["bx"] - tr_r, past["by"] - tr_r, past["bx"] + tr_r, past["by"] + tr_r], fill=tr_col)

        # 4. Pong Ball
        cbx, cby = cur["bx"], cur["by"]
        # Outer glow
        draw.ellipse([cbx - ball_r - 4, cby - ball_r - 4, cbx + ball_r + 4, cby + ball_r + 4], fill=c_cyan_deep)
        draw.ellipse([cbx - ball_r - 2, cby - ball_r - 2, cbx + ball_r + 2, cby + ball_r + 2], fill=c_cyan_glow)
        # Inner core
        draw.ellipse([cbx - ball_r, cby - ball_r, cbx + ball_r, cby + ball_r], fill=c_white)

        # 5. Left Paddle (Denis - Cyan)
        p1_top = cur["p1_y"] - paddle_h / 2
        p1_bot = cur["p1_y"] + paddle_h / 2
        # Glow
        draw.rounded_rectangle([p1_x - 3, p1_top - 2, p1_x + paddle_w + 3, p1_bot + 2], radius=4, fill=c_cyan_deep)
        draw.rounded_rectangle([p1_x, p1_top, p1_x + paddle_w, p1_bot], radius=3, fill=c_cyan_core)
        draw.line([(p1_x + 3, p1_top + 4), (p1_x + 3, p1_bot - 4)], fill=c_cyan_light, width=2)

        # 6. Right Paddle (AI Bot - Purple)
        p2_top = cur["p2_y"] - paddle_h / 2
        p2_bot = cur["p2_y"] + paddle_h / 2
        # Glow
        draw.rounded_rectangle([p2_x - 3, p2_top - 2, p2_x + paddle_w + 3, p2_bot + 2], radius=4, fill=c_purp_deep)
        draw.rounded_rectangle([p2_x, p2_top, p2_x + paddle_w, p2_bot], radius=3, fill=c_purp_core)
        draw.line([(p2_x + paddle_w - 3, p2_top + 4), (p2_x + paddle_w - 3, p2_bot - 4)], fill=c_purp_light, width=2)

        # 7. Impact Sparks
        for s in cur["sparks"]:
            sx, sy = int(s["x"]), int(s["y"])
            if 0 <= sx < W and 0 <= sy < H:
                draw.rectangle([sx - 1, sy - 1, sx + 1, sy + 1], fill=s["color"])

        images.append(im)

    # Save GIF
    output_dir = os.path.join(os.path.dirname(__file__), "..", "assets")
    os.makedirs(output_dir, exist_ok=True)
    gif_path = os.path.join(output_dir, "pong.gif")
    anim_path = os.path.join(output_dir, "animation.gif")

    print("Encoding GIF with Pillow...")
    images[0].save(
        gif_path,
        save_all=True,
        append_images=images[1:],
        duration=int(1000 / fps),
        loop=0,
        optimize=True
    )
    # Also mirror to animation.gif
    images[0].save(
        anim_path,
        save_all=True,
        append_images=images[1:],
        duration=int(1000 / fps),
        loop=0,
        optimize=True
    )

    size_kb = os.path.getsize(gif_path) / 1024
    print(f"GIF successfully created: {gif_path} ({size_kb:.2f} KB)")
    print(f"Mirrored to: {anim_path}")

if __name__ == "__main__":
    create_pong_simulation()
