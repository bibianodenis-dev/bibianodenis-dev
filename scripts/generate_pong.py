import os
import math
import random
from PIL import Image, ImageDraw

def generate_commit_pong():
    W, H = 800, 240
    fps = 25
    total_frames = 76  # ~3.04 seconds loop

    # Colors
    c_bg = (13, 17, 23)          # #0d1117 GitHub Dark
    c_court = (15, 20, 30)       # #0f141e
    c_border = (48, 54, 61)      # #30363d
    c_text_bright = (240, 246, 252)
    c_text_muted = (139, 148, 158)
    
    # GitHub Commit Heatmap Colors
    c_lvl0 = (22, 27, 34)        # #161b22 (0 commits)
    c_lvl0_b = (33, 38, 45)      # #21262d (subtle border)
    c_lvl1 = (14, 68, 41)        # #0e4429 (1-3 commits)
    c_lvl2 = (0, 109, 50)        # #006d32 (4-6 commits)
    c_lvl3 = (38, 166, 65)       # #26a641 (7-9 commits)
    c_lvl4 = (57, 211, 83)       # #39d353 (10+ commits)
    c_lvl_flash = (175, 245, 180)# #aff5b4 (impact flash)

    # Paddle & Ball Colors
    c_p1_core = (56, 189, 248)   # #38bdf8 Cyan
    c_p1_glow = (14, 165, 233)   # #0ea5e9
    c_p1_deep = (3, 105, 161)
    c_p1_light = (186, 230, 253)

    c_p2_core = (192, 132, 252)  # #c084fc Purple
    c_p2_glow = (147, 51, 234)   # #9333ea
    c_p2_deep = (109, 40, 217)
    c_p2_light = (243, 232, 255)

    c_ball_core = (255, 255, 255)
    c_ball_glow = (56, 189, 248)

    # Geometry
    court_top = 42
    court_bottom = 228
    court_left = 20
    court_right = 780
    net_x = W // 2

    # Paddles
    paddle_w = 10
    paddle_h = 50
    p1_x = court_left + 14
    p2_x = court_right - 14 - paddle_w

    # GitHub Commit Grid Setup
    # 7 rows (Days: Sun - Sat)
    # 26 columns (Weeks)
    cols = 26
    rows = 7
    grid_start_x = 98
    grid_start_y = 52
    cell_w = 19
    cell_h = 21
    gap_x = 4
    gap_y = 4

    # Initial Commit Distribution pattern (resembling active developer heatmap)
    initial_levels = {}
    random.seed(42)  # Consistent baseline
    for r in range(rows):
        for c in range(cols):
            # Weekday bias + project clusters
            prob = random.random()
            if r in (1, 2, 3, 4):  # Weekdays have more commits
                if prob < 0.22:
                    lvl = 0
                elif prob < 0.48:
                    lvl = 1
                elif prob < 0.75:
                    lvl = 2
                elif prob < 0.90:
                    lvl = 3
                else:
                    lvl = 4
            else:  # Weekends
                if prob < 0.50:
                    lvl = 0
                elif prob < 0.75:
                    lvl = 1
                elif prob < 0.92:
                    lvl = 2
                else:
                    lvl = 3
            initial_levels[(r, c)] = lvl

    # Ball physical trajectory
    bx, by = 160.0, 110.0
    vx, vy = 12.8, 6.2
    ball_r = 5.0

    p1_y = 110.0
    p2_y = 130.0

    hit_cells = {}   # (r, c) -> frame_hit
    sparks = []
    frames_data = []

    base_commits = 842

    for f in range(total_frames):
        bx += vx
        by += vy

        hit = False
        hit_type = None
        hit_x, hit_y = bx, by

        # Wall collisions (top / bottom)
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
        target_p1 = by + math.sin(f * 0.18) * 8 if vx < 0 else H / 2 + math.sin(f * 0.12) * 18
        p1_y += (target_p1 - p1_y) * 0.25
        p1_y = max(court_top + paddle_h / 2, min(court_bottom - paddle_h / 2, p1_y))

        target_p2 = by - math.cos(f * 0.16) * 8 if vx > 0 else H / 2 - math.cos(f * 0.12) * 18
        p2_y += (target_p2 - p2_y) * 0.25
        p2_y = max(court_top + paddle_h / 2, min(court_bottom - paddle_h / 2, p2_y))

        # Paddle 1 collision (Left)
        if vx < 0 and (bx - ball_r <= p1_x + paddle_w) and (bx + ball_r >= p1_x):
            if (p1_y - paddle_h / 2 - 6) <= by <= (p1_y + paddle_h / 2 + 6):
                bx = p1_x + paddle_w + ball_r
                offset = (by - p1_y) / (paddle_h / 2)
                vx = abs(vx)
                vy = offset * 7.2 + math.sin(f * 0.5) * 0.6
                hit = True
                hit_type = "p1"
                hit_x = p1_x + paddle_w
                hit_y = by

        # Paddle 2 collision (Right)
        if vx > 0 and (bx + ball_r >= p2_x) and (bx - ball_r <= p2_x + paddle_w):
            if (p2_y - paddle_h / 2 - 6) <= by <= (p2_y + paddle_h / 2 + 6):
                bx = p2_x - ball_r
                offset = (by - p2_y) / (paddle_h / 2)
                vx = -abs(vx)
                vy = offset * 7.2 + math.cos(f * 0.5) * 0.6
                hit = True
                hit_type = "p2"
                hit_x = p2_x
                hit_y = by

        # Bounds safety
        if bx < court_left:
            bx = court_left + 10
            vx = abs(vx)
        elif bx > court_right:
            bx = court_right - 10
            vx = -abs(vx)

        # Collision / Activation with Commit Heatmap Blocks
        # Check which cell ball intersects
        col_idx = int((bx - grid_start_x) / (cell_w + gap_x))
        row_idx = int((by - grid_start_y) / (cell_h + gap_y))

        if 0 <= col_idx < cols and 0 <= row_idx < rows:
            cell_key = (row_idx, col_idx)
            cx0 = grid_start_x + col_idx * (cell_w + gap_x)
            cy0 = grid_start_y + row_idx * (cell_h + gap_y)
            if cx0 <= bx <= cx0 + cell_w and cy0 <= by <= cy0 + cell_h:
                if cell_key not in hit_cells or (f - hit_cells[cell_key] > 20):
                    hit_cells[cell_key] = f
                    # Spark on commit hit
                    for _ in range(6):
                        ang = random.uniform(0, math.pi * 2)
                        spd = random.uniform(1.5, 4.0)
                        sparks.append({
                            "x": bx, "y": by,
                            "vx": math.cos(ang) * spd,
                            "vy": math.sin(ang) * spd,
                            "life": 6,
                            "color": c_lvl4
                        })

        # Sparks on paddle hits
        if hit and hit_type in ("p1", "p2", "wall"):
            spark_col = c_p1_light if hit_type == "p1" else (c_p2_light if hit_type == "p2" else c_lvl3)
            num_sparks = 12 if hit_type in ("p1", "p2") else 5
            for _ in range(num_sparks):
                ang = random.uniform(0, math.pi * 2)
                spd = random.uniform(2.0, 5.0)
                sparks.append({
                    "x": hit_x, "y": hit_y,
                    "vx": math.cos(ang) * spd,
                    "vy": math.sin(ang) * spd,
                    "life": 8,
                    "color": spark_col
                })

        # Update active sparks
        surviving = []
        for s in sparks:
            s["x"] += s["vx"]
            s["y"] += s["vy"]
            s["life"] -= 1
            if s["life"] > 0:
                surviving.append(s)
        sparks = surviving

        commits_added = sum(1 for k, hf in hit_cells.items() if hf <= f)

        frames_data.append({
            "bx": bx, "by": by,
            "p1_y": p1_y, "p2_y": p2_y,
            "commits": base_commits + commits_added,
            "sparks": [dict(s) for s in sparks],
            "hit_cells": dict(hit_cells)
        })

    print(f"Rendering {total_frames} commit-pong frames with Pillow...")

    # Digit renderer for score & commits
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

    def draw_num(draw, x0, y0, num_str, color, scale=2):
        cx = x0
        for ch in str(num_str):
            pat = DIGITS_7SEG.get(ch, DIGITS_7SEG['0'])
            for r, row in enumerate(pat):
                for c, bit in enumerate(row):
                    if bit == '1':
                        draw.rectangle([cx + c * scale, y0 + r * scale, cx + (c + 1) * scale - 1, y0 + (r + 1) * scale - 1], fill=color)
            cx += 4 * scale

    lvl_colors = [c_lvl0, c_lvl1, c_lvl2, c_lvl3, c_lvl4]

    images = []

    for f in range(total_frames):
        cur = frames_data[f]
        im = Image.new("RGB", (W, H), c_bg)
        draw = ImageDraw.Draw(im)

        # 1. Court Arena
        draw.rounded_rectangle([court_left, court_top, court_right, court_bottom], radius=6, fill=c_court, outline=c_border, width=2)

        # Center dashed line
        for ny in range(court_top + 4, court_bottom - 4, 12):
            draw.line([(net_x, ny), (net_x, ny + 6)], fill=(33, 40, 54), width=1)

        # 2. GitHub Commit Grid Cells (Heatmap)
        for r in range(rows):
            for c in range(cols):
                cx0 = grid_start_x + c * (cell_w + gap_x)
                cy0 = grid_start_y + r * (cell_h + gap_y)
                cx1 = cx0 + cell_w
                cy1 = cy0 + cell_h

                key = (r, c)
                base_lvl = initial_levels[key]

                # Check if hit / active
                is_hit = key in cur["hit_cells"] and cur["hit_cells"][key] <= f
                if is_hit:
                    hit_f = cur["hit_cells"][key]
                    age = f - hit_f
                    if age < 4:
                        cell_fill = c_lvl_flash
                        cell_outline = c_lvl4
                    elif age < 12:
                        cell_fill = c_lvl4
                        cell_outline = c_lvl3
                    else:
                        cell_fill = c_lvl3
                        cell_outline = None
                else:
                    cell_fill = lvl_colors[base_lvl]
                    cell_outline = c_lvl0_b if base_lvl == 0 else None

                draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=3, fill=cell_fill, outline=cell_outline, width=1)

        # 3. Top HUD Bar
        # P1 Badge & Score (Denis Alves)
        draw.rounded_rectangle([court_left, 10, court_left + 10, 22], radius=2, fill=c_p1_core)
        draw.text((court_left + 18, 10), "DENIS ALVES [P1]", fill=c_p1_light)
        draw_num(draw, court_left + 155, 8, "07", c_p1_core, scale=3)

        # Center HUD: Commit Counter & GitHub Heatmap Status
        hud_w = 270
        hud_x0 = net_x - hud_w // 2
        draw.rounded_rectangle([hud_x0, 6, hud_x0 + hud_w, 26], radius=6, fill=(20, 26, 38), outline=c_border, width=1)
        
        # Pulsing green dot
        pulse_r = 3 if (f // 6) % 2 == 0 else 4
        draw.ellipse([hud_x0 + 10 - pulse_r, 16 - pulse_r, hud_x0 + 10 + pulse_r, 16 + pulse_r], fill=c_lvl4)
        
        draw.text((hud_x0 + 20, 10), "COMMITS:", fill=c_text_bright)
        draw_num(draw, hud_x0 + 90, 9, str(cur["commits"]), c_lvl4, scale=2)

        # GitHub Legend "Less [ ] More"
        draw.text((hud_x0 + 155, 10), "Less", fill=c_text_muted)
        for i, col in enumerate(lvl_colors):
            draw.rectangle([hud_x0 + 188 + i * 9, 12, hud_x0 + 188 + i * 9 + 6, 18], fill=col)
        draw.text((hud_x0 + 238, 10), "More", fill=c_text_muted)

        # P2 Badge & Score (AI Bot)
        draw_num(draw, court_right - 180, 8, "05", c_p2_core, scale=3)
        draw.text((court_right - 145, 10), "AI BOT [P2]", fill=c_p2_light)
        draw.rounded_rectangle([court_right - 10, 10, court_right, 22], radius=2, fill=c_p2_core)

        # 4. Ball Motion Trail
        for t in range(1, 6):
            if f - t >= 0:
                past = frames_data[f - t]
                tr_r = max(1, int(ball_r - t * 0.7))
                draw.ellipse([past["bx"] - tr_r, past["by"] - tr_r, past["bx"] + tr_r, past["by"] + tr_r], fill=c_p1_glow)

        # 5. Glowing Pong Ball
        cbx, cby = cur["bx"], cur["by"]
        draw.ellipse([cbx - ball_r - 4, cby - ball_r - 4, cbx + ball_r + 4, cby + ball_r + 4], fill=c_p1_deep)
        draw.ellipse([cbx - ball_r - 2, cby - ball_r - 2, cbx + ball_r + 2, cby + ball_r + 2], fill=c_ball_glow)
        draw.ellipse([cbx - ball_r, cby - ball_r, cbx + ball_r, cby + ball_r], fill=c_ball_core)

        # 6. Left Paddle (Denis - Cyan)
        p1_t = cur["p1_y"] - paddle_h / 2
        p1_b = cur["p1_y"] + paddle_h / 2
        draw.rounded_rectangle([p1_x - 3, p1_t - 2, p1_x + paddle_w + 3, p1_b + 2], radius=4, fill=c_p1_deep)
        draw.rounded_rectangle([p1_x, p1_t, p1_x + paddle_w, p1_b], radius=3, fill=c_p1_core)
        draw.line([(p1_x + 3, p1_t + 4), (p1_x + 3, p1_b - 4)], fill=c_p1_light, width=2)

        # 7. Right Paddle (AI Bot - Purple)
        p2_t = cur["p2_y"] - paddle_h / 2
        p2_b = cur["p2_y"] + paddle_h / 2
        draw.rounded_rectangle([p2_x - 3, p2_t - 2, p2_x + paddle_w + 3, p2_b + 2], radius=4, fill=c_p2_deep)
        draw.rounded_rectangle([p2_x, p2_t, p2_x + paddle_w, p2_b], radius=3, fill=c_p2_core)
        draw.line([(p2_x + paddle_w - 3, p2_t + 4), (p2_x + paddle_w - 3, p2_b - 4)], fill=c_p2_light, width=2)

        # 8. Sparks
        for s in cur["sparks"]:
            sx, sy = int(s["x"]), int(s["y"])
            if 0 <= sx < W and 0 <= sy < H:
                draw.rectangle([sx - 1, sy - 1, sx + 1, sy + 1], fill=s["color"])

        images.append(im)

    # Save to disk
    output_dir = os.path.join(os.path.dirname(__file__), "..", "assets")
    os.makedirs(output_dir, exist_ok=True)
    gif_path = os.path.join(output_dir, "pong.gif")
    anim_path = os.path.join(output_dir, "animation.gif")

    print("Saving commit-pong simulation GIF...")
    images[0].save(
        gif_path,
        save_all=True,
        append_images=images[1:],
        duration=int(1000 / fps),
        loop=0,
        optimize=True
    )
    images[0].save(
        anim_path,
        save_all=True,
        append_images=images[1:],
        duration=int(1000 / fps),
        loop=0,
        optimize=True
    )

    size_kb = os.path.getsize(gif_path) / 1024
    print(f"Commit Pong GIF created successfully: {gif_path} ({size_kb:.2f} KB)")

if __name__ == "__main__":
    generate_commit_pong()
