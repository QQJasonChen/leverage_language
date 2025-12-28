#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    # 建立圖片
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 畫圓形背景
    margin = 1
    draw.ellipse([margin, margin, size-margin, size-margin], fill='#1a73e8')
    
    # 畫字母 Y
    font_size = int(size * 0.6)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # 計算文字位置
    text = "Y"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 1
    
    # 畫文字
    draw.text((x, y), text, fill='white', font=font)
    
    # 儲存圖片
    img.save(output_path)
    print(f"Created {output_path}")

if __name__ == "__main__":
    # 建立不同尺寸的圖示
    sizes = [16, 48, 128]
    for size in sizes:
        create_icon(size, f"icon{size}.png")