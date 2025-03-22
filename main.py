import os
import struct
import sys
import threading
import queue
import time 


import threading
import queue
import time

from ctypes import Array
import socket
import time

def get_packet_for_line(line, color):
    line_indexs = [[0,27],
    [28,53],
    [54,77],
    [78,100],
    [101,119],
    [120,137],
    [138,154],
    [155,169],
    [170,182],
    [183,194],
    [195,204]]
    idxs = line_indexs[line]
    return b'000'*(idx[0]-1) + color*(idxs[1]-idxs[0]+1) + b'SSS'


class socket_sink:
    def __init__(self, ip, port):
        self.s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.s.connect(("127.0.0.1",5555))

    def enocde(self, buf):
        encoded_buf = b''
        for i in range(len(buf)):
            color = self.color_to_byte(buf[i] & 0xff)
            color += self.color_to_byte((buf[i] >> 8) & 0xff)
            color += self.color_to_byte((buf[i] >> 16) & 0xff)
            encoded_buf += color
        encoded_buf += b'SSS'


    def color_to_byte(self, color):
        return chr((color & 0xff)/25 + 48)

    def send(self, buf):
        data = self.enocde(buf)
        self.s.send(data)

    def close(self):
        self.s.close()


class strip:
    def __init__(self, length):
        self.buf = [0]*length
        self.screens = []
        self.sink = None
    
    def set_sink(self, sink):
        self.sinnk = sink

    def set_range(self, start, buf):
        self.buf[start:start+len(buf)] = buf

    def render(self):
        if(self.sink):
            self.sink.send(self.buf) 


class player:
    def __init__(self, filename, frame_rate, color_dept):
        self.filename = filename
        self.file = open(filename, 'rb')
        self.frame_rate = self.file.read(1)
        self.color_depth = self.file.read(1)
        self.num_of_pixel = struct.unpack('H', self.file.read(2))
        if(self.color_depth > 3):
            raise
        if(self.frame_rate > 60):
            raise
    
    def _8bitTo24(self, d):
        d = struct.unpack('B', d)
        return struct.pack('BBB', d &0x3, (d >> 2) & 0x3, (d >> 4) & 0x3)

    def _16bitTo24(self, d):
        d = struct.unpack('H', d)
        return struct.pack('BBB', d &0x1f, (d >> 5) & 0x1f, (d >> 10) & 0x1f)

    def get_next_frame(self):
        frame = self.file.read(self.color_depth*self.num_of_pixel)
        if(self.color_depth == 1):
            data = frame
            frame = b''
            for d in data:
                frame += self._8bitTo24(d)
        elif(self.color_depth == 2):
            data = frame
            frame = b''
            for d in data:
                frame += self._16bitTo24(d)
        return frame
    

    

def get_socket():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(("127.0.0.1",5555))
    return s


class display_thread(threading.Thread):
    def __init__(self, strip, interval=10):  # Interval in milliseconds
        super().__init__()
        self.interval = interval / 1000  # Convert to seconds
        self.task_queue = queue.Queue()
        self.running = False
        self.strip = strip
    
    def add_task(self, task, *args, **kwargs):
        """Add a task (function) to the queue."""
        self.task_queue.put((task, args, kwargs))

    def stop(self):
        """Stop the worker thread."""
        self.running = False

    def render(self):
        self.strip.render()

    def run(self):
        """Thread execution: Check queue every interval and execute tasks."""
        self.running = True
        print("TaskWorker started!")
        
        while self.running:
            try:
                task, args, kwargs = self.task_queue.get_nowait()  # Wait for a task
                task(*args, **kwargs)  # Execute the function
            except queue.Empty:
                time.sleep(self.interval)
                self.render()
                pass  # No task found, just continue waiting
        
        print("TaskWorker stopped!")


now = time.time()

# Create and start the worker thread
worker = display_thread(interval=20)  # Check every 500 milliseconds
worker.start()

# Add some tasks
# Let it run for a few seconds
time.sleep(1)

# Stop the worker
worker.stop()
worker.join()


