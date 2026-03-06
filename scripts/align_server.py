"""
GPU Alignment Server — 在 PC (4070 Ti) 上运行
流程: 上传音频 → demucs 人声分离 → WhisperX 词级时间戳 → 映射到歌词行

安装依赖 (在 PC 上执行):
    pip install fastapi uvicorn python-multipart
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
    pip install demucs
    pip install whisperx

    # 如果 whisperx 安装失败，先装 faster-whisper:
    # pip install faster-whisper
    # pip install whisperx

启动:
    python align_server.py

    默认监听 0.0.0.0:8000，局域网内 Mac 可以访问
"""

import os
import re
import json
import shutil
import tempfile
import logging
from contextlib import asynccontextmanager

import torch
import torchaudio
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"
log.info(f"Using device: {DEVICE}  compute_type: {COMPUTE_TYPE}")

# ── 懒加载模型（首次请求时加载，之后常驻内存）─────────────────────────────
_separator = None
_whisper_cache: dict = {}   # model_name → whisperx model
_align_model = None
_align_metadata = None


def get_separator():
    global _separator
    if _separator is None:
        log.info("Loading demucs htdemucs...")
        from demucs.api import Separator
        _separator = Separator(model="htdemucs", device=DEVICE)
        log.info("demucs ready")
    return _separator


def get_whisper(model_name: str):
    if model_name not in _whisper_cache:
        log.info(f"Loading WhisperX model: {model_name}")
        import whisperx
        _whisper_cache[model_name] = whisperx.load_model(
            model_name, device=DEVICE, compute_type=COMPUTE_TYPE, language="ja"
        )
        log.info(f"WhisperX {model_name} ready")
    return _whisper_cache[model_name]


def get_align_model():
    global _align_model, _align_metadata
    if _align_model is None:
        log.info("Loading WhisperX Japanese alignment model (wav2vec2)...")
        import whisperx
        _align_model, _align_metadata = whisperx.load_align_model(
            language_code="ja", device=DEVICE
        )
        log.info("Alignment model ready")
    return _align_model, _align_metadata


# ── 文本规范化（用于相似度计算）────────────────────────────────────────────
def normalize(text: str) -> str:
    return re.sub(r"[\s\u3000！？。、・「」『』【】（）(),.!?\-～〜♪\n]", "", text).lower()


def sim_score(a: str, b: str) -> float:
    """频率字符重叠相似度（与 TypeScript 版本一致）"""
    if not a or not b:
        return 0.0
    freq_b: dict[str, int] = {}
    for c in b:
        freq_b[c] = freq_b.get(c, 0) + 1
    freq_a: dict[str, int] = {}
    overlap = 0
    for c in a:
        freq_a[c] = freq_a.get(c, 0) + 1
        if freq_b.get(c, 0) >= freq_a[c]:
            overlap += 1
    return overlap / max(len(a), len(b))


# ── 核心：把词级时间戳映射到歌词行 ─────────────────────────────────────────
def map_words_to_lines(words: list[dict], lyric_lines: list[str]) -> list[dict]:
    """
    与 TypeScript 版本相同的比例窗口 + 相似度算法，
    但现在数据是词级（比 Whisper 片段级精确 ~10x）。
    每行歌词找其"第一个词"的 startTime；endTime 由 clean cut 决定。
    """
    N = len(lyric_lines)
    M = len(words)

    if M == 0 or N == 0:
        return [{"lineIndex": i, "startTime": 0.0, "endTime": 0.0} for i in range(N)]

    segs_per_lyric = M / N
    win_half = max(6, int(segs_per_lyric * 3))
    used = [False] * M
    results = []

    for i, line in enumerate(lyric_lines):
        lyric_norm = normalize(line)
        exp_seg = (i + 0.5) * segs_per_lyric
        lo = max(0, int(exp_seg - win_half))
        hi = min(M - 1, int(exp_seg + win_half))

        best_seg = -1
        best_score = float("-inf")

        for s in range(lo, hi + 1):
            if used[s]:
                continue
            proximity = 1.0 - abs(s - exp_seg) / win_half
            # 用词和后续几个词合并来比较，更能匹配歌词行
            window_end = min(s + max(1, round(segs_per_lyric)), M)
            window_text = normalize("".join(words[w].get("word", "") for w in range(s, window_end)))
            text_sim = sim_score(lyric_norm, window_text)
            score = 0.6 * proximity + 0.4 * text_sim
            if score > best_score:
                best_score = score
                best_seg = s

        # 回退：窗口内没找到 → 取最近的未使用词
        if best_seg == -1:
            min_dist = float("inf")
            for s in range(M):
                if not used[s]:
                    d = abs(s - exp_seg)
                    if d < min_dist:
                        min_dist = d
                        best_seg = s

        if best_seg >= 0:
            used[best_seg] = True
            results.append({
                "lineIndex": i,
                "startTime": round(words[best_seg].get("start", 0.0), 3),
                "endTime":   round(words[best_seg].get("end",   0.0), 3),
            })
        else:
            last_end = words[-1].get("end", 0.0)
            results.append({
                "lineIndex": i,
                "startTime": round(i * last_end / N, 3),
                "endTime":   round((i + 1) * last_end / N, 3),
            })

    # Clean cuts：每行结束时间 = 下一行开始时间
    for i in range(N - 1):
        results[i]["endTime"] = results[i + 1]["startTime"]

    return results


# ── FastAPI ────────────────────────────────────────────────────────────────
app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok", "device": DEVICE}


@app.post("/align")
async def align(
    audio:  UploadFile = File(...),
    lyrics: str        = Form(...),
    model:  str        = Form("large-v2"),
):
    tmp_dir = tempfile.mkdtemp(prefix="align_")
    try:
        # ── 1. 保存上传的音频 ──────────────────────────────────────────────
        ext = os.path.splitext(audio.filename or "audio.mp3")[1] or ".mp3"
        audio_path  = os.path.join(tmp_dir, f"audio{ext}")
        vocals_path = os.path.join(tmp_dir, "vocals.wav")

        with open(audio_path, "wb") as f:
            f.write(await audio.read())

        lyric_lines: list[str] = [l.strip() for l in json.loads(lyrics) if l.strip()]
        log.info(f"Received {len(lyric_lines)} lyric lines, model={model}")

        # ── 2. demucs 人声分离 ─────────────────────────────────────────────
        log.info("Running demucs vocal separation...")
        separator = get_separator()
        _, separated = separator.separate_audio_file(audio_path)
        torchaudio.save(vocals_path, separated["vocals"], separator.samplerate)
        log.info("Vocals extracted")

        # ── 3. WhisperX 转录（词级时间戳）─────────────────────────────────
        log.info("Running WhisperX transcription...")
        import whisperx

        whisper_model = get_whisper(model)
        audio_data = whisperx.load_audio(vocals_path)
        result = whisper_model.transcribe(audio_data, language="ja", batch_size=16)

        # ── 4. wav2vec2 强制对齐 → 词级时间戳 ─────────────────────────────
        log.info("Running phoneme alignment...")
        align_model, metadata = get_align_model()
        result = whisperx.align(
            result["segments"], align_model, metadata,
            audio_data, device=DEVICE, return_char_alignments=False
        )

        # 收集所有有时间戳的词
        words = [
            w for seg in result["segments"]
            for w in seg.get("words", [])
            if "start" in w and "end" in w
        ]
        log.info(f"Got {len(words)} word timestamps")

        # ── 5. 映射到歌词行 ────────────────────────────────────────────────
        timestamps = map_words_to_lines(words, lyric_lines)
        log.info("Alignment complete")

        return JSONResponse({"timestamps": timestamps})

    except Exception as e:
        log.exception("Alignment failed")
        return JSONResponse({"error": str(e)}, status_code=500)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
