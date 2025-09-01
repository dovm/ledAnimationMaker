class BpF{
    constructor(lowFreq, hiFreq, sampleRate){
        this.lowFreq = lowFreq;
        this.highFreq = hiFreq;
        this.sampleRate = sampleRate;
    }

    getEnergy(fftIn){
        return 1;
    }
}

class Block{
    constructor(point, name){
        this.point = point;
        this.name = name;
        this.inConnections = [];
        this.outConnections = [];
        this.numOfInput = 0;
        this.numOfOutput = 0;
    }

    getPoint(){ return this.point;}
    getTitle(){return this.name;}

    connect(block){
        this.outConnections.push(block);
        block.inConnections.push(block);
    }

    disconnect(block){
        this.outConnections.splice(this.outConnections.indexOf(block),1);
        block.inConnections.splice(block.inConnections.indexOf(block),1);
    }
    
    
}

class SourceBlock extends Block{
    constructor(point, name){
        super(point, name);
        this.numOfOutput = 1;
    }

    getType(){ return "Source";}
    getDetails(){ return '';}
}

class SinkBlock extends Block{
    constructor(point, name){
        super(point, name);
        this.numOfInput = 1;
    }

    getType(){ return "Source";}
    getDetails(){ return '';}
}



class BlockAnimation extends Block{
    constructor(point, name, animation, rate){
        super(point, name);
        this.animation = animation;
        this.rate = rate;
        this.numOfInput = 1;
        this.numOfOutput = 1;
    }
    getType(){ return "Animation";}
    getDetails(){ return `rate ${this.rate}`;}
    getWidth(){return 100;}
    getHeight(){return 60;}
}

class BlockBeat extends Block{
    constructor(point, name, animation){
        super(point, name);
        this.animation = animation;
        this.numOfInput = 1;
        this.numOfOutput = 1;
    }
    getType(){ return "Beat";}
    getDetails(){return `Beat`;}
    getWidth(){return 100;}
    getHeight(){return 60;}
}

class BlockPulse extends Block{
    constructor(point, name, animation, bpf, range){
        super(point, name);
        this.animation = animation;
        this.bpf = bpf;
        this.range = range; 
        this.numOfInput = 1;
        this.numOfOutput = 1;
    }
    getType(){ return "Pulse";}
    getDetails(){return `range: ${this.bpf.lowFreq} - ${this.bpf.highFreq}`;}
    getWidth(){return 100;}
    getHeight(){return 60;}
}

const blockView = document.getElementById("block-view")
let blockList = [];
let currentBlock = -1;  

function drawFlowChart(){
    blockView.innerHTML = '';
    blockList.forEach((block, index) => {
        const b = document.createElement('div');
        b.id = `effect-block-${index}`;
        b.classList.add('effect-block');
        
        b.innerHTML = `<span class="effect-block-type-label">${block.getType()}</span>
        <span class="effect-block-label">${block.getTitle()}</span>
            <span class="effect-block-content">${block.getDetails()}</span>`;
        

        let base = (block.getHeight() - (block.numOfInput*18))/2;
        for (let i = 0; i < block.numOfInput; i++) {
            b.innerHTML += `<span data-block-index=${index} class="effect-block-input-label" onclick="onClickInput(event)" style="top: ${base+i*18}px;">${i}</span>`;
        }
        base = (block.getHeight() - (block.numOfOutput*18))/2;
        for (let i = 0; i < block.numOfOutput; i++) {
            b.innerHTML += `<span data-block-index=${index} class="effect-block-Outout-label" onclick="onClickOutput(event)" style="top: ${base+i*18}px; left: ${block.getWidth()}px">${i}</span>`;
        }
        b.style.top = block.getPoint().y +"px";
        b.style.left = block.getPoint().x +"px";
        b.style.width = block.getWidth() + "px";
        b.style.height = block.getHeight() + "px";
        
        if(index == currentBlock)
            b.classList.add('selected-effect-block');

        blockView.appendChild(b);

        b.addEventListener('click', (event) =>{
            if(currentBlock != -1)
                blockView.children.item(currentBlock).classList.remove('selected-effect-block');
            b.classList.add('selected-effect-block');
            selectBlock(index);
        });
        b.dataset.blockIndex = index;
    });
}

function updateFlowChart(index){
    const element = document.getElementById(`effect-block-${index}`);
    if(element){
        const block = blockList[index];
        element.style.top = block.getPoint().y +"px";
        element.style.left = block.getPoint().x +"px";
    }
}

function isLineIntersectingBlock(line, block){
    const lineSlope = (line.y2 - line.y1) / (line.x2 - line.x1);
    const lineConstant = line.y1 - lineSlope * line.x1;
    const blockX = block.getPoint().x;
    const blockY = block.getPoint().y;
    const blockWidth = block.getWidth();
    const blockHeight = block.getHeight();
    const blockRect = {x: blockX, y: blockY, width: blockWidth, height: blockHeight};
    const isIntersecting = lineSlope * blockRect.x + lineConstant > blockRect.y &&
                           lineSlope * blockRect.x + lineConstant < blockRect.y + blockRect.height &&
                           lineSlope * blockRect.x + lineConstant > blockRect.x &&
                           lineSlope * blockRect.x + lineConstant < blockRect.x + blockRect.width;
    return isIntersecting;
}  

function segmentCrossesBlock(x1, y1, x2, y2) {
    // For each block, check if the segment crosses its rectangle
    for (let block of blockList) {
        const bx = block.getPoint().x-18;
        const by = block.getPoint().y;
        const bw = block.getWidth()+36;
        const bh = block.getHeight();
        // Rectangle bounds
        const left = bx, right = bx + bw, top = by, bottom = by + bh;
        // If segment is vertical
        if (x1 === x2) {
            if (x1 > left && x1 < right) {
                // Check if y-range overlaps
                const segTop = Math.min(y1, y2), segBottom = Math.max(y1, y2);
                if (segBottom > top && segTop < bottom) return true;
            }
        }
        // If segment is horizontal
        if (y1 === y2) {
            if (y1 > top && y1 < bottom) {
                // Check if x-range overlaps
                const segLeft = Math.min(x1, x2), segRight = Math.max(x1, x2);
                if (segRight > left && segLeft < right) return true;
            }
        }
    }
    return false;
}

function createOrthogonalPath(block1, block2, blockList){
    //add extra lenth to the connation to make them with the same line as the block
    const origin = {
        x: block1.getPoint().x - 18,
        y: block1.getPoint().y + block1.getHeight() / 2
    };
    const destenation = {
        x: block2.getPoint().x + block1.getWidth()+18,
        y: block2.getPoint().y + block2.getHeight() / 2
    };
    // Start and end points
    const start = {
        x: origin.x-10,
        y: origin.y
    };
    const end = {
        x: destenation.x+10,
        y: destenation.y
    };

    let offset = 30; // px offset from block
    // Try offsetting horizontally from start, then vertically to align with end.y, then horizontally to end
    let midA = { x: start.x - offset, y: start.y };
    let midB = { x: start.x - offset, y: end.y };
    let valid3Seg1 =
        !segmentCrossesBlock(start.x, start.y, midA.x, midA.y) &&
        !segmentCrossesBlock(midA.x, midA.y, midB.x, midB.y) &&
        !segmentCrossesBlock(midB.x, midB.y, end.x, end.y);
    if (valid3Seg1) {
        return [origin, start, midA, midB, end, destenation];
    }
    // Try offsetting horizontally from end, then vertically, then horizontally to start
    let midC = { x: end.x + offset, y: start.y };
    let midD = { x: end.x + offset, y: end.y };
    let valid3Seg2 =
        !segmentCrossesBlock(start.x, start.y, midC.x, midC.y) &&
        !segmentCrossesBlock(midC.x, midC.y, midD.x, midD.y) &&
        !segmentCrossesBlock(midD.x, midD.y, end.x, end.y);
    if (valid3Seg2) {
        return [origin, start, midC, midD, end, destenation];
    }

    let path = [origin, start]; 
    // Try above all blocks
    let sortedY = [...blockList.map(b => b.getPoint().y)].sort((a,b) => a-b);
    let sortedX = [...blockList.map(b => b.getPoint().X)].sort((a,b) => a-b);
    if(sortedX[0] > 40) sortedX = [sortedX[0]-20, ...sortedX];
    if(sortedY[0] > 40) sortedY = [sortedY[0]-20, ...sortedY];
    if((blockView.clientWidth - sortedX[sortedX.length-1]) > 90) sortedX.push(sortedX[sortedX.length-1]+80);
    if((blockView.clientHeight - sortedY[sortedY.length-1]) > 90) sortedY.push(sortedY[sortedY.length-1]+80);


    let c = sortedY.map((b, index) => {
        return {y:b, space:((b-sortedY[index-1])>=80)};
    }).sort((a) => Math.abs(a - start.y))
    //let d = sortedY.map((b, index) => {
    //    return {y:b, space:((b-a[index-1])>=40)};
    //}).sort((a) => Math.abs(a - start.x));

    for (let index = 0; index < c.length; index++) {
        if(c[index].space){
         let aboveY = c[index].y - 20;
            let validAbove = !segmentCrossesBlock(start.x, start.y, start.x, aboveY) &&
                         !segmentCrossesBlock(start.x, aboveY, end.x, aboveY) &&
                         !segmentCrossesBlock(end.x, aboveY, end.x, end.y);
            if (validAbove) {
                path.push({x: start.x, y: aboveY}, {x: end.x, y: aboveY}, end);
                path.push(destenation);
                return path;
            }
        }
    }
    path.push(end);
    path.push(destenation);
    return path;
}

function draw_lines(){
    remove_lines();
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add('position-absolute'); 
    svg.classList.add('w-100');
    svg.classList.add('h-100');
    blockView.insertBefore(svg, blockView.firstChild);
    blockList.forEach((block, index) => {
        block.outConnections.forEach((connection) => {
            const polyline = document.createElementNS(svgNS, "polyline");
            const path = createOrthogonalPath(block, connection, blockList);
            polyline.setAttribute('points', path.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' '));
            polyline.setAttribute('stroke', 'black');
            polyline.setAttribute('stroke-width', 2);
            polyline.setAttribute('fill', 'none');
            svg.appendChild(polyline);
        });
    });
}

function remove_lines(){
    const lines = blockView.querySelectorAll('svg');
    lines.forEach(line => {
        line.remove();
    });
}

let InitialOffsetInBlock = undefined;
let movingBlock = undefined;
let selectedInput = undefined;
let selectedOutput = undefined;

function getBlockInXY(x,y){
    blockView.forEach((block) => {});
    if (point.x - led.x > 0 && point.x - led.x < 20 && point.y - led.y > 0 && point.y - led.y < 20) {
        result = {point: led, index};
    }
}

function connectBlocks(input, output){
    let inBlock = blockList[input.dataset.blockIndex];
    let outBlock = blockList[output.dataset.blockIndex];
    if(inBlock.outConnections.indexOf(outBlock) == -1)
        inBlock.connect(outBlock);
    else
        inBlock.disconnect(outBlock);
    draw_lines();
}

function onClickInput(event){
    if(selectedOutput){
        connectBlocks(event.target, selectedOutput);
        selectedOutput.classList.remove('selected-inout');
        selectedOutput = undefined;
    }
    else{
        if(selectedInput)
            selectedInput.classList.remove('selected-inout');
        event.target.classList.add('selected-inout');
        selectedInput = event.target;
    }
}

function onClickOutput(event){
    if(selectedInput){
        connectBlocks(selectedInput, event.target);
        selectedInput.classList.remove('selected-inout');
        selectedInput = undefined;
    }
    else{
        if(selectedOutput)
            selectedOutput.classList.remove('selected-inout');
        event.target.classList.add('selected-inout');
        selectedOutput = event.target;
    }
}

blockView.addEventListener("mousedown", (event) =>{
    let rect = event.target.getBoundingClientRect();
    let blockIndex = event.target.dataset.blockIndex;
    if(! blockIndex)
    {
        blockIndex = event.target.parentElement.dataset.blockIndex;
        rect = event.target.parentElement.getBoundingClientRect();
    }
    if (!blockIndex) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    movingBlock = blockList[blockIndex];
    InitialOffsetInBlock = new Point(x, y);
    
});

blockView.addEventListener("mousemove", (event) =>{
    if(movingBlock){
        const rect = blockView.getBoundingClientRect();
        const x = event.clientX - rect.left - InitialOffsetInBlock.x;
        const y = event.clientY - rect.top - InitialOffsetInBlock.y;
        movingBlock.point = new Point(x,y);
        updateFlowChart(blockList.indexOf(movingBlock));
        draw_lines();
    }
});

blockView.addEventListener("mouseup", (event) =>{
    movingBlock = undefined;
});


function addBlock(){
    const effect_type = document.getElementById('effect-type').selectedIndex;
    const animIndex = document.getElementById('effect-anim').selectedIndex;
    const HzRange = {min: parseInt(document.getElementById('effect-Hz-min-range').value),
        max: parseInt(document.getElementById('effect-Hz-max-range').value) };
    const range = { min: parseInt(document.getElementById('effect-min-range').value),
                        max: parseInt(document.getElementById('effect-max-range').value) };
    const name = document.getElementById('effect-name').value;
    const rate = document.getElementById('effect-animation-rate').value;
    let block = undefined;
    let lastPoint = blockList.length == 0 ? new Point(0,0) : blockList[blockList.length-1].getPoint();
    const nextPoint = new Point(lastPoint.x + 30, lastPoint.y + 30)
    if(effect_type == 0){
        block = new BlockPulse(nextPoint, name, animation[animIndex], new BpF(HzRange.min, HzRange.max), range);
    }
    else if(effect_type == 1)
        block = new BlockAnimation(nextPoint, name, animation[animIndex], rate);
    else if(effect_type == 2){
        let timeWindow = document.getElementById('effect-time-window').value;
        let endAnimationIndex = document.getElementById('effect-end-animation').selectedIndex;
        let animationRate = document.getElementById('effect-animation-rate').value;
        //effects.push({ effect: new EffectTriger(animation[animIndex], animation[endAnimationIndex], 
         //   {HzRange: HzRange, range: range, timeWindow, animationRate, endAnimationIndex}), selected: true});
    }
    else if(effect_type == 3){
        block = new BlockBeat(nextPoint, name, animation[animIndex]);
    }

    blockList.push(block);
    drawFlowChart();
}

function removeBlock(index){
    if(index == currentBlock)
        selectBlock(-1);
    blockList.splice(index, 1);
    drawFlowChart();
}

function selectBlock(index){
    currentBlock = index;
}