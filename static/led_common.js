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

    toJson(){
        return {
            leds: this.leds
        };
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

    addFrameAtIndex(index, frame){
        this.frames.splice(index, 0, frame);
    }

    addFrame(frame){
        this.frames.push(frame);
    }

    removeFrame(index){
        this.frames.splice(index, 1);
    }

    getFrame(index){
        return this.frames[index];
    }

    getFrames(){
        return this.frames;
    }

    getFrameCount(){
        return this.frames.length;
    }

    getGroups(){
        return this.groups;
    }

    setFrames(frames){
        this.frames = frames;
    }

    setGroups(groups){
        this.groups = groups;
    }

    getGroupCount(){
        return this.groups.length;
    }

    getGroup(index){
        return this.groups[index];
    }

    addGroup(group){
        this.groups.push(group);
    }

    removeGroup(index){
        this.groups.splice(index, 1);
    }

    toJson(){
        return {
            name: this.name,
            frames: this.frames.map(f => f.toJson()),
            groups: this.groups,
            selected: this.selected
        };
    }

    fromJson(jsObj)
    {
        this.name = jsObj.name;
        this.frames = [];
        jsObj.frames.forEach((f, index) => {this.frames.push(new frame(0).fromJson(f))});
        this.groups = [];
        if(jsObj.groups)
        jsObj.groups.forEach((group, index) =>{this.groups.push(group)})
        this.selected = jsObj.selected;
        return this;
    }
}

class animationContext{
    constructor(){
        this.animations = [];
        this.currentAnimation = -1;
        this.currentFrame = -1;
        this.ledStrip = -1;
    }

    getCurrentAnimation(){
        if(this.getAnimationCount() > 0 && this.currentAnimation != -1)
            return this.animations[this.currentAnimation];
        return undefined;
    }

    getCurrentFrame(){
        if(this.getCurrentAnimation() != undefined && this.getCurrentAnimation().getFrameCount() > 0 && this.currentFrame != -1)
            return this.getCurrentAnimation().getFrame(this.currentFrame);
        return undefined;
    }

    getLedStrip(){
        return this.ledStrip;
    }

    setLedStrip(ledStrip){
        this.ledStrip = ledStrip;
    }

    setCurrentAnimation(index){
        this.currentAnimation = index;
    }

    setCurrentFrame(index){
        this.currentFrame = index;
    }

    addAnimation(animation){
        this.animations.push(animation);
    }

    removeAnimation(index){
        this.animations.splice(index, 1);
    }

    getAnimation(index){
        return this.animations[index];
    }

    getAnimationCount(){
        return this.animations.length;
    }

    getCurrentAnimationIndex(){
        return this.currentAnimation;
    }

    getAnimations(){
        return this.animations;
    }

    getCurrentFrameIndex(){
        return this.currentFrame;
    }

    setCurrentFrameIndex(index){
        this.currentFrame = index;
    }

    setCurrentAnimationIndex(index){
        this.currentAnimation = index;
    }

    toJson(){
        return {
            animations: this.animations.map(a => a.toJson()),
            currentAnimation: this.currentAnimation,
            currentFrame: this.currentFrame,
            ledStrip: this.ledStrip
        };
    }
    
    fromJson(jsObj){
        this.animations = [];
        jsObj.animations.forEach((a, index) => {this.animations.push(new Animation().fromJson(a))});
        this.currentAnimation = jsObj.currentAnimation;
        this.currentFrame = jsObj.currentFrame;
        this.ledStrip = jsObj.ledStrip;
        return this;
    }
}

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

    get_led_at(point){
        let result = {point: undefined, index: -1};
        this.ledPath.forEach((led, index) => {
            if (point.x - led.x > 0 && point.x - led.x < 20 && point.y - led.y > 0 && point.y - led.y < 20) {
                result = {point: led, index};
            }
        });
        return result;
    }
}






function exportAnimation() {
    if (animationCtx.getCurrentAnimation().getFrameCount() === 0) return;
    let frameRate = 5;
    if(frameRateInput)
    {
        frameRate = parseInt(frameRateInput.value);
    }
    const header = new Uint8Array([frameRate, 3, ledStrip.ledCount >> 8, ledStrip.ledCount & 0xFF]);
    const data = new Uint8Array(animationCtx.getCurrentAnimation().getFrame(0).flat().flat());
    const blob = new Blob([header, data], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'led_animation.bin';
    a.click();
}