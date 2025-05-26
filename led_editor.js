
const canvasLayout = document.getElementById('ledCanvasLayout');
const canvasAnimation = document.getElementById('ledCanvasAnimation');
const frameRateInput = document.getElementById('frameRate');
const brushColorInput = document.getElementById('brushColor');
const animNameInput = document.getElementById('animName'); 
const ledList = document.getElementById('led-list');
const ledGroupList = document.getElementById('led-group-list');
const frameThumbnails = document.getElementById('frame-thumbnails');
const animationList = document.getElementById('animation-list');
const effectAnim = document.getElementById('effect-anim');



let animation = [];
let currentAnim = -1
let currentFrame = -1;
let ledStrip = new LedStrip(0, []);
let toolContext = {
    canvasWidth: 500,
    canvasHeight: 500,
    active_tool: "select",
    moving: false,
    moving_led: undefined,
    painting: false,
    brushColor: [255, 0, 0],
    select_mode: "start",
    select_start: {x:0,y:0},
    select_end: {x:0,y:0},
    led_selected: [],
    current_group: -1,
    frameOverIndex: -1,
    scale: 1,
}

function loadAnimation(){

}

function updateFrames(led, action){
    animation.forEach((anim,animIndex) => {
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
    animation[currentAnim].frames.splice(currentFrame+1, 0, newFrame);
    currentFrame++;
    updateThumbnails();
    drawFrame();
}

function getActiveTab(){
    const activeTab = document.querySelector('.nav-link.active');
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
}

function drawFrame(){
    if(getActiveTab() == 'layout-tab'){
        drawFrameLayout();
    }
    else if(getActiveTab() == 'animation-tab'){
        drawFrameAnimation();
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
    if(toolContext.select_mode == "selecting")
    {
        width = toolContext.select_end.x - toolContext.select_start.x;
        height = toolContext.select_end.y - toolContext.select_start.y;
        ctx.fillStyle = "rgba(50, 50, 50, 0.5)";
        ctx.fillRect(toolContext.select_start.x, toolContext.select_start.y, width, height);
    }
    
    toolContext.led_selected.forEach((led, index) =>{
        p = new Path2D();
        p.roundRect(led.point.x-1, led.point.y-1, 22, 22, 20)
        ctx.strokeStyle = "rgb(89, 0, 255)";
        ctx.stroke(p);              
    });
}

function drawFrameAnimation() {
    let frame = undefined;
    const ctx = canvasAnimation.getContext('2d');
    ctx.clearRect(0, 0, toolContext.canvasWidth, toolContext.canvasHeight);
    if(animation.length > 0 && animation[currentAnim].frames.length > 0)
        frame = animation[currentAnim].frames[currentFrame];
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
    if(toolContext.select_mode == "selecting")
    {
        width = toolContext.select_end.x - toolContext.select_start.x;
        height = toolContext.select_end.y - toolContext.select_start.y;
        ctx.fillStyle = "rgba(50, 50, 50, 0.5)";
        ctx.fillRect(toolContext.select_start.x,toolContext.select_start.y, width, height);
        
    }
    toolContext.led_selected.forEach((led, index) =>{
        if(!ledStrip.isDisabled(led.index)){
            p = new Path2D();
            p.roundRect(led.point.x-1, led.point.y-1, 22, 22, 20)
            ctx.strokeStyle = "rgb(89, 0, 255)";
            ctx.stroke(p);              
        }
    });
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
        drawFrame();
    }
}

function deleteFrame() { 
    if (animation[currentAnim].frames.length > 0) { 
        animation[currentAnim].frames.splice(currentFrame, 1); 
        if (currentFrame >= animation[currentAnim].frames.length)
            currentFrame--; 
        drawFrame(); 
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
    
    const newOrder = Array.from(frameThumbnails).map(thumb => parseInt(thumb.dataset.frameIndex));
    
    // Reorder frames in animation
    const newFrames = newOrder.map(index => animation[currentAnim].frames[index]);
    animation[currentAnim].frames = newFrames;
    
    currentFrame = newOrder.indexOf(currentFrame);
    updateThumbnails();
    drawFrame();
}

// Update the updateThumbnails function to add drag and drop attributes
function updateThumbnails() {
    if(currentAnim == -1) return;
    frameThumbnails.innerHTML = '';
    animation[currentAnim].frames.forEach((_, index) => {
        const div = document.createElement('div');
        div.classList.add("frame-thumbnail");
        // Create a small canvas for the thumbnail
        const thumbnailCanvas = document.createElement('canvas');
        thumbnailCanvas.width = 60;
        thumbnailCanvas.height = 60;
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        
        // Draw a scaled-down version of the frame
        const frame = animation[currentAnim].frames[index];
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
        
        // Append the canvas to the div
        div.appendChild(thumbnailCanvas);
        if(index == currentFrame)
            div.classList.add('frame-thumbnail-current');
        div.draggable = true;
        div.addEventListener('dragstart', dragFrameStart);
        div.addEventListener('dragover', dragFrameOver);
        div.addEventListener('dragend', dragFrameEnd);
        div.onclick = () => { 
            frameThumbnails.children.item(currentFrame).classList.remove('frame-thumbnail-current')
            currentFrame = index;
            frameThumbnails.children.item(currentFrame).classList.add('frame-thumbnail-current');
            drawFrame(); 
        };
        div.dataset.frameIndex = index;
        frameThumbnails.appendChild(div);
    });
}


function fixPointScale(event){
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return {x: x/toolContext.scale, y: y/ toolContext.scale}
}

function brush_mousedown(event) {
    saveState();
    originalBrushMousedown(event);
};

function originalBrushMousedown(event){ toolContext.painting = true; }
function brush_mouseup(event){ toolContext.painting = false; }
function brush_mousemove(event){ 
    if (!toolContext.painting) return;
    const {x, y} = fixPointScale(event);
    ledStrip.ledPath.forEach((point, index) => {
        if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
            animation[currentAnim].frames[currentFrame].leds[index] = [...toolContext.brushColor];
        }
    });
    drawFrame();
}

function brush_click(event){
    const {x, y} = fixPointScale(event);
    ledStrip.ledPath.forEach((point, index) => {
            if(x - point.x > 0 && x - point.x < 20 && y - point.y > 0 && y - point.y < 20){
                animation[currentAnim].frames[currentFrame].leds[index] = [...toolContext.brushColor];
            }
    });
    drawFrame();
}

function draw_mousedown(event){
}
function draw_mouseup(event){}
function draw_mousemove(event){}
function draw_click(event){
    const {x, y} = fixPointScale(event);
    ledStrip.push({x,y})
    drawFrame();
}

function select_mousedown(event){
    const {x, y} = fixPointScale(event);
    if(!event.ctrlKey)
    {
        const {point, index} = get_pressed_led({x,y});
        if(index != -1){
            if(toolContext.led_selected.findIndex(led => led.index === index) == -1)
                toolContext.led_selected = []
            if(toolContext.led_selected.length == 0)
                toolContext.led_selected.push({index, x: point.x, y: point.y, point});
            
            if (toolContext.led_selected.findIndex(led => led.index === index) != -1)
            {
                toolContext.move_start = {x,y};
                toolContext.moving = true;
                saveState();
                return;
            }
        }
    }
    toolContext.select_start = {x,y};
    toolContext.select_end = {x,y};
    toolContext.select_mode = "selecting";
}

function getLedsInSelectedBox(selectBox)
{
    let result = []
    ledStrip.ledPath.forEach((point, index) => { 
        const pointBox = {
            left: point.x+5,
            right: point.x + 15,
            top: point.y + 5,
            bottom: point.y + 15
        };
        // Check for intersection between the two boxes
        const intersects = !(
            pointBox.right < selectBox.left ||
            pointBox.left > selectBox.right ||
            pointBox.bottom < selectBox.top ||
            pointBox.top > selectBox.bottom
        );
        
        if(intersects){
            result.push({index, x: point.x, y: point.y, point});
        }
    });
    return result;
}

function select_mouseup(event){
    if(toolContext.moving == true){
        toolContext.moving = false;
        toolContext.led_selected.forEach((led, index) =>{
            led.x = led.point.x;
            led.y = led.point.y; 
        });
    }
    else if(toolContext.select_mode == "selecting"){
        let box = {
            left: Math.min(toolContext.select_start.x, toolContext.select_end.x),
            top: Math.min(toolContext.select_start.y, toolContext.select_end.y),
            right: Math.max(toolContext.select_start.x, toolContext.select_end.x),
            bottom: Math.max(toolContext.select_start.y, toolContext.select_end.y)
        }

        if(!event.ctrlKey)
            toolContext.led_selected = []
        getLedsInSelectedBox(box).forEach((led => {
            if(toolContext.led_selected.findIndex(l => l.index === led.index) == -1)
                toolContext.led_selected.push(led);
        }));
        toolContext.select_mode = "none"
    }
    drawFrame();
}

function select_mousemove(event) {
    const {x, y} = fixPointScale(event);
    if(toolContext.select_mode == "selecting")
    {
        toolContext.select_end = {x,y};
    }
    else if(toolContext.moving == true){
        diffX = x - toolContext.move_start.x;
        diffY = y - toolContext.move_start.y;
        
        toolContext.led_selected.forEach((led, index) =>{
            led.point.x = led.x + diffX;
            led.point.y = led.y + diffY; 
        });
    }
    drawFrame();
}

function get_pressed_led(point){
    let result = {point: undefined, index: -1};
    ledStrip.ledPath.forEach((led, index) => {
        if (point.x - led.x > 0 && point.x - led.x < 20 && point.y - led.y > 0 && point.y - led.y < 20) {
            result = {point: led, index};
        }
    });
    return result;
}

function select_click(event){
    const {x, y} = fixPointScale(event);
    const {point, index} = get_pressed_led({x,y})
    
    if(index != -1){
        if (event.ctrlKey) {
            const existingIndex = toolContext.led_selected.findIndex(l => l.index === index);
            if (existingIndex === -1) {
                toolContext.led_selected.push({index, x: point.x, y: point.y, point});
            } else {
                toolContext.led_selected.splice(existingIndex, 1);
            }
        }
        else
        {
            if(toolContext.led_selected.findIndex(l => l.index === index) == -1)
                toolContext.led_selected.push({index, x: point.x, y: point.y, point});
        }
    }
    drawFrame();
}

function addLedStrip() {
    saveState();
    if(ledStrip == undefined)
    {  
        ledStrip = new LedStrip(0, []);
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
    if (toolContext.led_selected.length === 0) return;
    
    // Sort selected LEDs by index in descending order to avoid index shifting issues
    const sortedSelected = [...toolContext.led_selected].sort((a, b) => b.index - a.index);
    // Remove LEDs from the path and colors array
    sortedSelected.forEach(led => {
        ledStrip.ledPath.splice(led.index, 1);
        updateFrames({index: led.index}, 'del');
        //animation[currentAnim].frames[currentFrame].leds.splice(led.index, 1);
    });
    
    // Reconnect remaining LEDs
    toolContext.led_selected = [];
    drawFrame();
}

function insertLedsClick(event) {
    if (toolContext.active_tool !== "insert" || toolContext.led_selected.length === 0) return;
    
    const {x, y} = fixPointScale(event);
    
    let {point, index} = get_pressed_led({x,y})
    // Check if click is on any LED
    
    if (index !== -1) {
        // Insert the selected LEDs at the target position
        insertLedsAtPosition(index);
        drawFrame();
    }
    toolContext.active_tool = "select";
    canvasLayout.style.cursor = "default";
}

function insertSelectedLeds() {
    toolContext.active_tool = "insert";
    canvasLayout.style.cursor = "pointer";
}

function insertLedsAtPosition(position) {
    if (toolContext.led_selected.length === 0) return;
    let positionLed = ledStrip.ledPath[position];
    // Create a copy of selected LEDs
    const selectedLeds = [...toolContext.led_selected];
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
    animation.forEach((anim,animIndex) => {
        anim.frames.forEach((frame, frameIndex)=> {
            colors = [];
            leds.forEach((led,index) => colors.push(frame.leds[led.index]));
            leds.forEach((led,index) => frame.remove(led.index, 1));
            leds.forEach((led,index) => frame.add(led.newIndex, 1));
            leds.forEach((led,index) => frame.setColor(led.newIndex, colors[index]));
        });
    });
    // Update selected LEDs with new indices
    toolContext.led_selected.forEach((led, i) => {
        const newIndex = ledStrip.ledPath.findIndex(p => p.x === led.x && p.y === led.y);
        led.index = newIndex;
        led.point = ledStrip.ledPath[newIndex];
    });
    
    drawFrame();
}

function duplicateSelectedLeds() {
    if (toolContext.led_selected.length === 0) return;
    
    // Create new LEDs with offset
    const newLeds = [];
    toolContext.led_selected.forEach(led => {
        newLeds.push({
            x: led.x,
            y: led.y,
        });
    });
    
    // Add new LEDs to the path
    ledStrip.ledPath.push(...newLeds);
    let position = ledStrip.ledCount;
    ledStrip.ledCount += newLeds.length;
    
    newLeds.forEach((led,index) => updateFrames({index: position+index}, 'add'));

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
    drawFrame();
}

tool_callbacks = {
        brush: {mousedown: brush_mousedown, mouseup: brush_mouseup, mousemove: brush_mousemove, click: brush_click },
        draw: {mousedown: draw_mousedown, mouseup: draw_mouseup, mousemove: draw_mousemove, click: draw_click},
        select: {mousedown: select_mousedown, mouseup: select_mouseup, mousemove: select_mousemove,  click: select_click },
        insert: {mousedown: insert_mousedown, mouseup: insert_mouseup, mousemove: insert_mousemove, click: insert_click }
    }



function insert_mousedown(event){}
function insert_mouseup(event){}
function insert_mousemove(event){}
function insert_click(event){
    insertLedsClick(event);
}

canvasLayout.addEventListener('mousedown', (event) => {
    tool_callbacks[toolContext.active_tool].mousedown(event)
 });

canvasLayout.addEventListener('mouseup', () => {
    tool_callbacks[toolContext.active_tool].mouseup(event)
});

canvasLayout.addEventListener('click', (event) => {
    tool_callbacks[toolContext.active_tool].click(event)
});

canvasLayout.addEventListener('mousemove', (event) => {
    tool_callbacks[toolContext.active_tool].mousemove(event)
});

canvasAnimation.addEventListener('mousedown', (event) => {
    tool_callbacks[toolContext.active_tool].mousedown(event)
 });

 canvasAnimation.addEventListener('mouseup', () => {
    tool_callbacks[toolContext.active_tool].mouseup(event)
});

canvasAnimation.addEventListener('click', (event) => {
    tool_callbacks[toolContext.active_tool].click(event)
});

canvasAnimation.addEventListener('mousemove', (event) => {
    tool_callbacks[toolContext.active_tool].mousemove(event)
});

function zoom(event){
    event.preventDefault();
        toolContext.scale += event.deltaY * -0.01;

        let scaleMin = Math.min(507/toolContext.canvasHeight, 607/toolContext.canvasWidth)
        // Restrict scale
        toolContext.scale = Math.min(Math.max(scaleMin, toolContext.scale), 1);

        // Apply scale transform
        canvasLayout.style.zoom = `${toolContext.scale}`;
        canvasAnimation.style.zoom = `${toolContext.scale}`;
}


canvasAnimation.addEventListener('wheel', (event) => {
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

function paint_tool(){ toolContext.active_tool = "brush"}

function select_tool(){ toolContext.active_tool = "select"}

function draw_tool(){ 
    toolContext.active_tool = "draw"
}

function paintSelected(){
    toolContext.led_selected.forEach((led, index) =>{
        animation[currentAnim].frames[currentFrame].leds[led.index] = [...toolContext.brushColor];
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
    center = {x:0,y:0};
    toolContext.led_selected.forEach((led,index) =>{
        center.x += led.x;
        center.y += led.y;
    });
    center.x = center.x/toolContext.led_selected.length;
    center.y = center.y/toolContext.led_selected.length;
    toolContext.led_selected.forEach((led, index) =>{
        rotate90Deg(center, led.point);
        rotate90Deg(center, led);
    });
    drawFrame();
}

function erase_tool(){
    toolContext.led_selected.forEach((led, index) =>{
        animation[currentAnim].frames[currentFrame].leds[led.index] = [0,0,0];
    });
    drawFrame();
}

function toggleSelectedLeds(){
    toolContext.led_selected.forEach((led, index) =>{
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
    animation[currentAnim].frames = [];
    currentFrame = -1;
    updateThumbnails();
    if(animation[currentAnim].frames.length == 0)
        drawEmptyFrame()
    ledStrip = new LedStrip(loadedObj.ledCount, loadedObj.ledPath);
    if(loadedObj.leds)
    {
        loadedObj.leds.forEach((led, index) => {
            if(led)
                ledStrip.disable(index);
            else
                ledStrip.enable(index);
        });
    }
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
    animation[currentAnim].groups.splice(toolContext.current_group, 1);
    toolContext.current_group -= 1;
    if(toolContext.current_group == -1 && animation[currentAnim].groups.length > 0)
        toolContext.current_group = 0;
    updateGroupList();
}

function addGroup(){
    group = {ledCount: toolContext.led_selected.length, ledList: [...toolContext.led_selected], selected: false};
    animation[currentAnim].groups.push(group);
    toolContext.current_group = animation[currentAnim].groups.length - 1;
    updateGroupList();
}

function selectGroup(index){
    let group = animation[currentAnim].groups[index];
    toolContext.current_group = index;
    toolContext.led_selected = [...group.ledList]
    toolContext.select_mode = "selected";
}

function removeGroup(index){
    animation[currentAnim].groups.splice(index, 1);
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
    const newGroups = newOrder.map(index => animation[currentAnim].groups[index]);
    animation[currentAnim].groups = newGroups;
    
    toolContext.current_group = newOrder.indexOf(toolContext.current_group);
    updateGroupList();
    drawFrame();
}

function updateGroupList() {
    if(currentAnim == -1) return;
    ledGroupList.innerHTML = '';
    animation[currentAnim].groups.forEach((group, index) => {
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
            ledGroupList.children.item(toolContext.current_group).classList.remove('selected-item')
            selectGroup(index);
            ledGroupList.children.item(toolContext.current_group).classList.add('selected-item')
            drawFrame();
        });
        li.draggable = true;
        li.addEventListener('dragstart', dragGroupStart);
        li.addEventListener('dragover', dragGroupOver);
        li.addEventListener('dragend', dragGroupEnd);
        li.dataset.groupIndex = index;
        document.getElementById(`Group${index}`).checked = animation[currentAnim].groups[index].selected;
        document.getElementById(`Group${index}`).addEventListener('click',()=>{
            animation[currentAnim].groups[index].selected = document.getElementById(`Group${index}`).checked;
        });
    });
}

function createAnimation(){
    let name = animNameInput.value;
    animation.push(new Animation())
    currentAnim = animation.length - 1;
    animation[currentAnim].name = name;
    updateAnimationList();
}

function deleteAnimation(){
    animation.splice(currentAnim, 1);
    currentAnim -= 1;
    if(currentAnim == -1 && animation.length > 0)
        currentAnim = 0;
    updateAnimationList()
}

function updateAnimationList() {
    animationList.innerHTML = '';
     
    animation.forEach((anim, index) => {
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.innerHTML = `<input id=animation${index} type="checkbox"/>
            <label id=animLabel${index}>${anim.name}</label>
            <input type="text" class="form-control hidden-input" id="animLabelEdit${index}">`;
        if(index == currentAnim)
        {
            li.classList.add('selected-item');
        }
        animationList.appendChild(li);
        li.addEventListener('click', (event) =>{
            if (event.target.type === "checkbox") {
                return;
            }
            animationList.children.item(currentAnim).classList.remove('selected-item');
            li.classList.add('selected-item');
            selectAnimation(index);
        });
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
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                input.blur();
            }
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
    updateThumbnails();
    updateGroupList();
    drawFrame();
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
    'fade': fadeColorScheme,
    'random': randomColorScheme
};

function createAnimationOnGroup() {
    const framesCount = parseInt(document.getElementById('framesCount').value);
    const colorSchemeName = document.getElementById('colorScheme').value;
    const colorScheme = colorSchemeMap[colorSchemeName];
    const startFrame = currentFrame;
    
    if (framesCount <= 0 || !colorScheme) return;
    
    // Ensure we have enough frames starting from current frame
    while (animation[currentAnim].frames.length < startFrame + framesCount) {
        animation[currentAnim].frames.push(new frame(ledStrip.ledCount));
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
    if (animation[currentAnim].frames.length === 0) return;
    playing = true;
    const interval = 1000 / 5;
    const saveCurrentFrame = currentFrame;
    currentFrame = 0;
    const playInterval = setInterval(() => {
        if (!playing || currentFrame >= animation[currentAnim].frames.length) {
            clearInterval(playInterval);
            playing = false;
            currentFrame = saveCurrentFrame;
            drawFrame();
            updateThumbnails();
            return;
        }
        drawFrame();
        updateThumbnails();
        currentFrame++;
    }, interval);
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
            if(!event.target.id){
                deleteSelectedLeds();
                event.stopPropagation();
            }
            break;
        case 'tab':
            if(currentAnim != -1){ 
                if (event.shiftKey) {
                    if(toolContext.current_group > 0)
                        selectGroup(toolContext.current_group - 1);
                } else {
                    if(toolContext.current_group < animation[currentAnim].groups.length - 1)
                        selectGroup(toolContext.current_group + 1);
                }
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
    console.log("data saved")
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
    drawFrame();
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
}


function toggleLayoutSidebar() {
    document.getElementById('layout-sidebar').classList.toggle('collapsed');
    document.getElementById('layout-close-sidebar').classList.toggle('collapsed');
}

function toggleAnimationSidebar() {
    document.getElementById('animation-sidebar').classList.toggle('collapsed');
    document.getElementById('animation-close-sidebar').classList.toggle('collapsed');
}



