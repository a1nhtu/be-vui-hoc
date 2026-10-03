"""Thu giọng đọc tiếng Việt (Edge-TTS, giọng HoaiMy) cho các câu trong tools/phrases.json.

Cần: pip install edge-tts. Chỉ tạo những file audio/vi/<mã>.mp3 còn thiếu.
"""
import asyncio
import json
import pathlib

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "audio" / "vi"
VOICE = "vi-VN-HoaiMyNeural"
RATE = "-10%"  # đọc chậm hơn một chút cho bé dễ nghe


async def make(item, sem, failed):
    target = OUT / f"{item['k']}.mp3"
    if target.exists() and target.stat().st_size > 0:
        return
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(item["t"], VOICE, rate=RATE).save(str(target))
                if target.stat().st_size > 0:
                    return
            except Exception:
                await asyncio.sleep(1 + attempt)
        target.unlink(missing_ok=True)
        failed.append(item["t"])


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = json.loads((ROOT / "tools" / "phrases.json").read_text(encoding="utf-8"))
    sem, failed = asyncio.Semaphore(6), []
    await asyncio.gather(*(make(i, sem, failed) for i in items))
    print(f"{len(items) - len(failed)}/{len(items)} cau da co file; loi {len(failed)}")
    for t in failed[:20]:
        print("  loi:", t.encode("unicode_escape").decode())


asyncio.run(main())
