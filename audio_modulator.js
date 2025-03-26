class AudioLedController {
    constructor(canvas) {
        this.canvas = canvas;
        this.ledGroups = [];
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.source = null;
        this.effects = [];
    }

    loadAudio(file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const arrayBuffer = event.target.result;
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            if (this.source) this.source.stop();
            this.source = this.audioContext.createBufferSource();
            this.source.buffer = audioBuffer;
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            this.source.start();
            this.processAudio();
        };
        reader.readAsArrayBuffer(file);
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    processAudio() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const render = () => {
            requestAnimationFrame(render);
            this.analyser.getByteFrequencyData(dataArray);
            this.applyEffects(dataArray);
        };
        render();
    }

    applyEffects(audioData) {
        this.effects.forEach(effect => effect.apply(audioData, this.ledGroups));
        this.renderLeds();
    }

    renderLeds() {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ledGroups.forEach(group => {
            group.leds.forEach(led => {
                ctx.fillStyle = `rgb(${led.color[0]}, ${led.color[1]}, ${led.color[2]})`;
                ctx.fillRect(led.x, led.y, 10, 10);
            });
        });
    }
}

class PulseEffect {
    constructor(intensityThreshold, colorRange) {
        this.intensityThreshold = intensityThreshold;
        this.colorRange = colorRange;
    }

    apply(audioData, ledGroups) {
        const avgVolume = audioData.reduce((a, b) => a + b) / audioData.length;
        ledGroups.forEach(group => {
            const brightness = Math.min(255, (avgVolume / this.intensityThreshold) * 255);
            group.leds.forEach(led => {
                led.color = [brightness, this.colorRange[1], this.colorRange[2]];
            });
        });
    }
}