const effectAnim = document.getElementById('effect-anim');
const effectList = document.getElementById('effect-list');


let effects = [];
let currentEffect = -1;


const axisXheight = 15;
const axisYwidth = 20;

function resetEffectControls() {
    // Reset animation selection
    document.getElementById('effect-anim').value = "";
    
    // Reset range inputs
    document.getElementById('effect-min-range').value = "";
    document.getElementById('effect-max-range').value = "";
    
    // Reset frequency range inputs
    document.getElementById('effect-Hz-min-range').value = "";
    document.getElementById('effect-Hz-max-range').value = "";
    
}

function updateEffectTypeControls() {
    const effectType = document.getElementById('effect-type').value;
    const pulseControls = document.querySelectorAll('.pulse-control');
    const animControls = document.querySelectorAll('.anim-control');
    const triggerControls = document.querySelectorAll('.trigger-control');
    
    if (effectType === "Pulse") { // Pulse effect
        pulseControls.forEach(control => {control.classList.add("d-flex"); control.classList.remove("d-none");});
        animControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");});
        triggerControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");});
        
    } else if (effectType === "Animation") { // Animation effect
        pulseControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");}); 
        animControls.forEach(control => {control.classList.add("d-flex"); control.classList.remove("d-none");});
        triggerControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");});
    }
    else if (effectType === "Trigger") { // Trigger effect
        pulseControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");}); 
        animControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");});
        triggerControls.forEach(control => {control.classList.add("d-flex"); control.classList.remove("d-none");});
        let loadAnimList = document.getElementById('effect-end-animation');
        while (loadAnimList.options.length > 0) {                
            loadAnimList.remove(0);
        }  
        animation.forEach((anim, index) => loadAnimList.options[loadAnimList.options.length] = new Option(anim.name, index));
            
    }
}

// Add event listener for effect type changes
document.getElementById('effect-type').addEventListener('change', (e) => {
    updateEffectTypeControls();
});


const effectTypeIndex = {"EffectPulse": 0, "EffectAnim": 1, "EffectTriger": 2}

function updateEffectControl(index)
{
    if(index!= -1)
    {
        document.getElementById('effect-type').selectedIndex = effectTypeIndex[effects[0].effect.constructor.name]
        updateEffectTypeControls();
        let effect = effects[index].effect;
        if(effect instanceof EffectPulse)
        {
            document.getElementById('effect-type').selectedIndex = 0;
        }
        else if(effect instanceof EffectAnim)
        {
            document.getElementById('effect-type').selectedIndex = 1;
        }
        else if(effect instanceof EffectTriger)
        {
            document.getElementById('effect-type').selectedIndex = 2;
            document.getElementById('effect-time-window').value = effect.settings.timeWindow;
            document.getElementById('effect-end-animation').selectedIndex = effect.settings.endAnimationIndex;
            document.getElementById('effect-animation-rate').value = effect.settings.animationRate;
        }
        
        document.getElementById('effect-anim').selectedIndex = effect.animationIndex;
        document.getElementById('effect-Hz-min-range').value = effect.settings.HzRange.min; 
        document.getElementById('effect-Hz-max-range').value = effect.settings.HzRange.max;
        document.getElementById('effect-min-range').value = effect.settings.range.min; 
        document.getElementById('effect-max-range').value = effect.settings.range.max;
    }
    else{
        resetEffectControls();
    }
}

function addEffect(){
    let effect_type = document.getElementById('effect-type').selectedIndex;
    let animIndex = document.getElementById('effect-anim').selectedIndex;
    let HzRange = {min: parseInt(document.getElementById('effect-Hz-min-range').value),
        max: parseInt(document.getElementById('effect-Hz-max-range').value) };
    let range = { min: parseInt(document.getElementById('effect-min-range').value),
                        max: parseInt(document.getElementById('effect-max-range').value) };
    if(effect_type == 0)
        effects.push({ effect: new EffectPulse(animation[animIndex], {HzRange: HzRange, range: range}), selected: true});
    else if(effect_type == 1)
        effects.push({ effect: new EffectAnim(animation[animIndex], {HzRange: HzRange, range: range}), selected: true});
    else if(effect_type == 2){
        let timeWindow = document.getElementById('effect-time-window').value;
        let endAnimationIndex = document.getElementById('effect-end-animation').selectedIndex;
        let animationRate = document.getElementById('effect-animation-rate').value;
        effects.push({ effect: new EffectTriger(animation[animIndex], animation[endAnimationIndex], 
            {HzRange: HzRange, range: range, timeWindow, animationRate, endAnimationIndex}), selected: true});
    }
    updateEffectList();
    updateEffectControl(-1);
    updateBandsInSpectrum()
}

function updateBandsInSpectrum()
{
    audioToolContext.audioSpectrum.resetBands();
    effects.forEach((e) => {
        audioToolContext.audioSpectrum.addBand(e.effect.settings.HzRange.min, e.effect.settings.HzRange.max);
    });
}

function deleteEffect(){
    effects.splice(currentEffect, 1);
    updateEffectList();
    updateEffectControl(-1);
    updateBandsInSpectrum()
}

function updateEffectList(){
    effectList.innerHTML = '';
    
    effects.forEach((e, index) => {
        const div = document.createElement('div');
        div.addEventListener('click', (event) => {
            if(event.target.type === "checkbox")
            {
                return;
            }
            selectEffect(index);
        });
        div.classList.add('effect-item');
        div.innerHTML = `<input id=effect_checkbox${index} type="checkbox"/>
            <label class="list-item-label">${e.effect.animation.name}: ${e.effect.settings.HzRange.min}-${e.effect.settings.HzRange.max} Hz, `
        
        div.innerHTML += `level: ${e.effect.settings.range.min}-${e.effect.settings.range.max}</label>`;

        if(index == currentEffect)
        {
            div.classList.add('selected-item');
        }
        effectList.appendChild(div);
        document.getElementById(`effect_checkbox${index}`).checked = e.selected;
        document.getElementById(`effect_checkbox${index}`).addEventListener('click', () =>{
            e.selected = document.getElementById(`effect_checkbox${index}`).checked;
        });
    });
}

function selectEffect(index){
    currentEffect = index;
    updateEffectList();
    updateEffectControl(index);
}

function saveEffectsToFile() {
    // Create object to hold all data
    const saveData = {
        ledStrip: ledStrip,
        animations: animation.map(anim => ({
            name: anim.name,
            frames: anim.frames,
            groups: anim.groups,
            selected: false // Don't save selection state
        })),
        effects: effects.map(e => ({
            effect: {
                type: e.effect instanceof EffectPulse ? 'pulse' : e.effect instanceof EffectAnim ? 'animation' : 'trigger',
                settings: e.effect.settings,
                animationIndex: animation.indexOf(e.effect.animation)
            },
            selected: false // Don't save selection state
        }))
    };

    // Create and trigger download
    const blob = new Blob([JSON.stringify(saveData, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'led_effects.json';
    a.click();
}

function loadEffectsFromFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        
        loadLedsFromJson(data.ledStrip)
        // Load LED strip
        
        // Load animations
        animation = data.animations.map(anim => {
            const newAnim = new Animation();
            newAnim.name = anim.name;
            newAnim.frames = anim.frames;
            newAnim.groups = anim.groups;
            return newAnim;
        });

        // Load effects
        effects = data.effects.map(e => {
            const targetAnim = animation[e.effect.animationIndex];
            let effect;
            
            if (e.effect.type === 'pulse') {
                effect = new EffectPulse(targetAnim, e.effect.settings);
            } else if(e.effect.type === 'anim'){
                effect = new EffectAnim(targetAnim, e.effect.settings);
            } else if(e.effect.type === 'trigger'){
                effect = new EffectTriger(targetAnim, animation[e.effect.settings.endAnimationIndex] ,  e.effect.settings);
            }
            
            return {effect: effect, selected: false};
        });

        // Update UI
        updateAnimationList();
        updateEffectList();
        updateEffectControl(-1);
        updateBandsInSpectrum();
    };

    reader.readAsText(file);
}


function updateAudioFileName(event)
{
    let filename = document.getElementById("audioFile").files[0];
    document.getElementById("audio-file-name").textContent = filename.name;
    if (filename) {
        const audio = document.getElementById("audioElement");
        const objectURL = URL.createObjectURL(filename);
        audio.src = objectURL;
        audio.load();
    }
}

function updateEffect()
{
    audioToolContext.audioCtrl.resetEffects();
    effects.forEach((effect, index)=> {
        if(effect.selected)
            audioToolContext.audioCtrl.addEffect(effect.effect);
    });
    updateBandsInSpectrum()
}

function updateSpectrumRanges() {
    const minX = parseFloat(document.getElementById("spectrum-min-freq").value);
    const maxX = parseFloat(document.getElementById("spectrum-max-freq").value);
    const minY = parseFloat(document.getElementById("spectrum-min-level").value); 
    const maxY = parseFloat(document.getElementById("spectrum-max-level").value);

    audioToolContext.audioSpectrum.setXRange(minX, maxX);
    audioToolContext.audioSpectrum.setYRange(minY, maxY);

    drawSpectrumAxis();
}

function drawSpectrumAxis() {
    const ctx = specCanvas.getContext('2d');
    
    ctx.clearRect(0, 0, axisYwidth, specCanvas.height);
    ctx.clearRect(0, specCanvas.height-axisXheight, specCanvas.width, axisXheight);

    const axisYlength = specCanvas.height-axisXheight;
    // Y axis labels
    const yStep = (audioToolContext.audioSpectrum.maxY - audioToolContext.audioSpectrum.minY) / 5;
    for(let i = 0; i <= 5; i++) {
        const y = audioToolContext.audioSpectrum.minY + (yStep * i);
        const yPos = axisYlength - ((axisYlength) * (i/5)) - axisXheight;
        ctx.fillText(Math.round(y), 0, yPos, axisYwidth);
    }

    const axisXlength = specCanvas.width-axisYwidth;
    // X axis labels
    const xStep = (audioToolContext.audioSpectrum.maxX - audioToolContext.audioSpectrum.minX) / 5;
    for(let i = 0; i <= 5; i++) {
        const x = audioToolContext.audioSpectrum.minX + (xStep * i);
        const freq = (x * audioToolContext.audioSpectrum.sampleRate) / audioToolContext.audioSpectrum.analyser.fftSize;
        const xPos = (axisXlength) * (i/5) + axisYwidth;
        ctx.fillText(Math.round(freq) + "Hz", xPos, specCanvas.height-1);
    }

    // border
    p = new Path2D();
    ctx.beginPath();
    ctx.strokeStyle = `rgb(0, 0, 0)`;
    ctx.lineTo(axisYwidth-1, 0);
    ctx.lineTo(axisYwidth-1, axisYlength+1);
    ctx.lineTo(axisXlength + axisYwidth, axisYlength+1);
    ctx.stroke();

    
}

// Initial draw

const spectrumContainer = document.getElementById("spectrum-display-container");

function resizeCanvasToContainer() {
    const { width, height } = spectrumContainer.getBoundingClientRect();
    specCanvas.width = width-7;
    specCanvas.height = height-7;
    drawSpectrumAxis();
}


var effectsTab = document.getElementById("effects-tab")

effectsTab.addEventListener("shown.bs.tab", ()=>{
    resizeCanvasToContainer();
});

window.addEventListener('resize', resizeCanvasToContainer);

function changeSpectrumRanges(){
    let lastMaxX = audioToolContext.audioSpectrum.maxX;
    let lastMinX = audioToolContext.audioSpectrum.minX;
    let lastMaxY = audioToolContext.audioSpectrum.maxY;
    let lastMinY = audioToolContext.audioSpectrum.minY;
    specCanvasContext.zoomStack.push([lastMinX, lastMaxX, lastMinY, lastMaxY])
    let lastSpanX = lastMaxX - lastMinX;
    let lastSpanY = lastMaxY - lastMinY;
    const axisXStep = (specCanvas.width-axisYwidth)/lastSpanX;
    const minPosX = Math.min(specCanvasContext.selectBoxStartXY[0], specCanvasContext.selectBoxEndXY[0]);
    const maxPosX = Math.max(specCanvasContext.selectBoxStartXY[0], specCanvasContext.selectBoxEndXY[0]);
    let minX = Math.floor((minPosX-axisYwidth)/axisXStep + lastMinX);
    let maxX = Math.ceil((maxPosX-axisYwidth)/axisXStep + lastMinX);

    const axisYStep = (specCanvas.height-axisXheight)/lastSpanY;
    const minPosY = (specCanvas.height-axisXheight) - Math.max(specCanvasContext.selectBoxStartXY[1], specCanvasContext.selectBoxEndXY[1]);
    const maxPosY = (specCanvas.height-axisXheight) - Math.min(specCanvasContext.selectBoxStartXY[1], specCanvasContext.selectBoxEndXY[1]);
    let minY = Math.floor(minPosY/axisYStep + lastMinY);
    let maxY = Math.ceil(maxPosY/axisYStep + lastMinY);
    
    console.log("rangeX", minX, maxX)
    console.log("rangeY", minY, maxY)
    
    audioToolContext.audioSpectrum.setXRange(minX, maxX);
    audioToolContext.audioSpectrum.setYRange(minY, maxY);

    drawSpectrumAxis();
}

function revertZoom(){
    a = []
    let lastZoom = specCanvasContext.zoomStack.pop()
    if(!lastZoom)
        lastZoom = [0,1024,0,255]
    audioToolContext.audioSpectrum.setXRange(lastZoom[0], lastZoom[1]);
    audioToolContext.audioSpectrum.setYRange(lastZoom[2], lastZoom[3]);
    drawSpectrumAxis();
}

specCanvasContext = {
    selectBoxStartXY: [0,0],
    selectBoxEndXY: [0,0],
    isSelect: false,
    zoomStack: []
}

function drawSelectionBox(){
    const selBox = document.getElementById("spectrum-sel-box");
    selBox.style.top = Math.min(specCanvasContext.selectBoxStartXY[1],specCanvasContext.selectBoxEndXY[1]) +"px";
    selBox.style.left = Math.min(specCanvasContext.selectBoxStartXY[0],specCanvasContext.selectBoxEndXY[0]) +"px";
    
    selBox.style.width = Math.abs(specCanvasContext.selectBoxEndXY[0] - specCanvasContext.selectBoxStartXY[0]) + "px";
    selBox.style.height = Math.abs(specCanvasContext.selectBoxEndXY[1] - specCanvasContext.selectBoxStartXY[1]) + "px";
}

specCanvas.addEventListener('mousedown', (event) => {
    if(event.button !=2){
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        specCanvasContext.isSelect = true;
        specCanvasContext.selectBoxStartXY = [x, y];
        specCanvasContext.selectBoxEndXY = [x, y];    
        drawSelectionBox(); 
    }
    else
        revertZoom()
});

specCanvas.addEventListener('mousemove', (event) => {
    if(specCanvasContext.isSelect){
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        specCanvasContext.selectBoxEndXY = [x, y];
        drawSelectionBox();
    }
});

specCanvas.addEventListener('mouseup', (event) => {
    if(event.button !=2){
    specCanvasContext.isSelect = false;
    changeSpectrumRanges();
    specCanvasContext.selectBoxStartXY = [0,0];
    specCanvasContext.selectBoxEndXY = [0,0];
    drawSelectionBox();
    }
});

specCanvas.addEventListener('contextmenu', (event) => { //right click
    event.preventDefault()
    //revertZoom()  
});

