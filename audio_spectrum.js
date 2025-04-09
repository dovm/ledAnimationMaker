class AudioSpectrum {
    constructor(audioContext, canvas, ledStrip) {
        this.canvas = canvas;
        this.audioContext = audioContext;
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.audioEnd = false;
        this.minX = 0;
        this.maxX = this.analyser.fftSize/2;
        this.minY = 0;
        this.maxY = 255;
        this.sampleRate = 44100;
        this.bands = [];
    }

    setSrc(sourceNode){
        this.source = sourceNode;
        sourceNode.connect(this.analyser);
        this.analyser.connect(audioContext.destination);
    }

    stop(){
        this.audioEnd = true;
    }

    addBand(start, end){
        this.bands.push([start, end]);
    }

    resetBands()
    {
        this.bands = [];
    }

    start() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.audioEnd = false;
        const render = () => {
            if(!this.audioEnd)
                requestAnimationFrame(render);
            this.analyser.getByteFrequencyData(dataArray);
            this.drawSpectrum(dataArray);
        };
        render();
    }

    setXRange(min,max)
    {
        this.minX = min;
        this.maxX = max;
    }

    setYRange(min,max)
    {
        this.minY = min;
        this.maxY = max;
    }

    clipY(val)
    {
        if(val >= this.maxY) return this.maxY;
        if(val <= this.minY) return this.minY;
        return val;
    }

    clipX(val)
    {
        if(val >= this.maxX) return this.maxX;
        if(val <= this.minX) return this.minX;
        return val;
    }

    getIdxFromFreq(freq){
        return (freq / this.sampleRate) * this.analyser.fftSize;
    }

    drawSpectrum(fftData) {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let stepX = this.canvas.width/(this.maxX - this.minX);
        let stepY = this.canvas.height/(this.maxY - this.minY);
        ctx.beginPath();
        
        this.bands.forEach(band => {
            const minIndex = this.getIdxFromFreq(band[0]);
            const maxIndex = this.getIdxFromFreq(band[1]);
            ctx.strokeStyle = "rgb(191, 107, 107)";
            ctx.strokeRect(this.clipX(minIndex)*stepX, 0, this.clipX(maxIndex)*stepX, this.canvas.height);
            ctx.fillStyle = "rgba(156, 36, 3, 0.28)";
            ctx.fillRect(this.clipX(minIndex)*stepX, 0, this.clipX(maxIndex)*stepX, this.canvas.height);
        });

        for (let i = this.minX; i < this.maxX; i++) {
             ctx.lineTo(stepX*i, this.canvas.height - stepY*this.clipY(fftData[i]));
        }
        ctx.stroke();
    }
}
