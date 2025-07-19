
import librosa

def detect_bpm(audio_file):
    """Detect the BPM of an audio file"""
    y, sr = librosa.load(audio_file)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    return tempo

print(detect_bpm("temp.wav"))
