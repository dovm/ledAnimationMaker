import socket
import struct
import time
import threading
import queue

# LED Strip Configuration
LED_STRIP_IP = "127.0.0.1"  # Change this to your LED strip IP
LED_STRIP_PORT = 5555  # Change this to match your LED strip server

# Socket setup
led_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
led_socket.connect((LED_STRIP_IP, LED_STRIP_PORT))
# Frame queue and stop event
frame_queue = queue.Queue()
stop_event = threading.Event()
file_queue = queue.Queue()

def play_led_frames():
    """Continuously reads frames from the queue and sends them to the LED strip."""
    while not stop_event.is_set():
        try:
            frame, delay = frame_queue.get(timeout=1)
            frame += b"SSS"
            led_socket.send(frame)
            if delay:
                time.sleep(delay)
        except queue.Empty:
            if not file_queue.empty():
                start_next_file()

def load_led_file(file_path, start_immediately=False):
    """
    Loads an LED animation file and either starts playing it immediately or queues it.
    
    :param file_path: Path to the LED animation file
    :param start_immediately: If True, starts playing immediately. If False, queues the file.
    """
    if start_immediately:
        while not frame_queue.empty():
            frame_queue.get_nowait()  # Clear the queue before starting new file
    file_queue.put(file_path)

def start_next_file():
    """Reads and plays the next file in the queue dynamically, frame by frame."""
    if file_queue.empty():
        return

    file_path = file_queue.get()
    try:
        with open(file_path, "rb") as f:
            header = f.read(4)
            frame_rate, color_depth, num_leds = struct.unpack("!B B H", header)
            frame_rate = frame_rate/10
            if color_depth != 3:
                print("Unsupported color depth!")
                return

            frame_delay = 1.0 / frame_rate  # Time per frame
            frame_size = num_leds * 3  # Each LED has 3 bytes (RGB)

            print(f"Playing {file_path} at {frame_rate} FPS with {num_leds} LEDs.")

            while not stop_event.is_set():
                frame = f.read(frame_size)
                if not frame:
                    break  # End of file
                frame_queue.put((frame, frame_delay))
    except Exception as e:
        print(f"Error reading file: {e}")

def add_custom_frame(rgb_values):
    """Add a manually created frame to the queue."""
    frame_queue.put((rgb_values, None))

# Start playback in a separate thread
playback_thread = threading.Thread(target=play_led_frames, daemon=True)
playback_thread.start()

# Example usage:
load_led_file("side_wave.bin", start_immediately=True)  # Start playing immediately
time.sleep(3)
#load_led_file("animation2.led", start_immediately=False)  # Queue after the first finishes
add_custom_frame(b"\xFF\x00\x00" * 30)  # Custom frame (all red)

# Stop playback after some time
time.sleep(15)
stop_event.set()
playback_thread.join()
led_socket.close()
