



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
    
    def add_screen(self, sc, start):
        if(start + sc.length > len(self.buf)):
            raise
        for s in self.screens:
            if(self.intercect(start, start+ sc.length, s[1], s[2])):
                raise
        self.screens += [sc, start, start + sc.length]
        sc.set_strip(self)

    def render(self):
        for s in self.screens:
            self.set_range(s[1], s.buf)
        if(sink):
            sink.send(self.buf) 
        
    def intercect(self, start1, end1, start2, end2):
        if((start1 > start2 and start1 < end2) or (end1 > start2 and end1 < end2)):
            return True
        return False

class screen:
    def __init__(self, length):
        self.length = length
        self.buf = [0]*length

    def set_strip(self, s):
        self.strip = s
    
    def set_pixel(self, off, c):
        self.buf[off] = c

    def set_range(self, start, buf):
        self.buf[start:start+len(buf)] = buf


class line(screen):
    def __init__(self, length):
        self.length = length
        self.buf = [0]*length
    
    def on(self, color):
        self.buf = [color]*(self.length)
    
    def off(self):
        self.buf = [0]*(self.length)


class step:
    def __init__(self, line, time, action):
        self.line = line
        self.action = action
        self.time = time
    
    def _exec(self):
        pass
    
    def action_on(self):
        self.line.on()
        
    def action_off(self):
        self.line.off()

class Effect:
    def __init__(self, screen):
        self.screen = screen
        self.steps = []
        self.last_action_time = 0
    
    def next_tick(self):
        steps_to_execute = []
        for s in s.steps:
            if(s.time <= time.time()):
                steps_to_execute.append(s)
        s.steps.remove(steps_to_execute)
        for s in steps_to_execute:
            s.exce()
    
    def add_step(self, step):
        self.steps += step

class trigunal_matrix:
    def __init__(self, lines):
        self.lines = lines

sink = socket_sink('127.0.0.1', 5555)
main_strip = strip(300)
main_strip.set_sink(sink)


def init_lines(strip):
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

    lines = []
    for l in line_indexs:
        lines += line(l[1]-l[0]+1)
        strip.add_screen(lines[-1])
    return lines

def gen_wave_effect(lines, interval):
    steps = []
    for 





#triangle_screen = []
#triangle_screen += screen(5, 100)
#triangle_screen += screen(110, 80)
#triangle_screen += screen(195, 60)
#triangle_screen += screen(260, 40)

#for t in triangle_screen:
#    main_strip.add_screen(t)
