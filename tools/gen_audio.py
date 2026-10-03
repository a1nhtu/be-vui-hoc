"""Thu giọng đọc (Edge-TTS: tiếng Việt giọng HoaiMy, tiếng Anh giọng Jenny) cho các câu trong tools/phrases.json.

Cần: pip install edge-tts. Chỉ tạo những file audio/<vi|en>/<mã>.mp3 còn thiếu.
"""
import asyncio
import json
import pathlib

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "audio"
# (giọng, tốc độ): đọc chậm hơn một chút cho bé dễ nghe
VOICES = {"vi": ("vi-VN-HoaiMyNeural", "-10%"), "en": ("en-US-JennyNeural", "-15%")}


async def make(item, sem, failed):
    target = OUT / item["l"] / f"{item['k']}.mp3"
    voice, rate = VOICES[item["l"]]
    if target.exists() and target.stat().st_size > 0:
        return
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(item["t"], voice, rate=rate).save(str(target))
                if target.stat().st_size > 0:
                    return
            except Exception:
                await asyncio.sleep(1 + attempt)
        target.unlink(missing_ok=True)
        failed.append(f"{item['l']}: {item['t']}")


async def main():
    for lang in VOICES:
        (OUT / lang).mkdir(parents=True, exist_ok=True)
    items = json.loads((ROOT / "tools" / "phrases.json").read_text(encoding="utf-8"))
    sem, failed = asyncio.Semaphore(6), []
    await asyncio.gather(*(make(i, sem, failed) for i in items))
    print(f"{len(items) - len(failed)}/{len(items)} cau da co file; loi {len(failed)}")
    for t in failed[:20]:
        print("  loi:", t.encode("unicode_escape").decode())


asyncio.run(main())
