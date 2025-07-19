class AudioLedController {
    constructor(canvas, ledStrip) {
        this.ledStrip = ledStrip;
        this.frame = new Array(this.ledStrip.ledCount).fill([0,0,0]);
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
        this.frame = new Array(this.ledStrip.ledCount).fill([0,0,0]);
        this.effects.forEach(effect => effect.apply(audioData, this.frame, 1/ this.effects.length));
        this.renderLeds();
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
        this.animationRange = animation.frames.length;
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
        const minIndex = Math.floor((this.settings.HzRange.min / this.sampleRate) * audioData.length);
        const maxIndex = Math.ceil((this.settings.HzRange.max / this.sampleRate) * audioData.length);
        const minIndexBias = Math.floor((100 / this.sampleRate) * audioData.length);
        const maxIndexBias = Math.ceil((200 / this.sampleRate) * audioData.length);
        let avgVolume = 0;
        for (let i = minIndex; i < maxIndex; i++) {
            avgVolume += audioData[i];
        }
        avgVolume = avgVolume/(maxIndex - minIndex);
        //let biasVolume = 0;
        //for (let i = minIndexBias; i < maxIndexBias; i++) {
        //    biasVolume += audioData[i];
        //}
        //biasVolume = biasVolume/(maxIndexBias - minIndexBias);
        return avgVolume;// - biasVolume/2;
    }


    setup(sampleRate){
        this.sampleRate = sampleRate;
    }

    apply(audioData, currentFrame, alpha) {
        let range_norm = this.settings.range.max - this.settings.range.min;
        let step = this.animationRange/range_norm;
        let avgVolume = this.special(audioData);//avgVolume/(maxIndex - minIndex);
        let level = this.clipAndNorm(avgVolume);
        let frameIndex = Math.floor(level*step);
        if(frameIndex >= this.animationRange)
            frameIndex = this.animationRange-1; 
        let frame = this.animation.frames[frameIndex];
        console.log(avgVolume, frameIndex, step);
        currentFrame.forEach((led, index) => {
            //currentFrame[index][0] = currentFrame[index][0] * (1-alpha) + alpha*frame.leds[index][0];
            //currentFrame[index][1] = currentFrame[index][1] * (1-alpha) + alpha*frame.leds[index][1];
            //currentFrame[index][2] = currentFrame[index][2] * (1-alpha) + alpha*frame.leds[index][2];

            currentFrame[index] = [Math.min(currentFrame[index][0] + frame.leds[index][0], 255),
            Math.min(currentFrame[index][1] + frame.leds[index][1], 255),
            Math.min(currentFrame[index][2] + frame.leds[index][2], 255)];
        });
    }
}

class EffectAnim {
    constructor(animation, settings) {
        this.animation = animation;
        this.animationRange = animation.frames.length;
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

    special(audioData)
    {
        const minIndex = Math.floor((this.settings.HzRange.min / this.sampleRate) * audioData.length);
        const maxIndex = Math.ceil((this.settings.HzRange.max / this.sampleRate) * audioData.length);
        let avgVolume = 0;
        for (let i = minIndex; i < maxIndex; i++) {
            avgVolume += audioData[i];
        }
        avgVolume = avgVolume/(maxIndex - minIndex);
        
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

    apply(audioData, currentFrame, alpha) {
        let next = this.special(audioData);
        let frame = this.animation.frames[this.frameIndex];
        if(next){
            this.frameIndex += 1;
            if(this.frameIndex >= this.animation.frames.length)
                this.frameIndex = 0;
        }
        currentFrame.forEach((led, index) => {
            currentFrame[index] = [Math.min(currentFrame[index][0] + frame.leds[index][0], 255),
            Math.min(currentFrame[index][1] + frame.leds[index][1], 255),
            Math.min(currentFrame[index][2] + frame.leds[index][2], 255)];
        });
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
        this.animationRange = animation.frames.length;
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
        const minIndex = Math.floor((this.settings.HzRange.min / this.sampleRate) * audioData.length);
        const maxIndex = Math.ceil((this.settings.HzRange.max / this.sampleRate) * audioData.length);
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

    apply(audioData, currentFrame, alpha) {
        if(! this.isThreshold){
            if(!this.lastMeansArray)
                this.lastMeansArray = new Array(Math.ceil(this.sampleRate/audioData.length*this.settings.timeWindow)).fill( 0);
            let avgVolume = this.special(audioData);

            let range_norm = this.settings.range.max - this.settings.range.min;
            let step = this.animationRange/range_norm;
            let level = this.clipAndNorm(this.calcMeanOverTime(avgVolume));

            let frameIndex = Math.floor(level*step);
            if(frameIndex >= this.animationRange)
                frameIndex = this.animationRange-1; 
            let frame = this.animation.frames[frameIndex];
            console.log(this.meanOverTime/this.lastMeansArray.length, frameIndex, step);
            currentFrame.forEach((led, index) => {
                currentFrame[index] = [Math.min(currentFrame[index][0] + frame.leds[index][0], 255),
                Math.min(currentFrame[index][1] + frame.leds[index][1], 255),
                Math.min(currentFrame[index][2] + frame.leds[index][2], 255)];
            });
        }
        else {
            if(Date.now()/1000.0 > (this.endAnimationLastTime + 1/this.settings.animationRate)){
                this.endAnimationLastTime = Date.now()/1000.0;
                this.endAnimationIndex++; 
                if(this.endAnimationIndex == this.endAnimation.frames.length)
                {
                    this.endAnimationIndex = 0;
                    this.isThreshold = false;
                    this.lastMeansArray = undefined;
                    this.meanOverTime = 0;
                    this.lastMeanArrayIndex = 0;
                    return
                }
            }
            
            let frame = this.endAnimation.frames[this.endAnimationIndex];
            console.log( this.endAnimationIndex);

            currentFrame.forEach((led, index) => {
                currentFrame[index] = [Math.min(currentFrame[index][0] + frame.leds[index][0], 255),
                Math.min(currentFrame[index][1] + frame.leds[index][1], 255),
                Math.min(currentFrame[index][2] + frame.leds[index][2], 255)];
            });
            
        }
    }
}