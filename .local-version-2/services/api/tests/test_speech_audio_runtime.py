"""Actual shared FFmpeg decoding of synthetic signals; never speech/model accuracy."""
import io
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import wave
import pytest

API = Path(__file__).resolve().parents[1]
ML_PYTHON = API / "ml/wavlm/.venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")


@pytest.mark.parametrize("seconds,silent,expected", [(1, False, "decoded"), (1, True, "silent_audio"),
                                                    (.2, False, "invalid_audio"), (31, False, "invalid_audio")])
def test_actual_decoder_duration_silence_and_cleanup(tmp_path, seconds, silent, expected):
    if not ML_PYTHON.is_file():
        pytest.skip("Reviewed optional ML runtime is not installed; no actual decoder execution claimed")
    payload = io.BytesIO()
    with wave.open(payload, "wb") as target:
        target.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        target.writeframes(b"".join(struct.pack("<h", 0 if silent else int(4000 * math.sin(2 * math.pi * 220 * i / 16000)))
                                   for i in range(int(seconds * 16000))))
    recording = tmp_path / "synthetic.wav"
    recording.write_bytes(payload.getvalue())
    script = '''import json,sys,tempfile
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from worker import decode
with tempfile.TemporaryDirectory() as directory:
 try:
  output,duration=decode(sys.argv[2],directory)
  result={"status":"decoded","duration_ms":duration}
 except ValueError as error:
  result={"status":str(error)}
result["temporary_removed"]=not Path(directory).exists()
print(json.dumps(result))
'''
    completed = subprocess.run([str(ML_PYTHON), "-c", script, str(API / "ml/wavlm"), str(recording)],
                               capture_output=True, text=True, timeout=25)
    assert completed.returncode == 0
    result = json.loads(completed.stdout)
    assert result["status"] == expected and result["temporary_removed"]
