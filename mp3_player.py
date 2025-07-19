import pyaudio
import wave
import sys
from pydub import AudioSegment

def play_mp3(file_path):
    # Convert MP3 to WAV using pydub
    sound = AudioSegment.from_mp3(file_path)
    sound.export("temp.wav", format="wav")
    
    # Open the WAV file
    wf = wave.open("temp.wav", 'rb')
    
    # Initialize PyAudio
    p = pyaudio.PyAudio()
    
    # Open stream
    stream = p.open(format=p.get_format_from_width(wf.getsampwidth()),
                    channels=wf.getnchannels(),
                    rate=wf.getframerate(),
                    output=True)
    
    # Read data in chunks
    chunk = 1024
    data = wf.readframes(chunk)
    
    # Play the audio
    while data:
        stream.write(data)
        data = wf.readframes(chunk)
    
    # Cleanup
    stream.stop_stream()
    stream.close()
    p.terminate()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python mp3_player.py <mp3_file_path>")
        sys.exit(1)
    
    mp3_file = sys.argv[1]
    play_mp3(mp3_file)
