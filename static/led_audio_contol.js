
const ledCanvasEffects = document.getElementById('ledCanvasEffects');

let audioToolContext = {
    audioCtrl: undefined,
    audioSpectrum: undefined
}

const audio = document.getElementById("audioElement");
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
audioToolContext.audioCtrl = new AudioLedController(ledCanvasEffects, ledStrip);

const specCanvas = document.getElementById("spectrum-canvas")
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
analyser.connect(audioContext.destination);



audioToolContext.audioSpectrum = new AudioSpectrum(specCanvas);
audioToolContext.audioCtrl.setAnalayzer(analyser);
audioToolContext.audioSpectrum.setAnalayzer(analyser);

// Connect the audio source to the analyzer
const source = audioContext.createMediaElementSource(audio);
source.connect(analyser);
const gain_node = audioContext.createGain();
gain_node.connect( analyser );
gain_node.gain.value = 1;


// Ensure the context is resumed after user interaction (required by browsers)
audioElement.addEventListener("play", () => {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    audioToolContext.audioCtrl.start();
    audioToolContext.audioSpectrum.start();
});

audio.addEventListener("pause", () => {audioToolContext.audioCtrl.stop(); audioToolContext.audioSpectrum.stop()});
audio.addEventListener("ended", () => {audioToolContext.audioCtrl.stop(); audioToolContext.audioSpectrum.stop()});



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

function start_mic(){
    if(micSource)
    {
        micSource.connect(gain_node)
        audioToolContext.audioCtrl.start();
        audioToolContext.audioSpectrum.start();
    }
    else{
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                      navigator.mozGetUserMedia || navigator.msGetUserMedia;
    
    if (navigator.getUserMedia){
    
    navigator.getUserMedia({audio:true}, 
      function(stream) {
        micSource = audioContext.createMediaStreamSource(stream);
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
        micSource.disconnect()
        audioToolContext.audioCtrl.stop();
        audioToolContext.audioSpectrum.stop();
    }
}