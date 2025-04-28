class frame{
    constructor(length)
    {
        this.leds = new Array(length).fill([0, 0, 0])
    }

    fromJson(jsObj){
        this.leds = new Array(jsObj.leds.length);
        jsObj.leds.forEach((color, index) => {this.leds[index] = color});
        return this;
    }

    add(index, length)
    {
        this.leds.splice(index, 0, ...new Array(length).fill([0,0,0]));
    }

    remove(index, length)
    {
        this.leds.splice(index, length);
    }

    removeAt(index)
    {
        this.leds.splice(index, 1);
    }

    flat(index)
    {
        return this.leds.flat();
    }
}

class Animation{
    constructor(){
        this.frames = [];
        this.groups = [];
        this.name = "";
        this.selected = false;
    }

    fromJson(jsObj)
    {
        this.name = jsObj.name;
        this.frames = [];
        jsObj.frames.forEach((f, index) => {this.frames.push(new frame(0).fromJson(f))});
        this.groups = [];
        if(jsObj.groups)
        jsObj.groups.forEach((group, index) =>{this.groups.push(group)})
        return this;
    }
}

class LedStrip {
    constructor(length, ledPath)
    {
        this.ledCount = length;
        this.ledPath = ledPath;
        this.leds = new Array(length).fill(false);
    }

    add(index, point)
    {
        this.ledCount += 1;
        this.ledPath.splice(index, 0, point);
        this.leds.splice(index, 0, false);
    }

    remove(index){
        this.ledCount -= 1;
        this.ledPath.splice(index, 1);
        this.leds.splice(index, 1);
    }

    push(point){
        this.ledCount += 1;
        this.ledPath.push(point);
        this.leds.push(false);
    }

    fromJson(obj){
        obj.ledPath.forEach((led, index) => {
            this.push(led);
            if(obj.leds && obj.leds[index])
                this.disable(index);

        });
        return this;
    }

    disable(index){
        this.leds[index] = true;
    }

    enable(index){
        this.leds[index] = false;
    }

    isDisabled(index){
        return this.leds[index];
    }
}




function prevFrame() { if (currentFrame > 0) { drawFrame(animation[currentAnim].frames[--currentFrame]); updateThumbnails();} }
function nextFrame() { if (currentFrame < animation[currentAnim].frames.length - 1) { drawFrame(animation[currentAnim].frames[++currentFrame]); updateThumbnails(); }  }
function playAnimation() {
    if (animation[currentAnim].frames.length === 0) return;
    playing = true;
    let i = 0;
    const interval = 1000 / 5;
    const playInterval = setInterval(() => {
        if (!playing || i >= animation[currentAnim].frames.length) {
            clearInterval(playInterval);
            playing = false;
            drawFrame(animation[currentAnim].frames[currentFrame]);
            return;
        }
        drawFrame(animation[currentAnim].frames[i]);
        i++;
    }, interval);
}

function exportAnimation() {
    if (animation[currentAnim].frames.length === 0) return;
    let frameRate = 5;
    if(frameRateInput)
    {
        frameRate = parseInt(frameRateInput.value);
    }
    const header = new Uint8Array([frameRate, 3, ledStrip.ledCount >> 8, ledStrip.ledCount & 0xFF]);
    const data = new Uint8Array(animation[currentAnim].frames.flat().flat());
    const blob = new Blob([header, data], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'led_animation.bin';
    a.click();
}