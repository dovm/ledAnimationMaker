class AudioSpectrum {
    constructor(canvas, ledStrip) {
        this.canvas = canvas;
        this.audioEnd = false;
        this.minX = 0;
        this.minY = 0;
        this.maxY = 255;
        this.sampleRate = 44100;
        this.bands = [];
    }

    setAnalayzer(analyser){
        this.analyser = analyser;
        this.maxX = this.analyser.fftSize/2;
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
        const startX = 25;
        const width = this.canvas.width - startX;
        const height = this.canvas.height - 15;

        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(startX, 0, width, height);
        
        let stepX = width/(this.maxX - this.minX);
        let stepY = height/(this.maxY - this.minY);
        
        ctx.beginPath();
        
        this.bands.forEach(band => {
            const minIndex = this.getIdxFromFreq(band[0]);
            const maxIndex = this.getIdxFromFreq(band[1]);
            ctx.strokeStyle = "rgb(191, 107, 107)";
            ctx.strokeRect(startX + this.clipX(minIndex)*stepX, 0, this.clipX(maxIndex)*stepX - this.clipX(minIndex)*stepX, height);
            ctx.fillStyle = "rgba(156, 36, 3, 0.28)";
            ctx.fillRect(startX + this.clipX(minIndex)*stepX, 0, this.clipX(maxIndex)*stepX - this.clipX(minIndex)*stepX, height);
        });

        for (let i = this.minX; i < this.maxX; i++) {
             ctx.lineTo(startX + stepX*(i - this.minX), height - stepY*(this.clipY(fftData[i]) - this.minY) );
        }
        ctx.stroke();
    }
}
