import os
import math
from PIL import Image, ImageDraw

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = bbox
    if x1 - x0 < 2 * radius:
        radius = (x1 - x0) // 2
    if y1 - y0 < 2 * radius:
        radius = (y1 - y0) // 2
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def generate_tech_animation():
    # Dimension & Frame Setup
    width, height = 760, 220
    fps = 25
    duration_sec = 3.6
    total_frames = int(fps * duration_sec)

    # Grid Setup (16 cols x 6 rows)
    cols, rows = 16, 6
    padding_x, padding_y = 30, 25
    block_gap = 8
    
    grid_w = (width - 2 * padding_x - (cols - 1) * block_gap) / cols
    grid_h = (height - 2 * padding_y - (rows - 1) * block_gap) / rows
    block_radius = 4

    # Initial Block States (Row, Col) -> green blocks
    initial_green = {
        (1, 2), (1, 3), (1, 7), (1, 8), (1, 12), (1, 13),
        (2, 4), (2, 5), (2, 9), (2, 10),
        (3, 1), (3, 6), (3, 11), (3, 14),
        (4, 3), (4, 4), (4, 8), (4, 9), (4, 12), (4, 13)
    }

    ball_positions = []
    # Ball bouncing within boundaries
    bx, by = padding_x + 40, padding_y + 30
    vx, vy = 6.2, 4.5

    min_x, max_x = padding_x + 10, width - padding_x - 10
    min_y, max_y = padding_y + 10, height - padding_y - 10

    # Keep track of active blocks state over time
    active_blocks = set(initial_green)
    hit_events = {} # (row, col) -> frame_hit

    # Pre-pass simulation for collision detection
    sim_bx, sim_by = bx, by
    sim_vx, sim_vy = vx, vy

    for f in range(total_frames):
        sim_bx += sim_vx
        sim_by += sim_vy

        if sim_bx <= min_x or sim_bx >= max_x:
            sim_vx *= -1
            sim_bx = max(min_x, min(sim_bx, max_x))
        if sim_by <= min_y or sim_by >= max_y:
            sim_vy *= -1
            sim_by = max(min_y, min(sim_by, max_y))

        ball_positions.append((sim_bx, sim_by))

        # Check collision with blocks
        col_idx = int((sim_bx - padding_x) / (grid_w + block_gap))
        row_idx = int((sim_by - padding_y) / (grid_h + block_gap))

        if 0 <= col_idx < cols and 0 <= row_idx < rows:
            block_key = (row_idx, col_idx)
            if block_key not in hit_events:
                # Hit occurs!
                hit_events[block_key] = f
                active_blocks.add(block_key)
                
                # Activate neighbors as a chain effect
                for dr in [-1, 0, 1]:
                    for dc in [-1, 0, 1]:
                        nr, nc = row_idx + dr, col_idx + dc
                        if 0 <= nr < rows and 0 <= nc < cols:
                            n_key = (nr, nc)
                            if n_key not in hit_events and (abs(dr) + abs(dc) == 1):
                                if (f + 8) < total_frames:
                                    hit_events[n_key] = f + 6

    # Colors
    bg_color = (13, 17, 23)        # #0d1117 GitHub Dark
    gray_block = (33, 38, 45)      # #21262d Dark Gray
    green_active = (35, 134, 54)   # #238636 GitHub Green
    green_bright = (86, 211, 100)  # #56d364 Bright Pulse
    blue_ball = (56, 189, 248)     # #38bdf8 Glowing Cyan/Blue
    blue_trail = (14, 165, 233)    # #0ea5e9

    frames = []

    # Render Frames
    for f in range(total_frames):
        img = Image.new("RGB", (width, height), bg_color)
        draw = ImageDraw.Draw(img)

        # 1. Draw Subtle Tech Grid Background lines
        for r in range(rows + 1):
            y = padding_y + r * (grid_h + block_gap) - block_gap // 2
            draw.line([(0, y), (width, y)], fill=(22, 27, 34), width=1)
        for c in range(cols + 1):
            x = padding_x + c * (grid_w + block_gap) - block_gap // 2
            draw.line([(x, 0), (x, height)], fill=(22, 27, 34), width=1)

        # 2. Draw Blocks
        for r in range(rows):
            for c in range(cols):
                bx0 = padding_x + c * (grid_w + block_gap)
                by0 = padding_y + r * (grid_h + block_gap)
                bx1 = bx0 + grid_w
                by1 = by0 + grid_h

                key = (r, c)
                is_active = key in initial_green or (key in hit_events and hit_events[key] <= f)
                
                # Default style
                fill = green_active if is_active else gray_block
                outline = None
                
                # Check for hit pulse/expansion animation
                if key in hit_events:
                    hit_f = hit_events[key]
                    if hit_f <= f < hit_f + 12:
                        progress = (f - hit_f) / 12.0
                        scale = 1.0 + 0.25 * math.sin(progress * math.pi)
                        cw = (bx1 - bx0) / 2
                        ch = (by1 - by0) / 2
                        cx, cy = bx0 + cw, by0 + ch
                        
                        bx0 = cx - cw * scale
                        bx1 = cx + cw * scale
                        by0 = cy - ch * scale
                        by1 = cy + ch * scale

                        flash_val = int(255 * math.sin(progress * math.pi))
                        fill = (
                            min(255, green_bright[0] + flash_val // 3),
                            min(255, green_bright[1] + flash_val // 4),
                            min(255, green_bright[2] + flash_val // 2)
                        )
                        outline = green_bright

                draw_rounded_rect(draw, (bx0, by0, bx1, by1), block_radius, fill=fill, outline=outline, width=1)

        # 3. Draw Ball Trail (past 4 positions)
        for t in range(1, 6):
            if f - t >= 0:
                tx, ty = ball_positions[f - t]
                alpha_factor = (6 - t) / 6.0
                tr_radius = int(7 * alpha_factor)
                tr_fill = (
                    int(blue_trail[0] * alpha_factor + bg_color[0] * (1 - alpha_factor)),
                    int(blue_trail[1] * alpha_factor + bg_color[1] * (1 - alpha_factor)),
                    int(blue_trail[2] * alpha_factor + bg_color[2] * (1 - alpha_factor))
                )
                draw.ellipse([tx - tr_radius, ty - tr_radius, tx + tr_radius, ty + tr_radius], fill=tr_fill)

        # 4. Draw Glowing Blue Ball
        cur_bx, cur_by = ball_positions[f]
        ball_r = 9
        
        # Outer Glow Ring
        draw.ellipse([cur_bx - ball_r - 4, cur_by - ball_r - 4, cur_bx + ball_r + 4, cur_by + ball_r + 4], fill=(20, 60, 95))
        draw.ellipse([cur_bx - ball_r - 2, cur_by - ball_r - 2, cur_bx + ball_r + 2, cur_by + ball_r + 2], fill=(30, 110, 165))
        # Inner Core
        draw.ellipse([cur_bx - ball_r, cur_by - ball_r, cur_bx + ball_r, cur_by + ball_r], fill=blue_ball)
        # Specular Highlight
        draw.ellipse([cur_bx - 3, cur_by - 3, cur_bx + 1, cur_by + 1], fill=(255, 255, 255))

        # 5. Impact Ripple Effect if ball recently hit a block
        for key, hit_f in hit_events.items():
            if hit_f <= f < hit_f + 8:
                rip_progress = (f - hit_f) / 8.0
                r, c = key
                icx = padding_x + c * (grid_w + block_gap) + grid_w / 2
                icy = padding_y + r * (grid_h + block_gap) + grid_h / 2
                rip_r = int(10 + rip_progress * 24)
                draw.ellipse([icx - rip_r, icy - rip_r, icx + rip_r, icy + rip_r], outline=green_bright, width=2)

        frames.append(img)

    output_dir = os.path.join(os.path.dirname(__file__), "..", "assets")
    os.makedirs(output_dir, exist_ok=True)
    gif_path = os.path.join(output_dir, "animation.gif")

    # Save as high quality looping GIF
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        optimize=True,
        duration=int(1000 / fps),
        loop=0
    )
    print(f"Animation saved successfully to {os.path.abspath(gif_path)}")
    print(f"File size: {os.path.getsize(gif_path) / 1024:.2f} KB")

if __name__ == "__main__":
    generate_tech_animation()
