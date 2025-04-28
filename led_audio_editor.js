
const canvas = document.getElementById('ledCanvas');
const animNameInput = document.getElementById('animName'); 
const frameThumbnails = document.getElementById('frame-thumbnails');
const animationList = document.getElementById('animation-list');
const effectAnim = document.getElementById('effect-anim');
const effectList = document.getElementById('effect-list');

let animation = [];
let currentAnim = 0;
let currentFrame = -1;
let ledStrip = new LedStrip(0, []);
let toolContext = {
    audioCtrl: undefined,
    audioSpectrum: undefined
}

const audio = document.getElementById("audioElement");
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
toolContext.audioCtrl = new AudioLedController(canvas, ledStrip);
const specCanvas = document.getElementById("spectrum-canvas")
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;

// Connect the audio source to the analyzer
const source = audioContext.createMediaElementSource(audio);
source.connect(analyser);

analyser.connect(audioContext.destination);
toolContext.audioSpectrum = new AudioSpectrum(specCanvas);
toolContext.audioCtrl.setAnalayzer(analyser);
toolContext.audioSpectrum.setAnalayzer(analyser);

// Ensure the context is resumed after user interaction (required by browsers)
audioElement.addEventListener("play", () => {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    toolContext.audioCtrl.start();
    toolContext.audioSpectrum.start();
});

audio.addEventListener("pause", () => {toolContext.audioCtrl.stop(); toolContext.audioSpectrum.stop()});
audio.addEventListener("ended", () => {toolContext.audioCtrl.stop(); toolContext.audioSpectrum.stop()});


function loadAnimation(){

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
        ctx.strokeStyle = `rgb(157, 157, 157)`;
        ledStrip.ledPath.forEach((point, index) => {
            ctx.lineTo(point.x + 10, point.y + 10);
        });
        ctx.stroke();
        frame.leds.forEach((color, index) => {
            p = new Path2D();
            if(ledStrip.isDisabled(index)){
                ctx.fillStyle = `rgb(185, 185, 185)`;
            }
            else{
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            }
            p.roundRect(ledStrip.ledPath[index].x, ledStrip.ledPath[index].y, 20, 20, 20);
            ctx.fill(p);
        });
    }
  
}

function updateThumbnails() {
    frameThumbnails.innerHTML = '';
    animation[currentAnim].frames.forEach((_, index) => {
        const div = document.createElement('div');
        div.classList.add('frame-thumbnail');
        if(index == currentFrame)
            div.classList.add('frame-thumbnail-current');
        div.innerText = index + 1;
        div.onclick = () => { currentFrame = index; updateThumbnails(); drawFrame(animation[currentAnim].frames[currentFrame]); };
        frameThumbnails.appendChild(div);

    });
}

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
    toolContext.audioCtrl.setLedStrip(ledStrip);
    updateLayoutFileName();
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


function updateAnimationList() {
    animationList.innerHTML = '';
    
    while (effectAnim.options.length > 0) {                
        effectAnim.remove(0);
    }  
    animation.forEach((anim, index) => {
        const div = document.createElement('div');
        div.classList.add('animation-item');
        div.innerHTML = `<input id=animation_checkbox${index} type="checkbox"/>
            <label class="list-item-label">${anim.name}</label>`;
        if(index == currentAnim)
        {
            div.classList.add('selected-item');
        }
        animationList.appendChild(div);
        div.addEventListener('click', (event) => {
            console.log(event.target.type)
            if (event.target.type === "checkbox") {
                return;
            }
            selectAnimation(index);
        });
        document.getElementById(`animation_checkbox${index}`).checked = animation[index].selected;
        document.getElementById(`animation_checkbox${index}`).addEventListener('click',()=>{
            animation[index].selected = document.getElementById(`animation_checkbox${index}`).checked;
        });
        effectAnim.options[effectAnim.options.length] = new Option(anim.name, index);
    });

}

function selectAnimation(index){
    currentAnim = index;
    currentFrame = 0;
    updateAnimationList();
    updateThumbnails();
    drawFrame(animation[currentAnim].frames[currentFrame]);
}

function loadAnimationFromFile(event){
    const file = event.target.files[0];
    loadObjectFromJson(file, (loadedObj) => {
        animation.push(new Animation().fromJson(loadedObj));
        selectAnimation(animation.length - 1);
    });
}

function deleteAnimation(index){
    animation.splice(index, 1);
    if(currentAnim >= index)
        currentAnim -= 1;
    updateAnimationList()
}

let effects = [];
let currentEffect = -1;


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
    
    if (effectType === "Pulse") { // Pulse effect
        pulseControls.forEach(control => control.style.display = "block");
        animControls.forEach(control => control.style.display = "none");
    } else if (effectType === "Animation") { // Animation effect
        pulseControls.forEach(control => control.style.display = "none"); 
        animControls.forEach(control => control.style.display = "block");
    }
}

// Add event listener for effect type changes
document.getElementById('effect-type').addEventListener('change', (e) => {
    //updateEffectTypeControls();
});



function updateEffectControl(index)
{
    
    if(index!= -1)
    {
        let effect = effects[index].effect;
        //updateEffectTypeControls()
        if(effect instanceof EffectPulse)
        {
            document.getElementById('effect-type').selectedIndex = 0;
            //updateEffectTypeControls();
            document.getElementById('effect-min-range').value = effect.settings.range.min;
            document.getElementById('effect-max-range').value = effect.settings.range.max;
        }
        else if(effect instanceof EffectAnim)
        {
            document.getElementById('effect-type').selectedIndex = 1;
            //updateEffectTypeControls();
            document.getElementById('effect-min-range').value = effect.settings.range.min;
            document.getElementById('effect-max-range').value = effect.settings.range.max;
        }
        document.getElementById('effect-anim').selectedIndex = animation.indexOf(effect.animation);
        document.getElementById('effect-Hz-min-range').value = effect.settings.HzRange.min; 
        document.getElementById('effect-Hz-max-range').value = effect.settings.HzRange.max;
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
    updateEffectList();
    updateEffectControl(-1);
    updateBandsInSpectrum()
}

function updateBandsInSpectrum()
{
    toolContext.audioSpectrum.resetBands();
    effects.forEach((e) => {
        toolContext.audioSpectrum.addBand(e.effect.settings.HzRange.min, e.effect.settings.HzRange.max);
    });
}

function deleteEffect(){
    effects.splice(currentEffect, 1);
    updateEffectList();
    updateEffectControl(-1);
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
                type: e.effect instanceof EffectPulse ? 'pulse' : 'animation',
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
        
        // Load LED strip
        ledStrip = new LedStrip(data.ledStrip.ledCount, data.ledStrip.ledPath);
        
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
            } else {
                effect = new EffectAnim(targetAnim, e.effect.settings);
            }
            
            return {effect: effect, selected: false};
        });

        // Update UI
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
    toolContext.audioCtrl.resetEffects();
    effects.forEach((effect, index)=> {
        if(effect.selected)
            toolContext.audioCtrl.addEffect(effect.effect);
    });
}

function updateLayoutFileName(event)
{
    let filename = document.getElementById("layout-file").files[0];
    document.getElementById("layout-file-name").textContent = filename.name;
}

function updateSpectrumRanges() {
    const minX = parseFloat(document.getElementById("spectrum-min-freq").value);
    const maxX = parseFloat(document.getElementById("spectrum-max-freq").value);
    const minY = parseFloat(document.getElementById("spectrum-min-level").value); 
    const maxY = parseFloat(document.getElementById("spectrum-max-level").value);

    toolContext.audioSpectrum.setXRange(minX, maxX);
    toolContext.audioSpectrum.setYRange(minY, maxY);

    drawSpectrumAxis();
}
function drawSpectrumAxis() {
    // Draw Y axis
    const axisYCanvas = document.getElementById("spectrum-axis-y");
    const ctxY = axisYCanvas.getContext("2d");
    ctxY.clearRect(0, 0, axisYCanvas.width, axisYCanvas.height);
    
    // Y axis labels
    const yStep = (toolContext.audioSpectrum.maxY - toolContext.audioSpectrum.minY) / 5;
    for(let i = 0; i <= 5; i++) {
        const y = toolContext.audioSpectrum.minY + (yStep * i);
        const yPos = axisYCanvas.height - ((axisYCanvas.height) * (i/5));
        ctxY.fillText(Math.round(y), 0, yPos);
    }

    // Draw X axis
    const axisXCanvas = document.getElementById("spectrum-axis-x"); 
    const ctxX = axisXCanvas.getContext("2d");
    ctxX.clearRect(0, 0, axisXCanvas.width, axisXCanvas.height);

    // X axis labels
    const xStep = (toolContext.audioSpectrum.maxX - toolContext.audioSpectrum.minX) / 5;
    for(let i = 0; i <= 5; i++) {
        const x = toolContext.audioSpectrum.minX + (xStep * i);
        const freq = (x * toolContext.audioSpectrum.sampleRate) / toolContext.audioSpectrum.analyser.fftSize;
        const xPos = (axisXCanvas.width) * (i/5);
        ctxX.fillText(Math.round(freq) + "Hz", xPos, axisXCanvas.height);
    }
}

// Initial draw
drawSpectrumAxis();

// Add event listeners to range inputs
document.getElementById('spectrum-min-freq').addEventListener('input', function() {
    document.getElementById('min-freq-value').textContent = this.value;
    updateSpectrumRanges();
});

document.getElementById('spectrum-max-freq').addEventListener('input', function() {
    document.getElementById('max-freq-value').textContent = this.value;
    updateSpectrumRanges();
});

document.getElementById('spectrum-min-level').addEventListener('input', function() {
    document.getElementById('min-level-value').textContent = this.value;
    updateSpectrumRanges();
});

document.getElementById('spectrum-max-level').addEventListener('input', function() {
    document.getElementById('max-level-value').textContent = this.value;
    updateSpectrumRanges();
});


