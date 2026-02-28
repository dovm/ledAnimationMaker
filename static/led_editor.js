
const canvasLayout = document.getElementById('ledCanvasLayout');
const canvasAnimation = document.getElementById('ledCanvasAnimation');
const canvasEffects = document.getElementById('ledCanvasEffects');
const frameRateInput = document.getElementById('frameRate');
const brushColorInput = document.getElementById('brushColor');
const animNameInput = document.getElementById('animName'); 
const ledList = document.getElementById('led-list');
const ledGroupList = document.getElementById('led-group-list');
const frameThumbnails = document.getElementById('frame-thumbnails');
const effectFrameThumbnails = document.getElementById('effect-frame-thumbnails');
const animationList = document.getElementById('animation-list');
const ledCanvasLayoutDesign = document.getElementById('ledCanvasLayoutDesign');

class Point{
    constructor(x, y){
        this.x = x;
        this.y = y;
    }
}

class Box{
    constructor(p1, p2){
        this.top = this.minY(p1,p2);
        this.left = this.minX(p1,p2);
        this.bottom = this.maxY(p1,p2);
        this.right = this.maxX(p1,p2);
    }

    width(){ return this.right - this.left;}
    height(){ return this.bottom - this.top;}

    maxX(p1,p2){ return Math.max(p1.x,p2.x);}

    maxY(p1,p2){return Math.max(p1.y,p2.y);}

    minX(p1,p2){return Math.min(p1.x,p2.x);}

    minY(p1,p2){return Math.min(p1.y,p2.y);}

    intersects(box){
        return !(
            box.right < this.left ||
            box.left > this.right ||
            box.bottom < this.top ||
            box.top > this.bottom
        );
    }
}

class SelectBox{
    constructor(selBoxObject)
    {
        this.selBox = selBoxObject;
        this.select_mode = "start",
        this.start =  new Point(0,0);
        this.end = new Point(0,0);
        this.box = new Box(this.start, this.end);
    }

    setSelBox(selBoxObject){ this.selBox = selBoxObject;}

    getMode(){return this.select_mode;}
    setMode(mode){this.select_mode = mode; return this;}

    setStart(p){
        this.start = p;
        this.box = new Box(this.start, this.end);
        return this;
    }

    setEnd(p){
        this.end = p;
        this.box = new Box(this.start, this.end);
        return this;
    }

    reset(){
        this.start =  new Point(0,0);
        this.end = new Point(0,0);
        this.box = new Box(this.start, this.end);
        return this;
    }

    draw(){
        this.selBox.style.top = this.box.top*toolContext.scale +"px";
        this.selBox.style.left = this.box.left*toolContext.scale +"px";
        this.selBox.style.width = this.box.width()*toolContext.scale + "px";
        this.selBox.style.height = this.box.height()*toolContext.scale + "px";
        return this;
    }
}

class LayoutArea{
    constructor(width, height){
        this.width = width;
        this.height = height;
        this.scale = 1;
    }

    getWidth(){ return this.width;}
    getHeight(){ return this.height;}
    setWidth(width){ this.width = width;}
    setHeight(height){ this.height = height;}

    getScale(){ return this.scale;}
    setScale(scale){ this.scale = scale;}

    getCanvasWidth(){ return this.width*this.scale;}
    getCanvasHeight(){ return this.height*this.scale;}

    getCanvasPoint(x, y){ return {x: x*this.scale, y: y*this.scale};}
    getRealPoint(x, y){ return {x: x/this.scale, y: y/this.scale};}
}

let animationCtx = new animationContext();
let layoutArea = new LayoutArea(2, 2);
let ledStrip = new LedStrip(0, []);
animationCtx.setLedStrip(ledStrip);

let layoutSelectBox = new SelectBox(document.getElementById("layout-sel-box"));
let statusLineCoordinates = document.getElementById("layout-status-line-coordinates")
let statusLineLedNumber = document.getElementById("layout-status-line-led-number")

let toolContext = {
    brushColor: [255, 0, 0],
    current_group: -1,
    scale: 1,
}

var layoutTab = document.getElementById("layout-tab")

layoutTab.addEventListener("shown.bs.tab", ()=>{
    drawFrame();
    layoutSelectBox.setSelBox(document.getElementById("layout-sel-box"))
    statusLineCoordinates = document.getElementById("layout-status-line-coordinates")
    statusLineLedNumber = document.getElementById("layout-status-line-led-number")
});

var animationTab = document.getElementById("animation-tab")

animationTab.addEventListener("shown.bs.tab", ()=>{
    drawFrame();
    updateAnimationList();
    updateThumbnails();
    layoutSelectBox.setSelBox(document.getElementById("animation-sel-box"))
    statusLineCoordinates = document.getElementById("animation-status-line-coordinates")
    statusLineLedNumber = document.getElementById("animation-status-line-led-number")
});

var effectsTab = document.getElementById("effects-tab")

effectsTab.addEventListener("shown.bs.tab", ()=>{
    resizeCanvasToContainer();
    drawFrame();
    updateAnimationSelectLists();
});


function updateFrames(led, action){
    animationCtx.animations.forEach((anim,animIndex) => {
        anim.frames.forEach((frame, frameIndex)=> {
            if(action == 'add')
                frame.add(led.index);
            else if(action == 'change')
                frame.change(led.index, led.newIndex);
            else
                frame.remove(led.index, 1);
        });
    });

}

function addFrame() {
    const newFrame = new frame(ledStrip.ledCount);
    animationCtx.getCurrentAnimation().addFrameAtIndex(animationCtx.getCurrentFrameIndex()+1, newFrame);
    animationCtx.setCurrentFrame(animationCtx.getCurrentFrameIndex()+1);
    updateThumbnails();
    drawFrame();
}

function getActiveTab(){
    const activeTab = document.querySelector('.tab-header.active');
    return activeTab.id;
}

function drawEmptyFrame(){
    if(getActiveTab() == 'layout-tab'){
        const ctx = canvasLayout.getContext('2d');
        ctx.clearRect(0, 0, toolContext.canvasWidth, toolContext.canvasHeight);
    }
    else if(getActiveTab() == 'animation-tab'){
        const ctx = canvasAnimation.getContext('2d');
        ctx.clearRect(0, 0, toolContext.canvasWidth, toolContext.canvasHeight);
    }
    else if(getActiveTab() == 'effects-tab'){
        const ctx = canvasEffects.getContext('2d');
        ctx.clearRect(0, 0, toolContext.canvasWidth, toolContext.canvasHeight);
    }
}

function drawFrame(){
    if(getActiveTab() == 'layout-tab'){
        drawFrameLayout();
    }
    else if(getActiveTab() == 'animation-tab'){
        drawFrameAnimation();
    }
    else if(getActiveTab() == 'effects-tab'){
        audioDrawFrame();
    }

}

function drawFrameLayout() {
    const ctx = canvasLayout.getContext('2d');
    ctx.clearRect(0, 0, toolContext.canvasWidth, toolContext.canvasHeight);

    p = new Path2D();
    ctx.strokeStyle = `rgb(157, 157, 157)`;
    ctx.beginPath();
    ledStrip.ledPath.forEach((point, index) => {
        ctx.lineTo(point.x + 10, point.y + 10);
    });
    ctx.stroke();
    ledStrip.ledPath.forEach((point, index) => {
        p = new Path2D();
        if(ledStrip.isDisabled(index)){ 
            ctx.fillStyle = `rgb(185, 185, 185)`;
        }
        else{
            ctx.fillStyle = "black";
        }
        p.roundRect(point.x, point.y, 20, 20, 20);
        ctx.fill(p);
    });
    
    document.getElementById('layout-status-line-selected-leds').textContent = `${toolContext.selectTool.get_selected_leds_count()}`;
    toolContext.selectTool.get_selected_leds().forEach((led, index) =>{
        p = new Path2D();
        const point = ledStrip.ledPath[led.index]
        p.roundRect(point.x-1, point.y-1, 22, 22, 20)
        ctx.strokeStyle = "rgb(89, 0, 255)";
        ctx.stroke(p);              
    });
}

function drawLayoutSelectionBox(selBox, point1, point2){
    selBox.style.top = Math.min(point1.y,point2.y) +"px";
    selBox.style.left = Math.min(point1.x,point2.x) +"px";
    selBox.style.width = Math.abs(point2.x-point1.x) + "px";
    selBox.style.height = Math.abs(point2.y-point1.y) + "px";
}

function drawFrameAnimation() {
    let frame = animationCtx.getCurrentFrame();
    const ctx = canvasAnimation.getContext('2d');
    ctx.clearRect(0, 0, toolContext.canvasWidth, toolContext.canvasHeight);
    p = new Path2D();
    ctx.strokeStyle = `rgb(157, 157, 157)`;
    ctx.beginPath();
    ledStrip.ledPath.forEach((point, index) => {
        ctx.lineTo(point.x + 10, point.y + 10);
    });
    ctx.stroke();
    if(frame){
        frame.leds.forEach((color, index) => {
            p = new Path2D();
            if(!ledStrip.isDisabled(index)){
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                p.roundRect(ledStrip.ledPath[index].x, ledStrip.ledPath[index].y, 20, 20, 20);
                ctx.fill(p);
            }
        });
    }
    else{
        ledStrip.ledPath.forEach((point, index) => {
            p = new Path2D();
            if(!ledStrip.isDisabled(index)){ 
                ctx.fillStyle = "black";
                p.roundRect(point.x, point.y, 20, 20, 20);
                ctx.fill(p);
            }
        });
    }
    document.getElementById('animation-status-line-selected-leds').textContent = `${toolContext.selectTool.get_selected_leds_count()}`;
    toolContext.selectTool.get_selected_leds().forEach((led, index) =>{
        if(!ledStrip.isDisabled(led.index)){
            p = new Path2D();
            const point = ledStrip.ledPath[led.index]
            p.roundRect(point.x-1, point.y-1, 22, 22, 20)
            ctx.strokeStyle = "rgb(89, 0, 255)";
            ctx.stroke(p);              
        }
    });
}

function audioDrawFrame() {
    const ctx = ledCanvasEffects.getContext('2d');
    ctx.clearRect(0, 0, ledCanvasEffects.width, ledCanvasEffects.height);    
    p = new Path2D();
    ctx.beginPath();
    ctx.strokeStyle = `rgb(157, 157, 157)`;
    ledStrip.ledPath.forEach((point, index) => {
        ctx.lineTo(point.x + 10, point.y + 10);
    });
    ctx.stroke();

    let frame = animationCtx.getCurrentFrame();
    ledStrip.ledPath.forEach((color, index) => {
        p = new Path2D();
        if(!ledStrip.isDisabled(index)){
            if(frame){
                color = frame.leds[index];
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            }
            else
                ctx.fillStyle = "black";
            
            p.roundRect(ledStrip.ledPath[index].x, ledStrip.ledPath[index].y, 20, 20, 20);
            ctx.fill(p);
        }
    });
}

function duplicateFrame() {
    let frame = animationCtx.getCurrentFrame();
    if (frame != undefined) {
        const currentFrameData = frame;
        const newFrame = new frame(currentFrameData.leds.length);
        for(let i = 0; i < currentFrameData.leds.length; i++) {
            newFrame.leds[i] = [...currentFrameData.leds[i]];
        }
        animationCtx.getCurrentAnimation().addFrameAtIndex(animationCtx.getCurrentFrameIndex() + 1, newFrame);    
        animationCtx.setCurrentFrame(animationCtx.getCurrentFrameIndex() + 1);
        updateThumbnails();
        drawFrame();
    }
}

function deleteFrame() { 
    let frame = animationCtx.getCurrentFrame();
    if (frame != undefined) { 
        animationCtx.getCurrentAnimation().removeFrame(animationCtx.getCurrentFrameIndex()); 
        if (animationCtx.getCurrentFrameIndex() >= animationCtx.getCurrentAnimation().getFrameCount())
            animationCtx.setCurrentFrame(animationCtx.getCurrentFrameIndex() - 1); 
        drawFrame(); 
        updateThumbnails();
        if(animationCtx.getCurrentAnimation().getFrameCount() == 0)
            drawEmptyFrame()
    } 
}

function dragFrameStart(event) {
    const frameIndex = parseInt(event.target.innerText) - 1;
    event.dataTransfer.setData('text/plain', frameIndex);
    event.target.classList.add('dragging');
}

function dragFrameOver(event) {
    event.preventDefault();
    const draggedFrame = document.querySelector('.dragging');
    const thumbnails = document.querySelectorAll('.frame-thumbnail');
    const targetFrame = event.target.closest('.frame-thumbnail');
    
    if (!targetFrame || targetFrame === draggedFrame) return;

    const targetIndex = Array.from(thumbnails).indexOf(targetFrame);
    const draggedIndex = Array.from(thumbnails).indexOf(draggedFrame);
    
    if (targetIndex > draggedIndex) {
        targetFrame.parentNode.insertBefore(draggedFrame, targetFrame.nextSibling);
    } else {
        targetFrame.parentNode.insertBefore(draggedFrame, targetFrame);
    }
}

function dragFrameEnd(event) {
    event.target.classList.remove('dragging');
    const thumbnails = event.target.parentNode.querySelectorAll('.frame-thumbnail');
    
    const newOrder = Array.from(thumbnails).map(thumb => parseInt(thumb.dataset.frameIndex));
    
    // Reorder frames in animation
    const newFrames = newOrder.map(index => animationCtx.getCurrentAnimation().getFrame(index));
    animationCtx.getCurrentAnimation().setFrames(newFrames);
    animationCtx.setCurrentFrame(newOrder.indexOf(animationCtx.getCurrentFrameIndex()));
    updateThumbnails();
    drawFrame();
}

function generateFrameThumbnail(frame){
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = 60;
    thumbnailCanvas.height = 60;
    const thumbnailCtx = thumbnailCanvas.getContext('2d');
    
    // Draw a scaled-down version of the frame
    const scale = 60/Math.max(toolContext.canvasHeight, toolContext.canvasWidth); // Scale factor for the thumbnail
    const offsetX = (60 - scale*toolContext.canvasWidth)/2;
    const offsetY = (60 - scale*toolContext.canvasHeight)/2;
    // Draw LEDs on the thumbnail canvas
    thumbnailCtx.fillStyle = "white";
    thumbnailCtx.fillRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    
    ledStrip.ledPath.forEach((point, ledIndex) => {
        if (frame.leds[ledIndex] && !ledStrip.isDisabled(ledIndex)) {
            const color = frame.leds[ledIndex];
            thumbnailCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            thumbnailCtx.fillRect(
                offsetX + point.x * scale, 
                offsetY + point.y * scale, 
                2, 2
            );
        }
    });
    return thumbnailCanvas
}

// Update the updateThumbnails function to add drag and drop attributes
function updateThumbnails() {
    if(animationCtx.getCurrentAnimationIndex() == -1) return;
    let timeline = undefined;
    if(getActiveTab() == "animation-tab")
        timeline = frameThumbnails
    else if(getActiveTab() == "effects-tab")
        timeline = effectFrameThumbnails;
    timeline.innerHTML = '';
    animationCtx.getCurrentAnimation().getFrames().forEach((frame, index) => {
        const div = document.createElement('div');
        div.classList.add("frame-thumbnail");
        // Create a small canvas for the thumbnail
        const thumbnailCanvas = generateFrameThumbnail(frame);    
        // Append the canvas to the div
        div.appendChild(thumbnailCanvas);
        if(index == animationCtx.getCurrentFrameIndex())
            div.classList.add('frame-thumbnail-current');

        //make frames drageable in animation tab
        if(getActiveTab() == "animation-tab"){
            div.draggable = true;
            div.addEventListener('dragstart', dragFrameStart);
            div.addEventListener('dragover', dragFrameOver);
            div.addEventListener('dragend', dragFrameEnd);
        }
        div.onclick = () => {
            timeline.children.item(animationCtx.getCurrentFrameIndex()).classList.remove('frame-thumbnail-current')
            animationCtx.setCurrentFrame(index);
            timeline.children.item(animationCtx.getCurrentFrameIndex()).classList.add('frame-thumbnail-current');
            drawFrame(); 
        };
        div.dataset.frameIndex = index;
        timeline.appendChild(div);
    });
}

function selectFrame(index){
    if(index >= 0 && index <= animationCtx.getCurrentAnimation().getFrameCount())
    {
        animationCtx.setCurrentFrame(index);
        drawFrame();
        updateThumbnails();
    }
}


function fixPointScale(event){
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return layoutArea.getRealPoint(x, y);
}




function addLedStrip() {
    saveState();
    if(ledStrip == undefined)
    {  
        ledStrip = new LedStrip(0, []);
        audioToolContext.audioCtrl.setLedStrip(ledStrip);
    }
    const ledCount = parseInt(document.getElementById('ledCount').value);
    const spacing = Math.min(toolContext.canvasWidth / ledCount, 24);
    for(i = 0;i < ledCount;i++) {
        x = spacing*i+10;
        y = 50;
        ledStrip.push({x,y})
        updateFrames({index: ledStrip.length-1}, 'add');
    }
    drawFrame();
    
}

function deleteSelectedLeds() {
    if (toolContext.selectTool.get_selected_leds_count() === 0) return;
    
    // Sort selected LEDs by index in descending order to avoid index shifting issues
    const sortedSelected = [...toolContext.selectTool.get_selected_leds()].sort((a, b) => b.index - a.index);
    // Remove LEDs from the path and colors array
    sortedSelected.forEach(led => {
        ledStrip.remove(led.index);
        updateFrames({index: led.index}, 'del');
    });
    
    // Reconnect remaining LEDs
    toolContext.selectTool.clear_selected_leds();
    drawFrame();
}



function insertSelectedLeds() {
    toolContext.insertTool.activate(canvasLayout);
}

function insertLedsAtPosition(position) {
    if (toolContext.selectTool.get_selected_leds_count() === 0) return;
    let positionLed = ledStrip.ledPath[position];
    // Create a copy of selected LEDs
    const selectedLeds = [...toolContext.selectTool.get_selected_leds()];
    // Remove selected LEDs from their current positions
    let leds = [];
    const sortedSelected = selectedLeds.sort((a, b) => b.index - a.index);
    sortedSelected.forEach(led => {
        ledStrip.ledPath.splice(led.index, 1);
        leds.push({index: led.index, newIndex: 0, action: 'del'});
    });
    
    // Insert LEDs at the new position
    const newLeds = [];
    selectedLeds.forEach(led => {
        newLeds.push({
            x: led.x,
            y: led.y
        });
    });
    position = ledStrip.ledPath.findIndex((led) => led === positionLed);
    ledStrip.ledPath.splice(position, 0, ...newLeds);
    
    leds.forEach((led, index) => {
        led.newIndex = position + index;
    });
    animationCtx.getAnimations().forEach((anim,animIndex) => {
        anim.getFrames().forEach((frame, frameIndex)=> {
            colors = [];
            leds.forEach((led,index) => colors.push(frame.leds[led.index]));
            leds.forEach((led,index) => frame.remove(led.index, 1));
            leds.forEach((led,index) => frame.add(led.newIndex, 1));
            leds.forEach((led,index) => frame.setColor(led.newIndex, colors[index]));
        });
    });
    // Update selected LEDs with new indices
    toolContext.selectTool.get_selected_leds().forEach((led, i) => {
        const newIndex = ledStrip.ledPath.findIndex(p => p.x === led.x && p.y === led.y);
        led.index = newIndex;
    });
    
    drawFrame();
}

function duplicateSelectedLeds() {
    if (toolContext.selectTool.get_selected_leds_count() === 0) return;
    
    // Create new LEDs with offset
    const newLeds = [];
    toolContext.selectTool.get_selected_leds().forEach(led => {
        newLeds.push({
            x: led.x + 10,
            y: led.y + 10,
        });
    });
    
    // Add new LEDs to the path
    ledStrip.ledPath.push(...newLeds);
    let position = ledStrip.ledCount;
    ledStrip.ledCount += newLeds.length;
    
    newLeds.forEach((led,index) => updateFrames({index: position+index}, 'add'));

    // Update selected LEDs to the newly duplicated ones
    toolContext.selectTool.clear_selected_leds();
    let newSelectedLeds = [];
    newLeds.forEach((led, index) => {
        newSelectedLeds.push({
            x: led.x,
            y: led.y,
            index: ledStrip.ledPath.length - newLeds.length + index,
        });
    });
    toolContext.selectTool.set_selected_leds([...newLeds]);
    
    drawFrame();
}

toolContext.insertTool = new insertTool(ledStrip);
toolContext.drawTool = new drawTool(ledStrip);
toolContext.selectTool = new selectTool(ledStrip, layoutSelectBox);
toolContext.brushTool = new brushTool(ledStrip, animationCtx);
toolContext.active_tool = toolContext.selectTool;

canvasLayout.addEventListener('mousemove', (event) => {
    const {x,y} = fixPointScale(event);
    statusLineCoordinates.textContent = `${Math.floor(x)} / ${Math.floor(y)}`
    const led = ledStrip.get_led_at({x, y})
    statusLineLedNumber.textContent = (led.index == -1) ? '-' : statusLineLedNumber.textContent = `${led.index+1}`;
});


canvasAnimation.addEventListener('mousemove', (event) => {
    statusLineCoordinates.textContent = `${event.offsetX} / ${event.offsetY}`
    led = ledStrip.get_led_at({x:event.offsetX, y:event.offsetY})
    statusLineLedNumber.textContent = (led.index == -1) ? '-' : statusLineLedNumber.textContent = `${led.index+1}`;
});


function zoom(event){
    event.preventDefault();
        toolContext.scale += event.deltaY * -0.001;
        let cc = document.querySelector('.canvas-container')
        let scaleMin = Math.min(cc.clientHeight/toolContext.canvasHeight, cc.clientWidth/toolContext.canvasWidth)
        // Restrict scale
        layoutArea.setScale(Math.min(Math.max(scaleMin, layoutArea.getScale()), 2));
        
        // Apply scale transform
        //canvasLayout.style.zoom = `${toolContext.scale}`;
        //canvasAnimation.style.zoom = `${toolContext.scale}`;
        //canvasEffects.style.zoom = `${toolContext.scale}`;
}


canvasAnimation.addEventListener('wheel', (event) => {
    if(event.ctrlKey){
        zoom(event);     
    }
});

canvasEffects.addEventListener('wheel', (event) => {
    if(event.ctrlKey){
        zoom(event);     
    }
});

canvasLayout.addEventListener('wheel', (event) => {
    if(event.ctrlKey){
        zoom(event);
        
    }
});

brushColorInput.addEventListener('input', () => {
    const hex = brushColorInput.value;
    toolContext.brushColor = [parseInt(hex.substr(1,2), 16), parseInt(hex.substr(3,2), 16), parseInt(hex.substr(5,2), 16)];
});

function get_current_canvas(){

    if(getActiveTab() == "animation-tab")
        return canvasAnimation;
    else if(getActiveTab() == "effects-tab")
        return canvasEffects;
    else
        return canvasLayout;
}

function paint_tool(){ 
    toolContext.active_tool.deactivate(get_current_canvas()); 
    toolContext.brushTool.activate(get_current_canvas()); 
    toolContext.active_tool = toolContext.brushTool; 
}

function select_tool(){ 
    toolContext.active_tool.deactivate(get_current_canvas()); 
    toolContext.selectTool.activate(get_current_canvas()); 
    toolContext.active_tool = toolContext.selectTool; 
    layoutSelectBox.setMode("selected");
}

function draw_tool(){ 
    toolContext.active_tool.deactivate(get_current_canvas()); 
    toolContext.drawTool.activate(get_current_canvas()); 
    toolContext.active_tool = toolContext.drawTool; 
    layoutSelectBox.setMode("none");
}

function paintSelected(){
    toolContext.selectTool.get_selected_leds().forEach((led, index) =>{
        animationCtx.getCurrentFrame().setColor(led.index, toolContext.brushColor);
    });
    drawFrame();
}

function rotate90Deg(center, point){
    let rotate_angle = 90;
    try{
        rotate_angle = parseFloat(document.getElementById("rotate_angle").value);
    }
    catch(e){
        rotate_angle = 90;
    }
    let distance = Math.sqrt(Math.pow(point.x - center.x,2)+Math.pow(point.y - center.y,2));
    let angle = Math.atan2((point.y - center.y),(point.x - center.x));
    angle = angle + rotate_angle*Math.PI/180; 
    point.x = center.x + distance*Math.cos(angle);
    point.y = center.y + distance*Math.sin(angle);
}

function rotateTool(){
    const leds = toolContext.selectTool.get_selected_leds();
    center = {x:0,y:0};
    leds.forEach((led,index) =>{
        center.x += led.x;
        center.y += led.y;
    });
    center.x = center.x/leds.length;
    center.y = center.y/leds.length;
    leds.forEach((led, index) =>{
        rotate90Deg(center, ledStrip.ledPath[led.index]);
        led.x = ledStrip.ledPath[led.index].x;
        led.y = ledStrip.ledPath[led.index].y;
    });
    drawFrame();
}

function erase_tool(){
    toolContext.selectTool.get_selected_leds().forEach((led, index) =>{
        animationCtx.getCurrentFrame().setColor(led.index, [0,0,0]);
    });
    drawFrame();
}

function toggleSelectedLeds(){
    toolContext.selectTool.get_selected_leds().forEach((led, index) =>{
        if(ledStrip.isDisabled(led.index))  
            ledStrip.enable(led.index);
        else
            ledStrip.disable(led.index);
    });
    drawFrame();
}

function saveLedsConfig(){
    dumpObjectToJson(ledStrip, "led_config.json");
}

function dumpObjectToJson(obj, filename = "object.json") {
    const json = JSON.stringify(obj, null, 4);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


function loadLedsFromJson(loadedObj)
{
    drawEmptyFrame()
    ledStrip = new LedStrip(loadedObj.ledCount, loadedObj.ledPath);
    audioToolContext.audioCtrl.setLedStrip(ledStrip);
    document.getElementById('areaWidth').value = loadedObj.width;    
    document.getElementById('areaHeight').value = loadedObj.height;
    canvasDImChange();

    if(loadedObj.leds)
    {
        loadedObj.leds.forEach((led, index) => {
            if(led)
                ledStrip.disable(index);
            else
                ledStrip.enable(index);
        });
    }
}

function loadLedsConfig(event){
    const file = event.target.files[0];
    loadObjectFromJson(file, loadLedsFromJson);
}

function loadObjectFromJson(file, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const obj = JSON.parse(event.target.result);
        callback(obj);
    };
    reader.readAsText(file);
}

function clearGroups()
{
    animationCtx.getCurrentAnimation().removeGroup(toolContext.current_group);
    toolContext.current_group -= 1;
    if(toolContext.current_group == -1 && animationCtx.getCurrentAnimation().getGroupCount() > 0)
        toolContext.current_group = 0;
    updateGroupList();
}

function addGroup(){
    group = {ledCount: toolContext.selectTool.get_selected_leds_count(), ledList: [...toolContext.selectTool.get_selected_leds()], selected: false};
    animationCtx.getCurrentAnimation().addGroup(group);
    toolContext.current_group = animationCtx.getCurrentAnimation().getGroupCount() - 1;
    updateGroupList();
}

function selectGroup(index){
    let group = animationCtx.getCurrentAnimation().getGroup(index);
    toolContext.current_group = index;
    toolContext.selectTool.set_selected_leds([...group.ledList])
    layoutSelectBox.setMode("selected");
}

function removeGroup(index){
    animationCtx.getCurrentAnimation().removeGroup(index);
    if(index >= toolContext.current_group)
    {
        toolContext.current_group -= 1;
    }
    updateGroupList();
}

function dragGroupStart(event) {
    const frameIndex = parseInt(event.target.innerText) - 1;
    event.dataTransfer.setData('text/plain', frameIndex);
    event.target.classList.add('dragging');
}

function dragGroupOver(event) {
    event.preventDefault();
    const draggedGroup = document.querySelector('.dragging');
    const groups = document.querySelectorAll('.led-group');
    const targetGroup = event.target.closest('.led-group');
    
    if (!targetGroup || targetGroup === draggedGroup) return;

    const targetIndex = Array.from(groups).indexOf(targetGroup);
    const draggedIndex = Array.from(groups).indexOf(draggedGroup);
    
    if (targetIndex > draggedIndex) {
        targetGroup.parentNode.insertBefore(draggedGroup, targetGroup.nextSibling);
    } else {
        targetGroup.parentNode.insertBefore(draggedGroup, targetGroup);
    }
}

function dragGroupEnd(event) {
    event.target.classList.remove('dragging');
    const groups = document.querySelectorAll('.led-group');
    
    const newOrder = Array.from(groups).map(thumb => parseInt(thumb.dataset.groupIndex));
    
    // Reorder frames in animation
    const newGroups = newOrder.map(index => animationCtx.getCurrentAnimation().getGroup(index));
    animationCtx.getCurrentAnimation().setGroups(newGroups);
    
    toolContext.current_group = newOrder.indexOf(toolContext.current_group);
    updateGroupList();
    drawFrame();
}

function updateGroupList() {
    if(animationCtx.getCurrentAnimationIndex() == -1) return;
    ledGroupList.innerHTML = '';
    animationCtx.getCurrentAnimation().getGroups().forEach((group, index) => {
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.classList.add('led-group');
        if(toolContext.current_group == index)
            li.classList.add('selected-item');
        li.innerHTML = `<input id=Group${index} type="checkbox"/>
            Group ${index + 1} (${group.ledCount} LEDs)`;
        ledGroupList.appendChild(li);
        li.addEventListener('click', (event) => {
            if (event.target.type === "checkbox") {
                return;
            }
            if(ledGroupList.querySelector(".selected-item"))
                ledGroupList.querySelector(".selected-item").classList.remove('selected-item')
            selectGroup(index);
            ledGroupList.children.item(toolContext.current_group).classList.add('selected-item')
            drawFrame();
        });
        li.draggable = true;
        li.addEventListener('dragstart', dragGroupStart);
        li.addEventListener('dragover', dragGroupOver);
        li.addEventListener('dragend', dragGroupEnd);
        li.dataset.groupIndex = index;
        document.getElementById(`Group${index}`).checked = animationCtx.getCurrentAnimation().getGroup(index).selected;
        document.getElementById(`Group${index}`).addEventListener('click',()=>{
            animationCtx.getCurrentAnimation().getGroup(index).selected = document.getElementById(`Group${index}`).checked;
        });
    });
}

function createAnimation(){
    let name = animNameInput.value;
    animationCtx.addAnimation(new Animation())
    animationCtx.setCurrentAnimation(animationCtx.getAnimationCount() - 1);
    animationCtx.getCurrentAnimation().name = name;
    updateAnimationList();
}

function deleteAnimation(){
    animationCtx.removeAnimation(animationCtx.getCurrentAnimationIndex());
    animationCtx.setCurrentAnimation(animationCtx.getCurrentAnimationIndex() - 1);
    if(animationCtx.getCurrentAnimationIndex() == -1 && animationCtx.getAnimationCount() > 0)
        animationCtx.setCurrentAnimation(0);
    updateAnimationList()
}

function updateAnimationList() {
    let animationList = undefined;
    if(getActiveTab() == "animation-tab")
        animationList = document.getElementById('animation-list');    
    else if(getActiveTab() == "effects-tab")
        animationList = document.getElementById('effects-animation-list');
    
    animationList.innerHTML = '';
    animationCtx.getAnimations().forEach((anim, index) => {
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.innerHTML = `<input id=animation${index} type="checkbox"/>
            <label style="min-width: 30px;min-height: 20px;" id=animLabel${index}>${anim.name}</label>`;
        if(getActiveTab() == "animation-tab")
            li.innerHTML += `<input type="text" class="form-control hidden-input" id="animLabelEdit${index}">`;
        if(index == animationCtx.getCurrentAnimationIndex())
            li.classList.add('selected-item');

        animationList.appendChild(li);

        li.addEventListener('click', (event) =>{
            if (event.target.type === "checkbox")
                return;
            if(animationCtx.getCurrentAnimationIndex() != -1)
                animationList.children.item(animationCtx.getCurrentAnimationIndex()).classList.remove('selected-item');
            li.classList.add('selected-item');
            animationCtx.setCurrentAnimation(index);
        });
        
        if(getActiveTab() == "animation-tab"){
            let label = document.getElementById(`animLabel${index}`)
            let input = document.getElementById(`animLabelEdit${index}`)
            label.addEventListener('dblclick', () => {
                label.classList.add("hidden-input")
                input.value = label.textContent;
                input.classList.remove("hidden-input")
                input.focus();
            });

            const save = () => {
                label.textContent = input.value;
                label.classList.remove("hidden-input")
                input.classList.add("hidden-input")
                anim.name = label.textContent;
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });
        }
      
        document.getElementById(`animation${index}`).checked = animationCtx.getAnimation(index).selected;
        document.getElementById(`animation${index}`).addEventListener('click',()=>{
            animationCtx.getAnimation(index).selected = document.getElementById(`animation${index}`).checked;
        });
    });
}

function updateAnimationSelectLists()
{
    const effectAnim = document.getElementById("effect-anim");
    while (effectAnim.options.length > 0) {                
        effectAnim.remove(0);
    }
    animationCtx.animations.forEach((anim, index) => {
        effectAnim.options[effectAnim.options.length] = new Option(anim.name, index);
    }); 
}

function selectAnimation(index){
    animationCtx.setCurrentAnimation(index);
    animationCtx.setCurrentFrame(0);
    toolContext.current_group = -1;
    updateGroupList();
    updateThumbnails();
    drawFrame();
}

function loadAnimationFromFile(event){
    const file = event.target.files[0];
    loadObjectFromJson(file, (loadedObj) => {
        if(loadedObj.ledStrip){
            loadLedsFromJson(loadedObj.ledStrip);
        }

        if(loadedObj.animations)
        {
            loadedObj.animations.forEach((anim, index) => {
                animationCtx.addAnimation(new Animation().fromJson(anim));        
            });
        }
        else{
            animationCtx.addAnimation(new Animation().fromJson(loadedObj));
        }
        selectAnimation(animationCtx.getAnimationCount() - 1);
        updateAnimationList();
    });
}

function saveAnimationToFile(){
    dumpObjectToJson(animationCtx.getCurrentAnimation(), "led_config.json");
}

const colorSchemeMap = {
    'rainbow': rainbowColorScheme,
    'fade': fadeColorScheme,
    'random': randomColorScheme
};

function createAnimationOnGroup() {
    const framesCount = parseInt(document.getElementById('framesCount').value);
    const colorSchemeName = document.getElementById('colorScheme').value;
    const colorScheme = colorSchemeMap[colorSchemeName];
    const startFrame = animationCtx.getCurrentFrameIndex();
    
    if (framesCount <= 0 || !colorScheme) return;
    
    // Ensure we have enough frames starting from current frame
    while (animationCtx.getCurrentAnimation().getFrameCount() < startFrame + framesCount) {
        animationCtx.getCurrentAnimation().addFrame(new frame(ledStrip.ledCount));
    }
    
    // Get selected LEDs from the current group
    if(document.getElementById("apply-on-groups").checked)
    {
        let groupList = [];
        let groupIdx = 0;
        animationCtx.getCurrentAnimation().getGroups().forEach((group) =>{if(group.selected) groupList.push(group)});
        for (let frameIndex = startFrame; frameIndex < startFrame + framesCount; frameIndex++) {
            const frame = animationCtx.getCurrentAnimation().getFrame(frameIndex);

            // Calculate color for this frame based on the color scheme
            const color = colorScheme(frameIndex - startFrame, framesCount);

            // Apply color to all selected LEDs in this frame
            groupList[groupIdx++].ledList.forEach(led => {
                frame.leds[led.index] = [...color];
            });
            if(groupIdx == groupList.length)
                groupIdx = 0;
        }
    }
    else{
        const selectedLeds = toolContext.selectTool.get_selected_leds();
        if (!selectedLeds || selectedLeds.length === 0) return;
        
        // Apply color scheme to each frame starting from current frame
        for (let frameIndex = startFrame; frameIndex < startFrame + framesCount; frameIndex++) {
            const frame = animationCtx.getCurrentAnimation().getFrame(frameIndex);

            // Calculate color for this frame based on the color scheme
            const color = colorScheme(frameIndex - startFrame, framesCount);

            // Apply color to all selected LEDs in this frame
            selectedLeds.forEach(led => {
                frame.leds[led.index] = [...color];
            });
        }
    }
    
    // Update display
    drawFrame();
    updateThumbnails();
}

function randomColorScheme(frameIndex, totalFrames){
    const startColor = hexToRgb(document.getElementById('startColor').value);
    const endColor = hexToRgb(document.getElementById('endColor').value);

    return [
        Math.round(startColor[0] + (endColor[0] - startColor[0]) * Math.random()),
        Math.round(startColor[1] + (endColor[1] - startColor[1]) * Math.random()),
        Math.round(startColor[2] + (endColor[2] - startColor[2]) * Math.random())
    ];
}

function rainbowColorScheme(frameIndex, totalFrames) {
    const startColor = hexToRgb(document.getElementById('startColor').value);
    const endColor = hexToRgb(document.getElementById('endColor').value);
    const hue = (frameIndex / totalFrames) * 360;
    const rainbowColor = hslToRgb(hue / 360, 1, 0.5);
    
    // Blend between start and end colors
    const progress = 1 - Math.pow(100,-(frameIndex / totalFrames));
    return [
        Math.round(startColor[0] + (endColor[0] - startColor[0]) * progress),
        Math.round(startColor[1] + (endColor[1] - startColor[1]) * progress),
        Math.round(startColor[2] + (endColor[2] - startColor[2]) * progress)
    ];
}

function fadeColorScheme(frameIndex, totalFrames) {
    const startColor = hexToRgb(document.getElementById('startColor').value);
    const endColor = hexToRgb(document.getElementById('endColor').value);
    const progress = frameIndex / totalFrames;
    
    return [
        Math.round(startColor[0] + (endColor[0] - startColor[0]) * progress),
        Math.round(startColor[1] + (endColor[1] - startColor[1]) * progress),
        Math.round(startColor[2] + (endColor[2] - startColor[2]) * progress)
    ];
}

function hexToRgb(hex) {
    const r = parseInt(hex.substr(1,2), 16);
    const g = parseInt(hex.substr(3,2), 16);
    const b = parseInt(hex.substr(5,2), 16);
    return [r, g, b];
}

function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function playAnimation() {
    if (animationCtx.getCurrentAnimation().getFrameCount() === 0) return;
    playing = true;
    const interval = 1000 / 5;
    const saveCurrentFrame = animationCtx.getCurrentFrameIndex();
    animationCtx.setCurrentFrame(0)
    const playInterval = setInterval(() => {
        if (!playing || animationCtx.getCurrentFrameIndex() >= animationCtx.getCurrentAnimation().getFrameCount()) {
            clearInterval(playInterval);
            playing = false;
            animationCtx.setCurrentFrame(saveCurrentFrame);
            drawFrame();
            updateThumbnails();
            return;
        }
        drawFrame();
        updateThumbnails();
        animationCtx.setCurrentFrame(animationCtx.getCurrentFrameIndex() + 1);
    }, interval);
}

function prevFrame() { 
    if (animationCtx.getCurrentFrameIndex() > 0) 
    { 
        animationCtx.setCurrentFrame(animationCtx.getCurrentFrameIndex() - 1); 
        drawFrame(); updateThumbnails();
    }
}

function nextFrame() { 
    if (animationCtx.getCurrentFrameIndex() < animationCtx.getCurrentAnimation().getFrameCount() - 1) 
    { 
        animationCtx.setCurrentFrame(animationCtx.getCurrentFrameIndex() + 1); 
        drawFrame(); updateThumbnails(); 
    }
}

// Add keyboard shortcuts for toolbar buttons
document.addEventListener('keydown', function(event) {
   
    if (event.ctrlKey && event.key === 'z') {
        undo();
        event.preventDefault();
    } else if (event.ctrlKey && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        redo();
        event.preventDefault();
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    if(event.ctrlKey){
        switch(event.key.toLowerCase()) {
            case 'p':
                paintSelected();
                event.stopPropagation();
                break;
            case 's':
                select_tool();
                event.stopPropagation();
                break;
            case 'b':
                paint_tool();
                event.stopPropagation();
                break;
            case 'e':
                erase_tool();
                event.stopPropagation();
                break;
            case 'd':
                draw_tool();
                event.stopPropagation();
                break;
            case 'i':
                insertSelectedLeds();
                event.stopPropagation();
                break;
            case 'u':
                duplicateSelectedLeds();
                event.stopPropagation();
                break;
            case 'delete':
            case 'backspace':
                if(!event.target.id){
                    deleteSelectedLeds();
                    event.stopPropagation();
                }
                break;
            case 'tab':
                if(animationCtx.getCurrentAnimationIndex() != -1){ 
                    if (event.shiftKey) {
                        if(toolContext.current_group > 0)
                            selectGroup(toolContext.current_group - 1);
                    } else {
                        if(toolContext.current_group < animationCtx.getCurrentAnimation().getGroupCount() - 1)
                            selectGroup(toolContext.current_group + 1);
                    }
                }
                event.stopPropagation();
                break;
        }
    }
});

// Add tooltips to show keyboard shortcuts
const tooltips = {
    'move-tool': 'M - Move Tool',
    'paint-selected': 'P - Paint Selected',
    'select-tool': 'S - Select Tool',
    'paint-tool': 'B - Brush Tool',
    'erase-tool': 'E - Erase Tool',
    'draw-tool': 'D - Draw Tool',
    'insert-selected': 'I - Insert Selected',
    'duplicate-selected': 'U - Duplicate Selected',
    'delete-selected': 'Delete/Backspace - Delete Selected'
};

// Add tooltips to buttons
Object.entries(tooltips).forEach(([id, tooltip]) => {
    const button = document.getElementById(id);
    if (button) {
        button.title = tooltip;
    }
});

// Undo/Redo functionality
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50; // Maximum number of states to keep in history

function saveState() {
    // Create a deep copy of the current state
    console.log("data saved")
    const state = {
        animation: JSON.parse(JSON.stringify(animationCtx.animations)),
        ledStrip: JSON.parse(JSON.stringify(ledStrip)),
    };
    
    // Add to undo stack
    undoStack.push(state);
    
    // Clear redo stack when a new action is performed
    redoStack.length = 0;
    
    // Limit the size of the undo stack
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    
    // Update UI to reflect undo/redo availability
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    
    // Save current state to redo stack
    const currentState = {
        animation: JSON.parse(JSON.stringify(animationCtx.toJson())),
        ledStrip: JSON.parse(JSON.stringify(ledStrip)),
    };
    redoStack.push(currentState);
    
    // Restore previous state
    const previousState = undoStack.pop();
    animationCtx = new animationContext().fromJson(previousState.animation);
    ledStrip = new LedStrip(0, []).fromJson(previousState.ledStrip);
    animationCtx.setLedStrip(ledStrip);
    audioToolContext.audioCtrl.setLedStrip(ledStrip);
    toolContext.selectTool.clear_selected_leds();
    // Update UI
    updateThumbnails();
    drawFrame();
    updateGroupList();
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    const currentState = {
        animation: JSON.parse(JSON.stringify(animationCtx.toJson())),
        ledStrip: JSON.parse(JSON.stringify(ledStrip)),
    };
    undoStack.push(currentState);
    
    // Restore next state
    const nextState = redoStack.pop();
    animationCtx = new animationContext().fromJson(nextState.animation);
    ledStrip = new LedStrip(0, []).fromJson(nextState.ledStrip);
    animationCtx.setLedStrip(ledStrip);
    audioToolContext.audioCtrl.setLedStrip(ledStrip);
    toolContext.selectTool.clear_selected_leds();
    // Update UI
    updateThumbnails();
    drawFrame();
    updateGroupList();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');
    
    if (undoButton) {
        undoButton.disabled = undoStack.length === 0;
    }
    
    if (redoButton) {
        redoButton.disabled = redoStack.length === 0;
    }
}


// Modify existing functions to save state before making changes
const originalAddFrame = addFrame;
addFrame = function() {
    saveState();
    originalAddFrame();
};

const originalDeleteFrame = deleteFrame;
deleteFrame = function() {
    saveState();
    originalDeleteFrame();
};

const originalPaintSelected = paintSelected;
paintSelected = function() {
    saveState();
    originalPaintSelected();
};

const originalrotateTool = rotateTool;
rotateTool = function() {
    saveState();
    originalrotateTool();
};



const originalEraseTool = erase_tool;
erase_tool = function() {
    saveState();
    originalEraseTool();
};

const originalInsertLedsAtPosition = insertLedsAtPosition;
insertLedsAtPosition = function(position) {
    saveState();
    originalInsertLedsAtPosition(position);
};

const originalDuplicateSelectedLeds = duplicateSelectedLeds;
duplicateSelectedLeds = function() {
    saveState();
    originalDuplicateSelectedLeds();
};

const originalDeleteSelectedLeds = deleteSelectedLeds;
deleteSelectedLeds = function() {
    saveState();
    originalDeleteSelectedLeds();
};

const originalAddGroup = addGroup;
addGroup = function() {
    saveState();
    originalAddGroup();
};

const originalRemoveGroup = removeGroup;
removeGroup = function(index) {
    saveState();
    originalRemoveGroup(index);
};

const originalLoadAnimationFromFile = loadAnimationFromFile;
loadAnimationFromFile = function(event) {
    saveState();
    originalLoadAnimationFromFile(event);
};

const originalSaveAnimationToFile = saveAnimationToFile;
saveAnimationToFile = function() {
    saveState();
    originalSaveAnimationToFile();
};  

const originalToggleSelectedLeds = toggleSelectedLeds;
toggleSelectedLeds = function() {
    saveState();
    originalToggleSelectedLeds();
};

window.addEventListener('load', function () {
    const container = document.querySelector('.canvas-container');
    const width = document.getElementById('canvasWidth');
    const height = document.getElementById('canvasHeight')
    

    width.value = Math.floor(container.clientWidth)-1
    height.value = Math.floor(container.clientHeight)-1
    toolContext.canvasHeight = height.value;
    toolContext.canvasWidth = width.value;
    document.getElementById("ledCanvasLayout").width = width.value;
    document.getElementById("ledCanvasLayout").height = height.value;
    document.getElementById("ledCanvasAnimation").width = width.value;
    document.getElementById("ledCanvasAnimation").height = height.value;
    document.getElementById("ledCanvasEffects").width = width.value;
    document.getElementById("ledCanvasEffects").height = height.value;
  });

function canvasDImChange(){
    const width = parseInt(document.getElementById('canvasWidth').value);    
    const height = parseInt(document.getElementById('canvasHeight').value);
    ledStrip.setDim(width, height);
    toolContext.canvasHeight = height;
    toolContext.canvasWidth = width;
    document.getElementById("ledCanvasLayout").width = width;
    document.getElementById("ledCanvasLayout").height = height;
    document.getElementById("ledCanvasAnimation").width = width;
    document.getElementById("ledCanvasAnimation").height = height;
    document.getElementById("ledCanvasEffects").width = width;
    document.getElementById("ledCanvasEffects").height = height;
}


function toggleLayoutSidebar() {
    document.getElementById('layout-sidebar').classList.toggle('collapsed');
    document.getElementById('layout-close-sidebar').classList.toggle('collapsed');
}

function toggleAnimationSidebar() {
    document.getElementById('animation-sidebar').classList.toggle('collapsed');
    document.getElementById('animation-close-sidebar').classList.toggle('collapsed');
}


function toggleEffectsSidebar() {
    document.getElementById('effects-sidebar').classList.toggle('collapsed');
    document.getElementById('effects-close-sidebar').classList.toggle('collapsed');
}



function audioDrawFrame() {
    const ctx = ledCanvasEffects.getContext('2d');
    ctx.clearRect(25, 0, ledCanvasEffects.width-25, ledCanvasEffects.height-25);    
    p = new Path2D();
    ctx.beginPath();
    ctx.strokeStyle = `rgb(157, 157, 157)`;
    ledStrip.ledPath.forEach((point, index) => {
        ctx.lineTo(point.x + 10, point.y + 10);
    });
    ctx.stroke();

    let frame = animationCtx.getCurrentFrame();
    ledStrip.ledPath.forEach((color, index) => {
        p = new Path2D();
        if(ledStrip.isDisabled(index)){
            
        }
        else{
            if(frame){
                color = frame.leds[index];
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            }
            else
                ctx.fillStyle = "black";
            
            p.roundRect(ledStrip.ledPath[index].x, ledStrip.ledPath[index].y, 20, 20, 20);
            ctx.fill(p);
        }
        
    });
}

function loadEffectsFromFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        
        // Load LED strip
        if(data.ledStrip)
            loadLedsFromJson(data.ledStrip);
        
        // Load animations
        if(data.animations){
            animationCtx = new animationContext();
            data.animations.forEach((anim) => {
                animationCtx.addAnimation(new Animation().fromJson(anim));
            });
            animationCtx.setLedStrip(ledStrip);
            if(animationCtx.getAnimationCount() > 0){
                animationCtx.setCurrentAnimation(0);
                animationCtx.setCurrentFrame(0);
            }
        }

        // Load effects
        if(data.effects)
        {
            effects = data.effects.map(e => {
                const targetAnim = animationCtx.getAnimation(e.effect.animationIndex);
                const endAnimIndex = e.effect.settings?.endAnimationIndex;
                const endAnim = typeof endAnimIndex === "number" ? animationCtx.getAnimation(endAnimIndex) : undefined;
                let effect;
                
                if (e.effect.type === 'pulse') {
                    effect = new EffectPulse(targetAnim, e.effect.settings);
                } else if(e.effect.type === 'animation'){
                    effect = new EffectAnim(targetAnim, e.effect.settings);
                } else if(e.effect.type === 'trigger'){
                    effect = new EffectTriger(targetAnim, endAnim || targetAnim, e.effect.settings);
                }

                return {effect: effect, selected: false};
            });
            updateEffectList();
            updateEffectControl(-1);
            updateBandsInSpectrum();
        }
        drawFrame();
    };

    reader.readAsText(file);
}

