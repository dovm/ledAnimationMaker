
const canvas = document.getElementById('ledCanvas');
const frameRateInput = document.getElementById('frameRate');
const brushColorInput = document.getElementById('brushColor');
const animNameInput = document.getElementById('animName'); 
const ledList = document.getElementById('led-list');
const ledGroupList = document.getElementById('led-group-list');
const frameThumbnails = document.getElementById('frame-thumbnails');
const animationList = document.getElementById('animation-list');
const effectAnim = document.getElementById('effect-anim');


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
        jsObj.groups.forEach((group, index) =>{this.groups.push(group)})
        return this;
    }
}

class LedStrip {
    constructor(length, ledPath)
    {
        this.ledCount = length;
        this.ledPath = ledPath;
    }

    add(index, point)
    {
        this.ledCount += 1;
        this.ledPath.splice(index, 0, point);
    }

    remove(index){
        this.ledCount -= 1;
        this.ledPath.splice(index, 1);
    }

    push(point){
        if(point instanceof Array)
            this.ledCount += point.length;
        else
            this.ledCount += 1;
        this.ledPath.push(point);
    }

    fromJson(obj){
        obj.ledPath.forEach((led, index) => {
            this.push(led);
        });
        return this;
    }

}

let animation = [new Animation()];
let currentAnim = 0;
let currentFrame = -1;
let ledStrip = new LedStrip(0, []);
let toolContext = {
    active_tool: "select",
    moving: false,
    moving_led: undefined,
    painting: false,
    brushColor: [255, 0, 0],
    activeLedStrip: undefined,
    select_mode: "start",
    select_start: {x:0,y:0},
    select_end: {x:0,y:0},
    led_selected: [],
    current_group: -1
}

function addLedStrip() {
    if(ledStrip == undefined)
    {  
        ledStrip = new LedStrip(0, []);
    }
    const ledCount = parseInt(document.getElementById('ledCount').value);
    const spacing = Math.min(canvas.width / ledCount, 24);
    const lastLedCount = ledStrip.ledCount;
    for(i = 0;i < ledCount;i++) {
        x = spacing*i+10;
        y = 50;
        ledStrip.push({x,y})
    }
    //updateLedList();
    if(currentFrame < 0)
        addFrame()
    else
        updateFrames(lastLedCount, ledCount, 1);
}

function deleteLeds() {
    if (toolContext.led_selected.length > 0) {
        // Create array of indices in descending order to avoid index shifting issues
        const indices = [];
        toolContext.led_selected.forEach(led => {
            indices.push(led.index);
        });
        indices.sort((a, b) => b - a);
        
        // Remove LEDs from the strip
        indices.forEach(index => {
            ledStrip.remove(index);
        });

        // Update frames to remove the deleted LEDs
        updateFrames(indices[indices.length - 1], indices.length, 0);
        
        // Clear selection
        toolContext.led_selected = [];
        toolContext.select_mode = "start";
    }
    drawFrame(animation[currentAnim].frames[currentFrame]);
}




function playAnimation() {
    if (animation[currentAnim].frames.length === 0) return;
    playing = true;
    let i = 0;
    const interval = 1000 / frameRateInput.value;
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
    const frameRate = parseInt(frameRateInput.value);
    const header = new Uint8Array([frameRate, 3, ledStrip.ledCount >> 8, ledStrip.ledCount & 0xFF]);
    const data = new Uint8Array(animation[currentAnim].frames.flat().flat());
    const blob = new Blob([header, data], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'led_animation.bin';
    a.click();
}

function loadAnimation(){

}

function updateFrames(index, length, action){
    animation[currentAnim].frames.forEach(frame => {
        if(action == 1)
            frame.add(index, length);
        else
            frame.remove(index, length);
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function addFrame() {
    const newFrame = new frame(ledStrip.ledCount);
    animation[currentAnim].frames.splice(currentFrame+1, 0, newFrame);
    currentFrame++;
    updateThumbnails();
    drawFrame(newFrame);
}

function drawEmptyFrame(){
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawFrame(frame) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if(frame){
        p = new Path2D();
        ctx.beginPath();
        ledStrip.ledPath.forEach((point, index) => {
            ctx.lineTo(point.x + 10, point.y + 10);
        });
        ctx.stroke();
        frame.leds.forEach((color, index) => {
            p = new Path2D();
            p.roundRect(ledStrip.ledPath[index].x, ledStrip.ledPath[index].y, 20, 20, 20)
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fill(p);
        });
    }
    if(toolContext.active_tool == "draw"){
        p = new Path2D();
        ctx.beginPath();    
        const ledPath = toolContext.activeLedStrip.ledPath;
        ledPath.forEach((point, index) =>{
            ctx.lineTo(point.x + 10, point.y + 10);
        });
        ctx.stroke();
        ledPath.forEach((point, index) =>{
            p = new Path2D();
            p.roundRect(point.x, point.y, 20, 20, 40)
            ctx.fillStyle = "black";
            ctx.fill(p);
        })
    }
    else if(toolContext.select_mode == "selecting")
    {
        width = toolContext.select_end.x - toolContext.select_start.x;
        height = toolContext.select_end.y - toolContext.select_start.y;
        ctx.fillStyle = "rgba(50, 50, 50, 0.5)";
        ctx.fillRect(toolContext.select_start.x,toolContext.select_start.y, width, height);
        
    }
    else if(toolContext.select_mode == "selected")
    {
        toolContext.led_selected.forEach((led, index) =>{
            p = new Path2D();
            p.roundRect(led.point.x-1, led.point.y-1, 22, 22, 20)
            ctx.strokeStyle = "rgb(89, 0, 255)";
            ctx.stroke(p);              
        })
    }
}
function duplicateFrame() {
    if (animation[currentAnim].frames.length > 0) {
        const currentFrameData = animation[currentAnim].frames[currentFrame];
        const newFrame = new frame(currentFrameData.leds.length);
        for(let i = 0; i < currentFrameData.leds.length; i++) {
            newFrame.leds[i] = [...currentFrameData.leds[i]];
        }
        animation[currentAnim].frames.splice(currentFrame + 1, 0, newFrame);    
        currentFrame++;
        updateThumbnails();
        drawFrame(animation[currentAnim].frames[currentFrame]);
    }
}


function prevFrame() { if (currentFrame > 0) { drawFrame(animation[currentAnim].frames[--currentFrame]); updateThumbnails();} }
function nextFrame() { if (currentFrame < animation[currentAnim].frames.length - 1) { drawFrame(animation[currentAnim].frames[++currentFrame]); updateThumbnails(); }  }
function deleteFrame() { 
    if (animation[currentAnim].frames.length > 0) { 
        animation[currentAnim].frames.splice(currentFrame, 1); 
        if (currentFrame >= animation[currentAnim].frames.length)
            currentFrame--; 
        drawFrame(animation[currentAnim].frames[currentFrame]); 
        updateThumbnails();
        if(animation[currentAnim].frames.length == 0)
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
    const frameThumbnails = document.querySelectorAll('.frame-thumbnail');
    const targetFrame = event.target.closest('.frame-thumbnail');
    
    if (!targetFrame || targetFrame === draggedFrame) return;

    const targetIndex = Array.from(frameThumbnails).indexOf(targetFrame);
    const draggedIndex = Array.from(frameThumbnails).indexOf(draggedFrame);
    
    if (targetIndex > draggedIndex) {
        targetFrame.parentNode.insertBefore(draggedFrame, targetFrame.nextSibling);
    } else {
        targetFrame.parentNode.insertBefore(draggedFrame, targetFrame);
    }
}

function dragFrameEnd(event) {
    event.target.classList.remove('dragging');
    const frameThumbnails = document.querySelectorAll('.frame-thumbnail');
    const newOrder = Array.from(frameThumbnails).map(thumb => parseInt(thumb.innerText) - 1);
    
    // Reorder frames in animation
    const newFrames = newOrder.map(index => animation[currentAnim].frames[index]);
    animation[currentAnim].frames = newFrames;
    
    currentFrame = newOrder.indexOf(currentFrame);
    updateThumbnails();
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

// Update the updateThumbnails function to add drag and drop attributes
function updateThumbnails() {
    frameThumbnails.innerHTML = '';
    animation[currentAnim].frames.forEach((_, index) => {
        const div = document.createElement('div');
        // Create a small canvas for the thumbnail
        const thumbnailCanvas = document.createElement('canvas');
        thumbnailCanvas.width = 80;
        thumbnailCanvas.height = 40;
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        
        // Draw a scaled-down version of the frame
        const frame = animation[currentAnim].frames[index];
        const scale = 0.1; // Scale factor for the thumbnail
        
        // Draw LEDs on the thumbnail canvas
        thumbnailCtx.fillStyle = "white";
        thumbnailCtx.fillRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
        
        ledStrip.ledPath.forEach((point, ledIndex) => {
            if (frame.leds[ledIndex]) {
                const color = frame.leds[ledIndex];
                thumbnailCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                thumbnailCtx.fillRect(
                    point.x * scale, 
                    point.y * scale, 
                    2, 2
                );
            }
        });
        
        // Append the canvas to the div
        div.appendChild(thumbnailCanvas);
        div.classList.add('frame-thumbnail');
        if(index == currentFrame)
            div.classList.add('frame-thumbnail-current');
        //div.innerText = index + 1;
        div.draggable = true;
        div.addEventListener('dragstart', dragFrameStart);
        div.addEventListener('dragover', dragFrameOver);
        div.addEventListener('dragend', dragFrameEnd);
        div.onclick = () => { currentFrame = index; updateThumbnails(); drawFrame(animation[currentAnim].frames[currentFrame]); };
        frameThumbnails.appendChild(div);
    });
}

function brush_mousedown(event) {
    saveState();
    originalBrushMousedown(event);
};

function originalBrushMousedown(event){ toolContext.painting = true; }
function brush_mouseup(event){ toolContext.painting = false; }
function brush_mousemove(event){ 
    if (!toolContext.painting) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    ledStrip.ledPath.forEach((point, index) => {
        if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
            animation[currentAnim].frames[currentFrame].leds[index] = [...toolContext.brushColor];
        }
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function move_mousedown(event){
    saveState();
    originalMoveMousedown(event);
};

function originalMoveMousedown(event){
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if(toolContext.select_mode == "start")
    {
        ledStrip.ledPath.forEach((point, index) => {
                if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
                    toolContext.led_selected = [];
                    toolContext.led_selected.push({index, x: point.x, y: point.y, point});
                    toolContext.select_mode = "selected";
                    toolContext.move_start = {x,y};
                    toolContext.moving = true;
                }
        });
        if(toolContext.moving == false)
        {
            toolContext.select_start = {x,y};
            toolContext.select_end = {x,y};
            toolContext.select_mode = "selecting";
        }   
    }
    else if(toolContext.select_mode == "selected")
    {
        let found = false;
        toolContext.led_selected.forEach((point, index) => {
            if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
                toolContext.move_start = {x,y};
                toolContext.moving = true;
                found = true;
            }
        });
        if(!found){
            toolContext.led_selected = [];
            ledStrip.ledPath.forEach((point, index) => {
                    if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
                        toolContext.led_selected = [];
                        toolContext.led_selected.push({index, x: point.x, y: point.y, point});
                        toolContext.select_mode = "selected";
                        toolContext.move_start = {x,y};
                        toolContext.moving = true;
                    }
            });
            if(toolContext.led_selected.length == 0)
            {
                toolContext.select_start = {x,y};
                toolContext.select_end = {x,y};
                toolContext.select_mode = "selecting";
                toolContext.moving = false;
            }
        }
    }
}
function move_mouseup(event){
    if(toolContext.select_mode == "selecting")
    {
        start = {x:0, y:0};
        end = {x:0, y:0};
        start.x = Math.min(toolContext.select_start.x, toolContext.select_end.x)
        start.y = Math.min(toolContext.select_start.y, toolContext.select_end.y)
        end.x = Math.max(toolContext.select_start.x, toolContext.select_end.x)
        end.y = Math.max(toolContext.select_start.y, toolContext.select_end.y)
        toolContext.select_mode = "selected"
        ledStrip.ledPath.forEach((point, index) => {
                // Check if the point's bounding box intersects with the selection box
                const pointBox = {
                    left: point.x+5,
                    right: point.x + 15,
                    top: point.y + 5,
                    bottom: point.y + 15
                };
                
                const selectBox = {
                    left: start.x,
                    right: end.x,
                    top: start.y,
                    bottom: end.y
                };
                
                // Check for intersection between the two boxes
                const intersects = !(
                    pointBox.right < selectBox.left ||
                    pointBox.left > selectBox.right ||
                    pointBox.bottom < selectBox.top ||
                    pointBox.top > selectBox.bottom
                );
                
                if (intersects) {
                    toolContext.led_selected.push({index, x: point.x, y: point.y, point});
                }
        });
        if(toolContext.led_selected.length == 0)
        {
            toolContext.select_mode = "start";
            toolContext.led_selected = [];
        }
    }
    else if(toolContext.moving == true){
        toolContext.moving = false;
        toolContext.led_selected.forEach((led, index) =>{
            led.x = led.point.x;
            led.y = led.point.y; 
        });
    }
    drawFrame(animation[currentAnim].frames[currentFrame]);
}
function move_mousemove(event){
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if(toolContext.moving == true)
    {
        diffX = x - toolContext.move_start.x;
        diffY = y - toolContext.move_start.y;
        
        toolContext.led_selected.forEach((led, index) =>{
            led.point.x = led.x + diffX;
            led.point.y = led.y + diffY; 
        });
    }
    else if(toolContext.select_mode == "selecting")
    {
        toolContext.select_end = {x,y};
    }
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function brush_click(event){
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ledStrip.ledPath.forEach((point, index) => {
            if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
                animation[currentAnim].frames[currentFrame][index] = [...toolContext.brushColor];
            }
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
}
function move_click(event){
   
}

function draw_mousedown(event){
}
function draw_mouseup(event){}
function draw_mousemove(event){}
function draw_click(event){
    const rect = canvas.getBoundingClientRect();
    x = event.clientX - rect.left;
    y = event.clientY - rect.top;
    toolContext.activeLedStrip.ledCount += 1;
    toolContext.activeLedStrip.ledPath.push({x,y});
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function select_mousedown(event){
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if(toolContext.select_mode == "selected")
    {
        toolContext.led_selected = [];
    }
    toolContext.select_start = {x,y};
    toolContext.select_end = {x,y};
    toolContext.select_mode = "selecting";
}

function select_mouseup(event){
    start = {x:0, y:0};
    end = {x:0, y:0};
    start.x = Math.min(toolContext.select_start.x, toolContext.select_end.x)
    start.y = Math.min(toolContext.select_start.y, toolContext.select_end.y)
    end.x = Math.max(toolContext.select_start.x, toolContext.select_end.x)
    end.y = Math.max(toolContext.select_start.y, toolContext.select_end.y)
    toolContext.select_mode = "selected"
    ledStrip.ledPath.forEach((point, index) => {
            
        if(point.x > start.x && point.x < end.x && point.y > start.y && point.y < end.y){
                toolContext.led_selected.push({index, x: point.x, y: point.y, point})
            }
    });
    if(toolContext.led_selected.length == 0)
    {
        toolContext.select_mode = "start";
        toolContext.led_selected = [];
    }
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function select_mousemove(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if(toolContext.select_mode == "selecting")
    {
        toolContext.select_end = {x,y};
        drawFrame(animation[currentAnim].frames[currentFrame]);
    }
}

function select_click(event){
    //toolContext.select_mode = "start";
    //toolContext.led_selected = [];
    //toolContext.active_tool = "move";
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    toolContext.select_mode = "selected";
    ledStrip.ledPath.forEach((point, index) => {
            if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
                toolContext.led_selected.push({index, x: point.x, y: point.y, point})
            }
    });
    if(toolContext.led_selected.length == 0)
    {
        toolContext.select_mode = "start";
        toolContext.led_selected = [];
    }
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function deleteSelectedLeds() {
    if (toolContext.led_selected.length === 0) return;
    
    // Sort selected LEDs by index in descending order to avoid index shifting issues
    const sortedSelected = [...toolContext.led_selected].sort((a, b) => b.index - a.index);
    
    // Remove LEDs from the path and colors array
    sortedSelected.forEach(led => {
        ledStrip.ledPath.splice(led.index, 1);
        animation[currentAnim].frames[currentFrame].leds.splice(led.index, 1);
    });
    
    // Reconnect remaining LEDs
    toolContext.led_selected = [];
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function insertLedsClick(event) {
    if (toolContext.active_tool !== "insert" || toolContext.led_selected.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is on any LED
    let targetIndex = -1;
    ledStrip.ledPath.forEach((point, index) => {
        if (x >= point.x && x <= point.x + 20 && 
            y >= point.y && y <= point.y + 20) {
            targetIndex = index;
        }
    });
    
    if (targetIndex !== -1) {
        // Insert the selected LEDs at the target position
        insertLedsAtPosition(targetIndex);
        drawFrame(animation[currentAnim].frames[currentFrame]);
    }
    toolContext.active_tool = "move";
    canvas.style.cursor = "default";
    //canvas.removeEventListener('click', insertLedsClick);
}

function insertSelectedLeds() {
    toolContext.active_tool = "insert";
    canvas.style.cursor = "pointer";
    canvas.addEventListener('click', insertLedsClick);
}



function insertLedsAtPosition(position) {
    if (toolContext.led_selected.length === 0) return;
    
    // Create a copy of selected LEDs
    const selectedLeds = [...toolContext.led_selected];
    // Store the original colors before removing LEDs
    const originalColors = {};
    selectedLeds.forEach(led => {
        originalColors[led.index] = [...animation[currentAnim].frames[currentFrame].leds[led.index]];
    });
    // Remove selected LEDs from their current positions
    const sortedSelected = selectedLeds.sort((a, b) => b.index - a.index);
    sortedSelected.forEach(led => {
        ledStrip.ledPath.splice(led.index, 1);
        animation[currentAnim].frames[currentFrame].leds.splice(led.index, 1);
    });
    
    // Insert LEDs at the new position
    const newLeds = [];
    const colors = [];
    selectedLeds.forEach(led => {
        newLeds.push({
            x: led.x,
            y: led.y
        });
        colors.push(originalColors[led.index]);
    });
    
    ledStrip.ledPath.splice(position, 0, ...newLeds);
    animation[currentAnim].frames[currentFrame].leds.splice(position, 0, ...colors);
    
    // Update selected LEDs with new indices
    toolContext.led_selected.forEach((led, i) => {
        const newIndex = ledStrip.ledPath.findIndex(p => p.x === led.x && p.y === led.y);
        led.index = newIndex;
        led.point = ledStrip.ledPath[newIndex];
    });
    
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function duplicateSelectedLeds() {
    if (toolContext.led_selected.length === 0) return;
    
    // Get the last LED position
    const lastLed = ledStrip.ledPath[ledStrip.ledPath.length - 1];
    
    // Calculate offset to place duplicated LEDs after the last LED
    const offsetX = lastLed.x;
    const offsetY = lastLed.y;
    
    // Create new LEDs with offset
    const newLeds = [];
    const colors = [];
    toolContext.led_selected.forEach(led => {
        newLeds.push({
            x: led.x,
            y: led.y,
        });
        colors.push(animation[currentAnim].frames[currentFrame].leds[led.index]);
    });
    
    // Add new LEDs to the path
    ledStrip.ledPath.push(...newLeds);
    ledStrip.ledCount += newLeds.length;
    animation[currentAnim].frames[currentFrame].leds.push(...colors);
    
    // Update selected LEDs to the newly duplicated ones
    toolContext.led_selected = [];
    newLeds.forEach((led, index) => {
        toolContext.led_selected.push({
            x: led.x,
            y: led.y,
            index: ledStrip.ledPath.length - newLeds.length + index,
            point: led
        });
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

tool_callbacks = {
        brush: {mousedown: brush_mousedown, mouseup: brush_mouseup, mousemove: brush_mousemove, click: brush_click },
        move: {mousedown: move_mousedown, mouseup: move_mouseup, mousemove: move_mousemove, click: move_click},
        draw: {mousedown: draw_mousedown, mouseup: draw_mouseup, mousemove: draw_mousemove, click: draw_click},
        select: {mousedown: select_mousedown, mouseup: select_mouseup, mousemove: select_mousemove,  click: select_click },
        insert: {mousedown: insert_mousedown, mouseup: insert_mouseup, mousemove: insert_mousemove, click: insert_click }
    }

canvas.addEventListener('mousedown', (event) => {
   tool_callbacks[toolContext.active_tool].mousedown(event)
});

function insert_mousedown(event){}
function insert_mouseup(event){}
function insert_mousemove(event){}
function insert_click(){
    insertLedsClick
}

canvas.addEventListener('mouseup', () => {
    tool_callbacks[toolContext.active_tool].mouseup(event)
});

canvas.addEventListener('click', (event) => {
    tool_callbacks[toolContext.active_tool].click(event)
});

canvas.addEventListener('mousemove', (event) => {
    tool_callbacks[toolContext.active_tool].mousemove(event)
});

brushColorInput.addEventListener('input', () => {
    const hex = brushColorInput.value;
    toolContext.brushColor = [parseInt(hex.substr(1,2), 16), parseInt(hex.substr(3,2), 16), parseInt(hex.substr(5,2), 16)];
});

function paint_tool(){ toolContext.active_tool = "brush"}

function move_tool(){ toolContext.active_tool = "move"}

function select_tool(){ toolContext.active_tool = "select"}

function draw_tool(){ 
    if(toolContext.active_tool != "draw")
    {
        document.getElementById("drawButton").innerHTML = "finish drawing";
        toolContext.active_tool = "draw"
        let ledPath = [];
        let ledCount = 0
        toolContext.activeLedStrip = { ledCount, ledPath }
        if(currentFrame < 0)
            addFrame();
    }
    else
    {
        document.getElementById("drawButton").innerHTML = "draw";
        toolContext.active_tool = "move";
        const currentIndex = ledStrip.ledCount;
        toolContext.activeLedStrip.ledPath.forEach((point, index) => {
            ledStrip.push(point);
        });
        updateFrames(currentIndex, toolContext.activeLedStrip.ledCount, 1)
        toolContext.activeLedStrip = undefined;
    }
}

function paintSelected(){
    toolContext.led_selected.forEach((led, index) =>{
        animation[currentAnim].frames[currentFrame].leds[led.index] = [...toolContext.brushColor];
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function rotate90Deg(center, point){
    let distance = Math.sqrt(Math.pow(point.x - center.x,2)+Math.pow(point.y - center.y,2));
    let angle = Math.atan2((center.y - point.y),(center.x - point.x));
    angle = angle -= Math.PI/2; 
    point.x = center.x + distance*Math.cos(angle);
    point.y = center.y + distance*Math.sin(angle);
}

function rotateTool(){
    center = {x:0,y:0};
    toolContext.led_selected.forEach((led,index) =>{
        center.x += led.x;
        center.y += led.y;
    });
    center.x = center.x/toolContext.led_selected.length;
    center.y = center.y/toolContext.led_selected.length;
    console.log(center)
    toolContext.led_selected.forEach((led, index) =>{
        rotate90Deg(center, toolContext.led_selected[index].point);
        rotate90Deg(center, led);
        //animation[currentAnim].frames[currentFrame].leds[led.index] = [...toolContext.brushColor];
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function erase_tool(){
    toolContext.led_selected.forEach((led, index) =>{
        animation[currentAnim].frames[currentFrame].leds[led.index] = [0,0,0];
    });
    drawFrame(animation[currentAnim].frames[currentFrame]);
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
    animation[currentAnim].frames = [];
    currentFrame = -1;
    updateThumbnails();
    if(animation[currentAnim].frames.length == 0)
        drawEmptyFrame()
    ledStrip = loadedObj;
    if(ledStrip.ledPath == undefined)
    {
        let a = new LedStrip(0, []);
        ledStrip.forEach((strip, index) => {
            a.ledPath.push(...strip.ledPath);
        });
        a.ledCount = a.ledPath.length;
        ledStrip = a;
    }
    //updateLedList();
    addFrame()
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
    animation[currentAnim].groups = [];
    toolContext.current_group = -1;
    updateGroupList();
}

function addGroup(){
    group = {ledCount: toolContext.led_selected.length, ledList: [...toolContext.led_selected], selected: false};
    animation[currentAnim].groups.push(group);
    toolContext.current_group = animation[currentAnim].groups.length - 1;
    updateGroupList();
}

function selectGroup(index){
    group = animation[currentAnim].groups[index];
    toolContext.current_group = index;
    toolContext.led_selected = [...group.ledList]
    toolContext.select_mode = "selected";
    updateGroupList();
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function removeGroup(index){
    animation[currentAnim].groups.splice(index, 1);
    if(index >= toolContext.current_group)
    {
        toolContext.current_group -= 1;
    }
    updateGroupList();
}

function updateGroupList() {
    ledGroupList.innerHTML = '';
    animation[currentAnim].groups.forEach((group, index) => {
        const div = document.createElement('div');
        div.classList.add('led-group-item');
        if(toolContext.current_group == index)
            div.classList.add('selected-item');
        div.innerHTML = `<input id=Group${index} type="checkbox"/>
            Group ${index + 1} (${group.ledCount} LEDs)`;
            ledGroupList.appendChild(div);
        div.addEventListener('click', (event) => {
            if (event.target.type === "checkbox") {
                return;
            }
            selectGroup(index);
        });
        document.getElementById(`Group${index}`).checked = animation[currentAnim].groups[index].selected;
        document.getElementById(`Group${index}`).addEventListener('click',()=>{
            animation[currentAnim].groups[index].selected = document.getElementById(`Group${index}`).checked;
        });
    });
}

function createAnimation(){
    name = animNameInput.value;
    animation.push(new Animation())
    currentAnim = animation.length - 1;
    animation[currentAnim].name = name;
    updateAnimationList();
}

function deleteAnimation(index){
    animation.splice(index, 1);
    if(currentAnim >= index)
        currentAnim -= 1;
    updateAnimationList()
}

function updateAnimationList() {
    animationList.innerHTML = '';
     
    animation.forEach((anim, index) => {
        const div = document.createElement('div');
        div.classList.add('animation-item');
        div.innerHTML = `<input id=animation${index} type="checkbox"/>
            ${anim.name}`;
        if(index == currentAnim)
        {
            div.classList.add('selected-item');
        }
        animationList.appendChild(div);
        div.addEventListener('click', (event) =>{
            if (event.target.type === "checkbox") {
                return;
            }
            selectAnimation(index);
        });
        document.getElementById(`animation${index}`).checked = animation[index].selected;
        document.getElementById(`animation${index}`).addEventListener('click',()=>{
            animation[index].selected = document.getElementById(`animation${index}`).checked;
        });
    });

}

function selectAnimation(index){
    currentAnim = index;
    currentFrame = 0;
    toolContext.current_group = -1;
    updateAnimationList();
    updateThumbnails();
    updateGroupList();
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function loadAnimationFromFile(event){
    const file = event.target.files[0];
    loadObjectFromJson(file, (loadedObj) => {
        animation.push(new Animation().fromJson(loadedObj));
        selectAnimation(animation.length - 1);
    });
}

function saveAnimationToFile(){
    dumpObjectToJson(animation[currentAnim], "led_config.json");
}

const colorSchemeMap = {
    'rainbow': rainbowColorScheme,
    'fade': fadeColorScheme
};

function createAnimationOnGroup() {
    const framesCount = parseInt(document.getElementById('framesCount').value);
    const colorSchemeName = document.getElementById('colorScheme').value;
    const colorScheme = colorSchemeMap[colorSchemeName];
    const startFrame = currentFrame;
    
    if (framesCount <= 0 || !colorScheme) return;
    
    // Ensure we have enough frames starting from current frame
    while (animation[currentAnim].frames.length < startFrame + framesCount) {
        addFrame();
    }
    
    // Get selected LEDs from the current group
    const selectedLeds = toolContext.led_selected;
    if (!selectedLeds || selectedLeds.length === 0) return;
    
    // Apply color scheme to each frame starting from current frame
    for (let frameIndex = startFrame; frameIndex < startFrame + framesCount; frameIndex++) {
        const frame = animation[currentAnim].frames[frameIndex];
        
        // Calculate color for this frame based on the color scheme
        const color = colorScheme(frameIndex - startFrame, framesCount);
        
        // Apply color to all selected LEDs in this frame
        selectedLeds.forEach(led => {
            frame.leds[led.index] = [...color];
        });
    }
    
    // Update display
    drawFrame(animation[currentAnim].frames[currentFrame]);
    updateThumbnails();
}

function rainbowColorScheme(frameIndex, totalFrames) {
    const startColor = hexToRgb(document.getElementById('startColor').value);
    const endColor = hexToRgb(document.getElementById('endColor').value);
    const hue = (frameIndex / totalFrames) * 360;
    const rainbowColor = hslToRgb(hue / 360, 1, 0.5);
    
    // Blend between start and end colors
    const progress = frameIndex / totalFrames;
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

// Add keyboard shortcuts for toolbar buttons
document.addEventListener('keydown', function(event) {
   
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    switch(event.key.toLowerCase()) {
        case 'm':
            move_tool();
            event.stopPropagation();
            break;
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
            deleteSelectedLeds();
            event.stopPropagation();
            break;
        case 'tab':
            if (event.shiftKey) {
                if(toolContext.current_group > 0)
                    selectGroup(toolContext.current_group - 1);
            } else {
                if(toolContext.current_group < animation[currentAnim].groups.length - 1)
                    selectGroup(toolContext.current_group + 1);
            }
            event.stopPropagation();
            break;
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
    const state = {
        animation: JSON.parse(JSON.stringify(animation)),
        ledStrip: JSON.parse(JSON.stringify(ledStrip)),
        currentFrame: currentFrame,
        currentAnim: currentAnim,
        //toolContext: JSON.parse(JSON.stringify(toolContext))
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
        animation: JSON.parse(JSON.stringify(animation)),
        ledStrip: JSON.parse(JSON.stringify(ledStrip)),
        currentFrame: currentFrame,
        currentAnim: currentAnim,
        //toolContext: JSON.parse(JSON.stringify(toolContext))
    };
    redoStack.push(currentState);
    
    // Restore previous state
    const previousState = undoStack.pop();
    animation = [];
    previousState.animation.forEach((anim) => animation.push(new Animation().fromJson(anim)));
    ledStrip = new LedStrip(0, []).fromJson(previousState.ledStrip);
    currentFrame = previousState.currentFrame;
    currentAnim = previousState.currentAnim;
    //toolContext = previousState.toolContext;
    toolContext.led_selected = [];
    // Update UI
    updateThumbnails();
    drawFrame(animation[currentAnim].frames[currentFrame]);
    updateGroupList();
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    const currentState = {
        animation: JSON.parse(JSON.stringify(animation)),
        ledStrip: JSON.parse(JSON.stringify(ledStrip)),
        currentFrame: currentFrame,
        currentAnim: currentAnim,
        //toolContext: JSON.parse(JSON.stringify(toolContext))
    };
    undoStack.push(currentState);
    
    // Restore next state
    const nextState = redoStack.pop();
    animation = []
    nextState.animation.forEach((anim) => animation.push(new Animation().fromJson(anim)));
    ledStrip = new LedStrip(0, []).fromJson(nextState.ledStrip);
    currentFrame = nextState.currentFrame;
    currentAnim = nextState.currentAnim;
    //toolContext = nextState.toolContext;
    toolContext.led_selected = [];
    // Update UI
    updateThumbnails();
    drawFrame(animation[currentAnim].frames[currentFrame]);
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

// Add undo/redo buttons to toolbar
function addUndoRedoButtons() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;
    
    // Create undo button
    const undoButton = document.createElement('button');
    undoButton.id = 'undo-button';
    undoButton.innerHTML = '↩️';
    undoButton.title = 'Ctrl+Z - Undo';
    undoButton.disabled = true;
    undoButton.addEventListener('click', undo);
    
    // Create redo button
    const redoButton = document.createElement('button');
    redoButton.id = 'redo-button';
    redoButton.innerHTML = '↪️';
    redoButton.title = 'Ctrl+Y - Redo';
    redoButton.disabled = true;
    redoButton.addEventListener('click', redo);
    
    // Add buttons to toolbar
    toolbar.appendChild(undoButton);
    toolbar.appendChild(redoButton);
}

// Add keyboard shortcuts for undo/redo
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'z') {
        undo();
        event.preventDefault();
    } else if (event.ctrlKey && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
        redo();
        event.preventDefault();
    }
});

// Initialize undo/redo functionality
addUndoRedoButtons();

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

const originalSelectGroup = selectGroup;
selectGroup = function(index) {
    saveState();
    originalSelectGroup(index);
};

const originalSelectAnimation = selectAnimation;
selectAnimation = function(index) {
    saveState();
    originalSelectAnimation(index);
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







