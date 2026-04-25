class AudioLedController {
    constructor(canvas, ledStrip) {
        this.ledStrip = ledStrip;
        const count = (ledStrip && Number.isFinite(ledStrip.ledCount)) ? ledStrip.ledCount : 0;
        this.frame = new Array(count).fill([0,0,0]);
        this.canvas = canvas;
        this.effects = [];
        this.audioEnd = false;
    }
    
    setLedStrip(ledStrip){
        this.ledStrip = ledStrip;
    }

    addEffect(effect){
        this.effects.push(effect);
    }

    resetEffects(){
        this.effects = [];
    }

    setAnalayzer(analyser){
        this.analyser = analyser;
    }

    stop(){
        this.audioEnd = true;
    }

    start() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.audioEnd = false;
        const render = () => {
            if(!this.audioEnd)
                requestAnimationFrame(render);
            this.analyser.getByteFrequencyData(dataArray);
            this.applyEffects(dataArray);
        };
        render();
    }

    applyEffects(audioData) {
        // Legacy controller is replaced at load time by ProjectAudioLedController.
        // Kept defensive in case start() is invoked before the swap: just drive
        // each effect's compute() so internal state stays consistent.
        if (!this.effects) return;
        for (const effect of this.effects) {
            if (typeof effect.compute === 'function') effect.compute(audioData);
        }
    }

    renderLeds() {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ledStrip.ledPath.forEach((led, index) => {
                ctx.fillStyle = `rgb(${this.frame[index][0]}, ${this.frame[index][1]}, ${this.frame[index][2]})`;
                ctx.fillRect(led.x, led.y, 10, 10);
        });
    }
}


class EffectPulse {
    constructor(animation, settings) {
        this.animation = animation;
        this.animationRange = animation.getFrameCount();
        this.sampleRate = 44100;
        this.settings = settings;
    }

    getSettings(){
        return this.settings;
    }

    setSettings(settings){
        this.settings = settings;
    }

    clipAndNorm(val)
    {
        if(val > this.settings.range.max)
           val = this.settings.range.max;
        if(val < this.settings.range.min)
            val = this.settings.range.min;
        return val - this.settings.range.min;
    }

    special(audioData)
    {
        const minIndex = Math.floor((this.settings.HzRange.min / this.sampleRate) * audioData.length*2);
        const maxIndex = Math.ceil((this.settings.HzRange.max / this.sampleRate) * audioData.length*2);
        const minIndexBias = Math.floor((100 / this.sampleRate) * audioData.length*2);
        const maxIndexBias = Math.ceil((200 / this.sampleRate) * audioData.length*2);
        let avgVolume = 0;
        for (let i = minIndex; i < maxIndex; i++) {
            avgVolume += audioData[i];
        }
        avgVolume = avgVolume/(maxIndex - minIndex);
        let maxValue = 0;
        for (let i = minIndex; i < maxIndex; i++) {
            maxValue = Math.max(maxValue, audioData[i]);
        }
        //biasVolume = biasVolume/(maxIndexBias - minIndexBias);
        return maxValue;// - biasVolume/2;
    }


    setup(sampleRate){
        this.sampleRate = sampleRate;
    }

    // Pure: returns the frame index in the configured animation that should
    // be displayed for the given audio sample. Rendering is the controller's
    // responsibility.
    compute(audioData) {
        const total = this._frameCount();
        if (total <= 0) return null;
        const range_norm = this.settings.range.max - this.settings.range.min;
        if (!(range_norm > 0)) return null;
        const step = total / range_norm;
        const avgVolume = this.special(audioData);
        const level = this.clipAndNorm(avgVolume);
        let frameIndex = Math.floor(level * step);
        if (frameIndex >= total) frameIndex = total - 1;
        if (frameIndex < 0) frameIndex = 0;
        return { animation: this.animation, frameIndex };
    }

    _frameCount() {
        if (!this.animation) return 0;
        if (typeof this.animation.getFrameCount === 'function') return this.animation.getFrameCount();
        if (Array.isArray(this.animation.frames)) return this.animation.frames.length;
        return 0;
    }
}

class EffectAnim {
    constructor(animation, settings) {
        this.animation = animation;
        this.animationRange = animation.getFrameCount();
        this.sampleRate = 44100;
        this.frameIndex = 0;
        this.settings = settings;
        this.isMax = false;
        this.isMin = false;
        this.maxLevel = 0;
    }
    
    getSettings(){
        return this.settings;
    }

    setSettings(settings){
        this.settings = settings;
    }

    getPower(audioData)
    {
        const minIndex = Math.floor((this.settings.HzRange.min / this.sampleRate) * audioData.length*2);
        const maxIndex = Math.ceil((this.settings.HzRange.max / this.sampleRate) * audioData.length*2);
        let avgVolume = 0;
        for (let i = minIndex; i < maxIndex; i++) {
            avgVolume += audioData[i];
        }
        avgVolume = avgVolume/(maxIndex - minIndex);
        return avgVolume;
    }

    special(avgVolume)
    {
        let ret_val = false;
        if(avgVolume > this.maxLevel) {
            this.maxLevel = avgVolume;
            this.isMax = false;
            this.isMin = false;
        }
        else if(!this.isMin && !this.isMax && avgVolume < this.maxLevel) {
            this.isMax = true;
            ret_val = true;
        }
        else if(this.isMax && !this.isMin && avgVolume < this.maxLevel * 0.95) {
            this.isMin = true;
            this.isMax = false;
            this.minLevel = avgVolume;
        }
        else if(this.isMin && !this.isMax && avgVolume < this.minLevel) {
            this.minLevel = avgVolume;
        }
        else if(this.isMin && !this.isMax && avgVolume > this.minLevel) {
            this.isMin = false;
            this.isMax = false;
            this.maxLevel = avgVolume;
        }
        
        console.log(avgVolume, ret_val, this.isMin, this.isMax, this.maxLevel, this.minLevel);
        return ret_val;
    }


    setup(sampleRate){
        this.sampleRate = sampleRate;
    }

    compute(audioData) {
        const total = this._frameCount();
        if (total <= 0) return null;
        const avgVolume = this.getPower(audioData);
        if (avgVolume > this.settings.range.max || avgVolume < this.settings.range.min) return null;
        const next = this.special(avgVolume);
        // Snapshot the index BEFORE advancing, so the returned frame matches
        // the legacy behavior (advance happens after rendering).
        const idx = (this.frameIndex >= 0 && this.frameIndex < total) ? this.frameIndex : 0;
        if (next) {
            this.frameIndex = (this.frameIndex + 1) % total;
        } else if (this.frameIndex >= total) {
            this.frameIndex = 0;
        }
        return { animation: this.animation, frameIndex: idx };
    }

    _frameCount() {
        if (!this.animation) return 0;
        if (typeof this.animation.getFrameCount === 'function') return this.animation.getFrameCount();
        if (Array.isArray(this.animation.frames)) return this.animation.frames.length;
        return 0;
    }
}


/*       settings
frequency range
level range
time window
animation rate
end Animation


*/
class EffectTriger {
    constructor(animation, endAnimation, settings) {
        this.animation = animation;
        this.endAnimation = endAnimation
        this.animationRange = animation.getFrameCount();
        this.sampleRate = 44100;
        this.settings = settings;
        this.meanOverTime = 0;
        this.lastMeansArray = undefined;
        this.lastMeanArrayIndex = 0;
        this.isThreshold = false;
        this.endAnimationIndex = 0;
        this.endAnimationLastTime = 0;
    }

    getSettings(){
        return this.settings;
    }

    setSettings(settings){
        this.settings = settings;
    }

    clipAndNorm(val)
    {
        if(val > this.settings.range.max){
            this.isThreshold = true;
           val = this.settings.range.max;
        }
        if(val < this.settings.range.min)
            val = this.settings.range.min;
        return val - this.settings.range.min;
    }

    special(audioData)
    {
        const minIndex = Math.floor((this.settings.HzRange.min / this.sampleRate) * audioData.length*2);
        const maxIndex = Math.ceil((this.settings.HzRange.max / this.sampleRate) * audioData.length*2);
        let avgVolume = 0;
        for (let i = minIndex; i < maxIndex; i++) {
            avgVolume += audioData[i];
        }
        avgVolume = avgVolume/(maxIndex - minIndex);
        return avgVolume;
    }


    setup(sampleRate){
        this.sampleRate = sampleRate;
    }

    calcMeanOverTime(avgVolume){
        this.meanOverTime -= this.lastMeansArray[this.lastMeanArrayIndex];
        this.lastMeansArray[this.lastMeanArrayIndex] = avgVolume;
        this.meanOverTime += this.lastMeansArray[this.lastMeanArrayIndex++];
        
        if(this.lastMeanArrayIndex == this.lastMeansArray.length)
            this.lastMeanArrayIndex = 0; 
        return this.meanOverTime/this.lastMeansArray.length;
    }

    compute(audioData) {
        if (!this.isThreshold) {
            const total = this._frameCount(this.animation);
            if (total <= 0) return null;
            if (!this.lastMeansArray) {
                this.lastMeansArray = new Array(
                    Math.max(1, Math.ceil(this.sampleRate / (audioData.length * 2) * this.settings.timeWindow))
                ).fill(0);
            }
            const avgVolume = this.special(audioData);
            const range_norm = this.settings.range.max - this.settings.range.min;
            // Preserves legacy step formula (kept verbatim from the previous
            // apply() so behavior doesn't change with this refactor).
            const step = range_norm > 0 ? range_norm / total : 0;
            const level = this.clipAndNorm(this.calcMeanOverTime(avgVolume));
            let frameIndex = Math.floor(level * step);
            if (frameIndex >= total) frameIndex = total - 1;
            if (frameIndex < 0) frameIndex = 0;
            return { animation: this.animation, frameIndex };
        }

        const totalEnd = this._frameCount(this.endAnimation);
        if (totalEnd <= 0) {
            this.isThreshold = false;
            this.lastMeansArray = undefined;
            this.meanOverTime = 0;
            this.lastMeanArrayIndex = 0;
            return null;
        }
        if (Date.now() / 1000.0 > (this.endAnimationLastTime + 1 / this.settings.animationRate)) {
            this.endAnimationLastTime = Date.now() / 1000.0;
            this.endAnimationIndex++;
            if (this.endAnimationIndex >= totalEnd) {
                this.endAnimationIndex = 0;
                this.isThreshold = false;
                this.lastMeansArray = undefined;
                this.meanOverTime = 0;
                this.lastMeanArrayIndex = 0;
                return null;
            }
        }
        return { animation: this.endAnimation, frameIndex: this.endAnimationIndex };
    }

    _frameCount(anim) {
        if (!anim) return 0;
        if (typeof anim.getFrameCount === 'function') return anim.getFrameCount();
        if (Array.isArray(anim.frames)) return anim.frames.length;
        return 0;
    }
}