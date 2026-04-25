
const ledCanvasEffects = document.getElementById('ledCanvasEffects');

let audioToolContext = {
    audioCtrl: undefined,
    audioSpectrum: undefined
}

// NOTE: the audio nodes below are declared with `var` (not `const`) so that if
// any single setup step throws, the rest of this script can still execute and
// later code (start_mic / stop_mic / play handlers) sees them as `undefined`
// instead of hitting a temporal-dead-zone ReferenceError. Each setup step is
// also wrapped in its own try/catch so one bad call (e.g. an AudioContext that
// can't be created before user interaction, or createMediaElementSource being
// called twice on the same audio element) doesn't abort the whole bootstrap.

var audio = document.getElementById("audioElement");
var specCanvas = document.getElementById("spectrum-canvas");
var audioContext = null;
var analyser = null;
var source = null;
var gain_node = null;

try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    console.error('AudioContext init failed:', e);
}

try {
    audioToolContext.audioCtrl = new AudioLedController(ledCanvasEffects, ledStrip);
} catch (e) {
    console.error('AudioLedController init failed:', e);
}

if (audioContext) {
    try {
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.connect(audioContext.destination);
    } catch (e) {
        console.error('Analyser init failed:', e);
    }
}

if (specCanvas) {
    try {
        audioToolContext.audioSpectrum = new AudioSpectrum(specCanvas);
        if (analyser) audioToolContext.audioSpectrum.setAnalayzer(analyser);
    } catch (e) {
        console.error('AudioSpectrum init failed:', e);
    }
}

if (audioToolContext.audioCtrl && analyser) {
    try { audioToolContext.audioCtrl.setAnalayzer(analyser); } catch (e) { console.error(e); }
}

if (audioContext && audio) {
    try {
        source = audioContext.createMediaElementSource(audio);
        if (analyser) source.connect(analyser);
    } catch (e) {
        console.error('createMediaElementSource failed:', e);
    }
}

if (audioContext) {
    try {
        gain_node = audioContext.createGain();
        if (analyser) gain_node.connect(analyser);
        gain_node.gain.value = 1;
    } catch (e) {
        console.error('GainNode init failed:', e);
    }
}

// Ensure the context is resumed after user interaction (required by browsers)
if (audio) {
    audio.addEventListener("play", () => {
        if (audioContext && audioContext.state === "suspended") {
            audioContext.resume();
        }
        try { audioToolContext.audioCtrl && audioToolContext.audioCtrl.start(); } catch (e) { console.error(e); }
        try { audioToolContext.audioSpectrum && audioToolContext.audioSpectrum.start(); } catch (e) { console.error(e); }
    });

    audio.addEventListener("pause", () => {
        try { audioToolContext.audioCtrl && audioToolContext.audioCtrl.stop(); } catch (e) { console.error(e); }
        try { audioToolContext.audioSpectrum && audioToolContext.audioSpectrum.stop(); } catch (e) { console.error(e); }
    });
    audio.addEventListener("ended", () => {
        try { audioToolContext.audioCtrl && audioToolContext.audioCtrl.stop(); } catch (e) { console.error(e); }
        try { audioToolContext.audioSpectrum && audioToolContext.audioSpectrum.stop(); } catch (e) { console.error(e); }
    });
}



function changeAudioControlsVisibilty(){
    const micControls = document.querySelectorAll('.mic-controls');
    const audioFileControls = document.querySelectorAll('.audio-file-controls');
    if(document.getElementById("microphone-input").checked == true)
    {
        micControls.forEach(control => {control.classList.add("d-flex"); control.classList.remove("d-none");});
        audioFileControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");});
        audio.pause()
    }
    else
    {
        audioFileControls.forEach(control => {control.classList.add("d-flex"); control.classList.remove("d-none");});
        micControls.forEach(control => {control.classList.add("d-none"); control.classList.remove("d-flex");});
        stop_mic();
    }
}
var micSource = null;

// Lazily build any audio-pipeline pieces that didn't come up at script-load
// time (e.g. AudioContext requires a user gesture in some browsers, so the
// initial top-level `new AudioContext()` may have failed). Returns true if
// `gain_node` and `analyser` are usable after this call.
function ensureAudioPipeline() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    } catch (e) {
        console.error('AudioContext init failed:', e);
        return false;
    }
    if (!analyser) {
        try {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.connect(audioContext.destination);
        } catch (e) { console.error('Analyser init failed:', e); }
    }
    if (specCanvas && !audioToolContext.audioSpectrum) {
        try {
            audioToolContext.audioSpectrum = new AudioSpectrum(specCanvas);
            if (analyser) audioToolContext.audioSpectrum.setAnalayzer(analyser);
        } catch (e) { console.error(e); }
    }
    if (audioToolContext.audioCtrl && analyser && !audioToolContext.audioCtrl.analyser) {
        try { audioToolContext.audioCtrl.setAnalayzer(analyser); } catch (e) { console.error(e); }
    }
    if (!source && audioContext && audio) {
        try {
            source = audioContext.createMediaElementSource(audio);
            if (analyser) source.connect(analyser);
        } catch (e) {
            // createMediaElementSource throws if it has already been called for
            // this element. That's fine; the existing source is still wired up.
        }
    }
    if (!gain_node && audioContext) {
        try {
            gain_node = audioContext.createGain();
            if (analyser) gain_node.connect(analyser);
            gain_node.gain.value = 1;
        } catch (e) { console.error('GainNode init failed:', e); }
    }
    return !!(gain_node && analyser);
}

function start_mic(){
    if (!ensureAudioPipeline()) {
        alert('Audio pipeline is not ready.');
        return;
    }
    if(micSource)
    {
        try { micSource.connect(gain_node); } catch (e) { console.error(e); }
        try { audioToolContext.audioCtrl && audioToolContext.audioCtrl.start(); } catch (e) { console.error(e); }
        try { audioToolContext.audioSpectrum && audioToolContext.audioSpectrum.start(); } catch (e) { console.error(e); }
    }
    else{
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                      navigator.mozGetUserMedia || navigator.msGetUserMedia;
    
    if (navigator.getUserMedia){
    
    navigator.getUserMedia({audio:true}, 
      function(stream) {
        try { micSource = audioContext.createMediaStreamSource(stream); } catch (e) { console.error(e); return; }
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
        start_mic()
      },
      function(e) {
        alert('Error capturing audio.');
      }
    );
    
    } else { alert('getUserMedia not supported in this browser.'); }
    }
}

function stop_mic(){
    if(micSource){
        try { micSource.disconnect(); } catch (e) { console.error(e); }
        try { audioToolContext.audioCtrl && audioToolContext.audioCtrl.stop(); } catch (e) { console.error(e); }
        try { audioToolContext.audioSpectrum && audioToolContext.audioSpectrum.stop(); } catch (e) { console.error(e); }
    }
}

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
        animationCtx.getAnimations().forEach((anim, index) => loadAnimList.options[loadAnimList.options.length] = new Option(anim.name, index));
            
    }
}

// Add event listener for effect type changes
document.getElementById('effect-type').addEventListener('change', (e) => {
    updateEffectTypeControls();
});


const effectTypeIndex = {"EffectPulse": 0, "EffectAnim": 1, "EffectTriger": 2}
const effectTypeName = {"EffectPulse": "Pulse", "EffectAnim": "Animation", "EffectTriger": "Trigger"}

function updateEffectControl(index)
{
    if(index!= -1)
    {
        document.getElementById('effect-type').selectedIndex = effectTypeIndex[effects[index].effect.constructor.name]
        updateEffectTypeControls();
        let effect = effects[index].effect;
        if(effect instanceof EffectTriger)
        {
            document.getElementById('effect-time-window').value = effect.settings.timeWindow;
            document.getElementById('effect-end-animation').selectedIndex = effect.settings.endAnimationIndex;
            document.getElementById('effect-animation-rate').value = effect.settings.animationRate;
        }
        
        document.getElementById('effect-anim').selectedIndex = animationCtx.getAnimations().indexOf(effect.animation);
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
        effects.push({ effect: new EffectPulse(animationCtx.getAnimation(animIndex), {HzRange: HzRange, range: range}), selected: true});
    else if(effect_type == 1)
        effects.push({ effect: new EffectAnim(animationCtx.getAnimation(animIndex), {HzRange: HzRange, range: range}), selected: true});
    else if(effect_type == 2){
        let timeWindow = document.getElementById('effect-time-window').value;
        let endAnimationIndex = document.getElementById('effect-end-animation').selectedIndex;
        let animationRate = document.getElementById('effect-animation-rate').value;
        effects.push({ effect: new EffectTriger(animationCtx.getAnimation(animIndex), animationCtx.getAnimation(endAnimationIndex), 
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
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.classList.add('d-flex');
        li.classList.add('ps-2');

        li.innerHTML = `<input id=effect_checkbox${index} type="checkbox"/>
        <div class="w-100 ms-1 d-flex flex-column">
            <label class="list-item-label">${effectTypeName[effects[index].effect.constructor.name]}: ${e.effect.animation.name}</label>
            <label class="list-item-content">Band: ${e.effect.settings.HzRange.min}-${e.effect.settings.HzRange.max} Hz</label>
            <label class="list-item-content">Level: ${e.effect.settings.range.min}-${e.effect.settings.range.max}</label>
        </div>`;
        li.addEventListener('click', (event) => {
            if(event.target.type === "checkbox")
            {
                return;
            }
            selectEffect(index);
        });
        //div.classList.add('effect-item');
        if(index == currentEffect)
        {
            li.classList.add('selected-item');
        }
        effectList.appendChild(li);
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
        animations: animationCtx.getAnimations().map(anim => ({
            name: anim.name,
            frames: anim.frames,
            groups: anim.groups,
            selected: false // Don't save selection state
        })),
        effects: effects.map(e => ({
            effect: {
                type: e.effect instanceof EffectPulse ? 'pulse' : e.effect instanceof EffectAnim ? 'animation' : 'trigger',
                settings: e.effect.settings,
                animationIndex: animationCtx.getAnimations().indexOf(e.effect.animation)
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

