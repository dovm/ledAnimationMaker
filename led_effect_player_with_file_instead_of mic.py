import time
import os
from rpi_ws281x import PixelStrip, Color
import json
import numpy as np
import pyaudio
import wave
import threading
from numpy.fft import fft
import sys

NUM_LEDS = 321

# Effect configuration
effects = []
animations = []
current_frame = np.zeros((NUM_LEDS, 3), dtype=np.uint8)

CHUNK = 1024
MIN_DB = -100
MAX_DB = -30

def load_effects(effects_file):
    """Load effects configuration from JSON file"""
    global effects
    with open(effects_file, 'r') as f:
        effects = json.load(f)

def get_frequency_band_power(fft_data, start_freq, end_freq):
    """Calculate average power in a specific frequency band"""
    # Convert FFT data to 8-bit values using fixed normalization
    fft_magnitude = np.abs(fft_data)/(CHUNK*32767)
    # Theoretical maximum for int16 with CHUNK=1024: 1024 * 32767 = 33,553,408
    #if(fft_magnitude.any() <= 0):
    #    return 0
    fft_mag_db = 20 * np.log10(fft_magnitude)
    fft_normalized = (fft_mag_db - MIN_DB) / (MAX_DB - MIN_DB) * 255;
    fft_normalized = np.clip(fft_normalized, 0, 255)
    #fft_8bit = fft_normalized.astype(np.uint8)
    # Calculate the frequency bins corresponding to the requested frequency range
    freq_bins = np.fft.fftfreq(len(fft_data), 1.0/RATE)
    mask = (freq_bins >= start_freq) & (freq_bins <= end_freq)
    fft_band = fft_normalized[mask]
    
    # Calculate power as the mean of the 8-bit values
    power = np.mean(fft_band)
    return power

isMax = False;
isMin = False;
maxLevel = 0
minLevel = 0

def effectAnim(avgVolume):
    global isMin, isMax, maxLevel, minLevel
    ret_val = False;
    if(avgVolume > maxLevel):
        maxLevel = avgVolume
        isMax = False
        isMin = False

    elif(not isMin and not isMax and avgVolume < maxLevel):
        isMax = True;
        ret_val = True;
    elif(isMax and not isMin and avgVolume < maxLevel * 0.95):
        isMin = True;
        isMax = False;
        minLevel = avgVolume
    elif(isMin and not isMax and avgVolume < minLevel):
        minLevel = avgVolume;
    elif(isMin and not isMax and avgVolume > minLevel):
        isMin = False;
        isMax = False;
        maxLevel = avgVolume;

    return ret_val

last_frame_index = 0

def get_mic_index(p):
    target_name = "USB PnP Sound Device: Audio (hw:1,0)"
    print("get_mic_index", p.get_device_count())
    for i in range(p.get_device_count()):
        dev = p.get_device_info_by_index(i)
        print(dev)
        if dev['maxInputChannels'] > 0 and target_name.lower() in dev['name'].lower():
            print(f"Found mic at index {i}: {dev['name']}")
            return i
    else:
        return -1;

def process_audio():
    global last_frame_index
    """Process audio input and update LED effects"""

      # Replace with your mic name or substring
    # Initialize PyAudio
    p = pyaudio.PyAudio()

    device_index = -1;
    while device_index == -1:
        device_index = get_mic_index(p)
        if(device_index == -1):
            print("Microphone not found, waiting 1 second")
            time.sleep(1)
    
    print("Microphone found, starting audio processing" , device_index)
    # Open stream
    stream = p.open(format=pyaudio.paInt16,
                    channels=1,
                    rate=44100,
                    input=True, frames_per_buffer=CHUNK, input_device_index=device_index)
    
    global RATE
    RATE = 44100
    frame_time = CHUNK/RATE
    data = stream.read(CHUNK, exception_on_overflow = False)
    
    
    while True:
        start_time = time.time()
        
        # Perform FFT
        data = np.frombuffer(data, dtype=np.int16) 
        
        fft_data = fft(data)
        data = stream.read(CHUNK, exception_on_overflow = False)
        #wf.readframes(CHUNK*200)
        # Reset current frame
        current_frame = np.zeros((NUM_LEDS, 3), dtype=np.uint8)

        # Process each effect
        for i in range(len(effects["effects"])):
            effect = effects["effects"][i]
            # Get power in effect's frequency band
            #print(effect['effect']['settings']['HzRange']['min'],effect['effect']['settings']['HzRange']['max'])
            power = get_frequency_band_power(fft_data, 
                                           effect['effect']['settings']['HzRange']['min'],
                                           effect['effect']['settings']['HzRange']['max'])
            
            print(i, "power", power)
            # Select frame based on power
            if(effect['effect']['type'] == 'pulse'):
                animation = effects["animations"][effect['effect']['animationIndex']]
                if power < effect['effect']['settings']['range']['min']:
                    frame_index = 0
                elif power > effect['effect']['settings']['range']['max']:
                    frame_index = len(animation['frames']) - 1
                else:
                    normalized_power = (power - effect['effect']['settings']['range']['min']) / (effect['effect']['settings']['range']['max'] - effect['effect']['settings']['range']['min'])
                    normalized_power = max(0, min(1, normalized_power))  # Clamp between 0 and 1
                
                    frame_index = min(int(normalized_power * len(animation['frames'])), 
                            len(animation['frames']) - 1)
            elif(effect['effect']['type'] == 'animation'):
                if(power >= effect['effect']['settings']['range']['min'] 
                   and power <= effect['effect']['settings']['range']['max']):
                    animation = effects["animations"][effect['effect']['animationIndex']]
                    next = effectAnim(power)
                    frame_index = last_frame_index
                    if(next):   
                        frame_index += 1
                    if(frame_index == len(animation['frames'])):
                        frame_index = 0
                    last_frame_index = frame_index            
                else:
                    frame_index = -1
            elif(effect['effect']['type'] == 'trigger'):
                animation = effects["animations"][effect['effect']['animationIndex']]
                end_animation = effects["animations"][effect['effect']['settings']['endAnimationIndex']]
                # Calculate power over time using moving average
                if not effect.__contains__('last_powers_array'):
                    # Initialize array to store power values over time window
                    time_window_frames = int(effect['effect']['settings']['timeWindow'] * RATE / CHUNK)
                    effect["last_powers_array"] = [0] * time_window_frames
                    effect["last_power_index"] = 0
                    effect["mean_power_over_time"] = 0
                    print("aaaaaaaaaa")
                
                # Update moving average
                effect["mean_power_over_time"] -= effect["last_powers_array"][effect["last_power_index"]]
                effect["last_powers_array"][effect["last_power_index"]] = power
                effect["mean_power_over_time"] += effect["last_powers_array"][effect["last_power_index"]]
                effect["last_power_index"] = (effect["last_power_index"] + 1) % len(effect["last_powers_array"])
                # Use average power over time instead of instantaneous power
                power = effect["mean_power_over_time"] / len(effect["last_powers_array"])
                #print("power", effect)
                # Check if power is above threshold
                #print("power", power)
                if power > effect['effect']['settings']['range']['max'] or (effect.__contains__('is_threshold') and effect["is_threshold"]):
                    # Trigger the end animation
                    if not effect.__contains__('is_threshold') or not effect['is_threshold']:
                        effect["is_threshold"] = True
                        effect["end_animation_index"] = 0
                        effect["end_animation_last_time"] = time.time()
                        print("175","trigggeerrrrrrrrrrrrrrrr")

                    
                    # Update end animation frame
                    current_time = time.time()
                    print("180", current_time, effect["end_animation_last_time"],(1.0 / effect['effect']['settings']['animationRate']) )
                    if current_time > (effect["end_animation_last_time"] + (1.0 / effect['effect']['settings']['animationRate'])):
                        effect["end_animation_last_time"]= current_time
                        effect["end_animation_index"] += 1
                        print("184",effect["end_animation_index"], len(end_animation['frames']), effect["is_threshold"])

                        if effect["end_animation_index"] == len(end_animation['frames']):
                            effect["end_animation_index"] = 0
                            effect["is_threshold"] = False
                            frame_index = 0
                        else:
                            frame_index = effect["end_animation_index"]
                    else:
                        frame_index = effect["end_animation_index"]
                else:
                    # Normal animation based on power
                    if power < effect['effect']['settings']['range']['min']:
                        frame_index = 0
                    elif power > effect['effect']['settings']['range']['max']:
                        frame_index = len(animation['frames']) - 1
                    else:
                        normalized_power = (power - effect['effect']['settings']['range']['min']) / (effect['effect']['settings']['range']['max'] - effect['effect']['settings']['range']['min'])
                        normalized_power = max(0, min(1, normalized_power))  # Clamp between 0 and 1
                    
                        frame_index = min(int(normalized_power * len(animation['frames']) - 0.0001), 
                                len(animation['frames']) - 1)
                        #print("frame index", frame_index)
            print("207",  frame_index, effect.__contains__('is_threshold') and effect['is_threshold'])
            if(frame_index >= 0):
                #print(effects["animations"][effect['effect']['animationIndex']])
                if(effect.__contains__('is_threshold') and effect['is_threshold']):
                    frame = end_animation["frames"][frame_index]
                else:
                    frame = animation["frames"][frame_index]
                #frame = animation['frames'][frame_index]
                current_frame = current_frame + frame['leds']
                current_frame = np.clip(current_frame, 0, 255)  
        
        # Update LED strip
        for i, color in enumerate(current_frame):
            strip.setPixelColor(i, Color(color[0], color[1], color[2]))
        strip.show()
        #print(time.time() - start_time)
        # Small delay to prevent overwhelming the LED strip
        time.sleep(max(0, frame_time - (time.time() - start_time)))

strip = PixelStrip(NUM_LEDS, 10, 800000, 10, False, 255, 0)
strip.begin()


skip_time = float(sys.argv[1])
# Start audio processing in a separate thread
if(os.path.exists('effects.json')):
    load_effects('effects.json')
#effects['effects'] = []
print("loaded effects and animations")
audio_thread = threading.Thread(target=process_audio)
audio_thread.daemon = True
audio_thread.start()
print("started audio thread")
while True:
    time.sleep(1)
from pprint import pprint 
for effect in effects["effects"]:
    pprint(effect)
#process_audio()







