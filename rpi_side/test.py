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

NUM_LEDS = 450
if(len(sys.argv) > 1):
    NUM_LEDS = int(sys.argv[1])

strip = PixelStrip(NUM_LEDS, 10, 800000, 10, False, 255, 0)
strip.begin()

for i in range(NUM_LEDS):
    strip.setPixelColor(i, Color(255,0,0))
strip.show()


print("started audio thread")
input("")
#process_audio()







