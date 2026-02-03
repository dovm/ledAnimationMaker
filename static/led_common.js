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

    change(currentIndex, newIndex)
    {
        let ledColor = this.leds[currentIndex];
        this.remove(currentIndex, 1);
        this.add(newIndex, 1);
        this.setColor(newIndex, ledColor);
    }

    setColor(index, color)
    {
        this.leds[index] = color;
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
/*
class Led{
    constructor(x,y,pos){
        this.x = x;
        this.y = y;
        this.pos = pos;;
        this.isEnable = true;
    }
}

class LedStrip {
    constructor(length, leds)
    {
        this.leds = leds;
        this.ledsPosMap = {};
        this.leds.foreach((led, index) => {
            this.ledsPosMap[led.pos] = led;
        });
    }

    add(led)
    {
        this.ledCount += 1;
        this.ledPath.splice(index, 0, point);
        this.leds.splice(index, 0, false);
    }

    length(){return this.leds.length};

    remove(pos){
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
        });
        return this;
    }

    disable(index){
        this.leds[index].isEnable = false;
    }

    enable(index){
        this.leds[index].isEnable = true;
    }

    isEnable(index){
        return this.leds[index].isEnable;
    }
}
*/
class LedStrip {
    constructor(length, ledPath)
    {
        this.ledCount = length;
        this.ledPath = ledPath;
        this.leds = new Array(length).fill(false);
        this.width = 600;
        this.height = 600;
    }

    setDim(width, height)
    {
        this.width = width;
        this.height = height;
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