// Project-aware Effects-tab integration.
//
// Effects are pure: each effect's compute(audioData) returns either
//   { animation: <ProjectAnimation>, frameIndex: <int> }
// describing which animation frame should be displayed for this audio sample,
// or null when the effect contributes nothing this tick.
//
// ProjectAudioLedController is the only place that knows how to render. For
// every active effect it walks the chosen animation's groups, looks up the
// group color in the chosen frame, and adds it to all member LEDs across all
// strips in the project. Multiple effects compose additively (clamped at 255).
//
// Because animations are defined over the entire project (groups can contain
// LEDs from any strip), each effect naturally drives all strips that its
// animation references. There is no per-strip targeting on effects.

class ProjectAudioLedController {
  constructor(canvas, project, store) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.project = project
    this.store = store
    this.effects = []
    this.audioEnd = false
    this.analyser = null

    // Flat frame buffer. One [r,g,b] per global LED index (project order).
    this.frame = []
    // Strip layout map: { strip, stripId, count, offset }, in chain order.
    this.stripIndex = []
    // Quick lookup: stripId -> { count, offset }.
    this._stripOffsetById = new Map()

    this.viewport = (typeof Viewport === 'function') ? new Viewport() : null
    this.panning = false
    this.panLastScreen = { x: 0, y: 0 }
    this.spaceDown = false

    this._rebuildStripIndex()

    project.on('strip-added', () => this._rebuildStripIndex())
    project.on('strip-removed', () => this._rebuildStripIndex())
    project.on('strip-changed', () => this._rebuildStripIndex())
    project.on('wire-added', () => this._rebuildStripIndex())
    project.on('wire-removed', () => this._rebuildStripIndex())

    this._draw = this._draw.bind(this)
    this._bindInput()
    this.resize()
    addEventListener('resize', () => this.resize())
    requestAnimationFrame(this._draw)
  }

  // ---- Layout / frame buffer ------------------------------------------------

  _rebuildStripIndex() {
    this.stripIndex = []
    this._stripOffsetById = new Map()
    let offset = 0
    const seen = new Set()
    for (const chain of this.project.getChains()) {
      for (const s of chain) {
        seen.add(s)
        const count = s.points.length
        const entry = { strip: s, stripId: s.id, count, offset }
        this.stripIndex.push(entry)
        this._stripOffsetById.set(s.id, entry)
        offset += count
      }
    }
    for (const s of this.project.strips) {
      if (seen.has(s)) continue
      const count = s.points.length
      const entry = { strip: s, stripId: s.id, count, offset }
      this.stripIndex.push(entry)
      this._stripOffsetById.set(s.id, entry)
      offset += count
    }
    this.totalLeds = offset
    this.frame = new Array(offset)
    for (let i = 0; i < offset; i++) this.frame[i] = [0, 0, 0]
  }

  // ---- Legacy AudioLedController-compatible API ----------------------------

  setLedStrip() {
    // No-op; kept so legacy code paths that call setLedStrip(...) don't crash.
  }

  setAnalayzer(analyser) {
    this.analyser = analyser
  }

  addEffect(effect) {
    this.effects.push(effect)
  }

  resetEffects() {
    this.effects = []
  }

  stop() {
    this.audioEnd = true
  }

  start() {
    // The legacy bootstrap may finish wiring up the analyser only after the
    // first user gesture (start_mic / audio play). Pull it from the legacy
    // controller lazily so we don't get stuck with a null analyser forever.
    if (!this.analyser && typeof audioToolContext !== 'undefined' && audioToolContext.audioCtrl) {
      this.analyser = audioToolContext.audioCtrl.analyser || null
    }
    if (!this.analyser && typeof analyser !== 'undefined') {
      this.analyser = analyser
    }
    if (!this.analyser) return
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.audioEnd = false
    const render = () => {
      if (!this.audioEnd) requestAnimationFrame(render)
      this.analyser.getByteFrequencyData(dataArray)
      this.applyEffects(dataArray)
    }
    render()
  }

  applyEffects(audioData) {
    // Reset the project frame buffer.
    for (let i = 0; i < this.frame.length; i++) this.frame[i] = [0, 0, 0]
    if (this.effects.length === 0) return
    for (const effect of this.effects) {
      let out
      try {
        out = (typeof effect.compute === 'function') ? effect.compute(audioData) : null
      } catch (err) {
        console.error('Effect compute failed:', err)
        continue
      }
      if (!out) continue
      const { animation, frameIndex } = out
      if (!animation || !Array.isArray(animation.frames)) continue
      if (frameIndex < 0 || frameIndex >= animation.frames.length) continue
      const animFrame = animation.frames[frameIndex]
      if (!animFrame) continue
      // Paint each group's color onto its member LEDs (additive, clamped).
      for (const g of animation.groups) {
        const c = animFrame.getGroupColor ? animFrame.getGroupColor(g.id) : null
        if (!c) continue
        for (const m of g.members) {
          const entry = this._stripOffsetById.get(m.stripId)
          if (!entry) continue
          if (m.ledIndex < 0 || m.ledIndex >= entry.count) continue
          const gi = entry.offset + m.ledIndex
          const cur = this.frame[gi]
          this.frame[gi] = [
            Math.min(cur[0] + c[0], 255),
            Math.min(cur[1] + c[1], 255),
            Math.min(cur[2] + c[2], 255),
          ]
        }
      }
    }
  }

  // ---- Rendering ------------------------------------------------------------

  resize() {
    const parent = this.canvas.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w > 0 && h > 0) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  _isInputTarget(el) {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  _shouldPan(e) {
    return e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)
  }

  _pointerScreen(e) {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  _bindInput() {
    if (!this.viewport) return
    this.canvas.onmousedown = (e) => {
      if (this._shouldPan(e)) {
        e.preventDefault()
        this.panning = true
        this.panLastScreen = this._pointerScreen(e)
        this.canvas.style.cursor = 'grabbing'
      }
    }
    this.canvas.onmousemove = (e) => {
      if (!this.panning) return
      const cur = this._pointerScreen(e)
      this.viewport.panBy(cur.x - this.panLastScreen.x, cur.y - this.panLastScreen.y)
      this.panLastScreen = cur
    }
    this.canvas.onmouseup = () => {
      if (this.panning) {
        this.panning = false
        this.canvas.style.cursor = this.spaceDown ? 'grab' : 'default'
      }
    }
    this.canvas.onmouseleave = () => {
      this.panning = false
    }
    this.canvas.oncontextmenu = (e) => e.preventDefault()
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const s = this._pointerScreen(e)
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      this.viewport.zoomAt(s.x, s.y, factor)
    }, { passive: false })

    addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this._isInputTarget(e.target)) {
        if (!this.spaceDown) {
          this.spaceDown = true
          if (!this.panning) this.canvas.style.cursor = 'grab'
        }
        e.preventDefault()
      }
    })
    addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false
        if (!this.panning) this.canvas.style.cursor = 'default'
      }
    })
  }

  _draw() {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.viewport) this.viewport.applyToCtx(ctx)
    const k = this.viewport ? (1 / this.viewport.scale) : 1

    // Faded wires.
    ctx.strokeStyle = '#3a3f5a'
    ctx.lineWidth = 1 * k
    ctx.setLineDash([4 * k, 3 * k])
    for (const w of this.project.wires) {
      const a = w.getStartPoint()
      const b = w.getEndPoint()
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Strips and LEDs colored from the live frame buffer.
    for (const entry of this.stripIndex) {
      const s = entry.strip
      if (s.points.length === 0) continue
      ctx.strokeStyle = '#4a4a55'
      ctx.lineWidth = 1 * k
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y)
      }
      ctx.stroke()

      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i]
        const c = this.frame[entry.offset + i] || [0, 0, 0]
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5 * k, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`
        ctx.fill()
        if (c[0] || c[1] || c[2]) {
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`
          ctx.lineWidth = 1 * k
          ctx.beginPath()
          ctx.arc(p.x, p.y, 7 * k, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    requestAnimationFrame(this._draw)
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: wire the new controller and own the entire effects pipeline.
//
// The legacy `effects` and `currentEffect` from led_audio_editor.js are NOT
// reused. Cross-script `let` sharing is unreliable, and even when it works the
// legacy list/select handlers reference local lexical bindings that we can't
// override via `window`. Owning the data and the UI handlers here keeps the
// flow self-contained.

window.addEventListener('load', () => {
  const project = window.ledProject
  const store = window.animStore
  const effectsCanvas = document.getElementById('ledCanvasEffects')
  if (!project || !store || !effectsCanvas) return

  // Replace the legacy controller. Preserve the analyser the legacy bootstrap
  // already attached so audio continues to feed the new controller.
  const oldCtrl = (typeof audioToolContext !== 'undefined') ? audioToolContext.audioCtrl : null
  const newCtrl = new ProjectAudioLedController(effectsCanvas, project, store)
  if (oldCtrl) {
    newCtrl.setAnalayzer(oldCtrl.analyser)
    if (oldCtrl.audioEnd === false) oldCtrl.stop()
  }
  if (typeof audioToolContext !== 'undefined') {
    audioToolContext.audioCtrl = newCtrl
  }
  window.audioCtrl = newCtrl

  // Resize when the effects tab is shown so the canvas matches its container.
  const effectsTabEl = document.getElementById('effects-tab')
  if (effectsTabEl) {
    effectsTabEl.addEventListener('shown.bs.tab', () => newCtrl.resize())
  }

  // -------------------------------------------------------------------------
  // Local effects state (replaces the legacy `effects` / `currentEffect`).
  // -------------------------------------------------------------------------

  const effects = []
  let currentEffectIdx = -1
  // When >= 0, the add-effect modal is in "edit" mode and `addEffect()` will
  // replace `effects[editingEffectIdx]` instead of appending. Reset to -1
  // whenever the modal hides (regardless of save / cancel).
  let editingEffectIdx = -1

  const effectListEl = document.getElementById('effect-list')
  const animSelect = document.getElementById('effect-anim')
  const endAnimSelect = document.getElementById('effect-end-animation')
  const effectTypeSelect = document.getElementById('effect-type')

  const EFFECT_TYPE_NAME = {
    EffectPulse: 'Pulse',
    EffectAnim: 'Animation',
    EffectTriger: 'Trigger',
  }
  const EFFECT_TYPE_INDEX = {
    EffectPulse: 0,
    EffectAnim: 1,
    EffectTriger: 2,
  }

  // -------------------------------------------------------------------------
  // Animation selects (populated from the new AnimationStore).
  // -------------------------------------------------------------------------

  const populateAnimSelect = (sel) => {
    if (!sel) return
    const prev = sel.value
    sel.innerHTML = ''
    store.animations.forEach((a, idx) => {
      const opt = document.createElement('option')
      opt.value = String(idx)
      opt.textContent = a.name || `Animation ${idx + 1}`
      sel.appendChild(opt)
    })
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev
  }

  const refreshAddEffectModalSelects = () => {
    populateAnimSelect(animSelect)
    populateAnimSelect(endAnimSelect)
  }

  const addEffectModalEl = document.getElementById('add-effect-modal')
  if (addEffectModalEl) {
    addEffectModalEl.addEventListener('show.bs.modal', refreshAddEffectModalSelects)
  }

  store.on('animation-list-changed', refreshAddEffectModalSelects)
  store.on('animation-changed', refreshAddEffectModalSelects)

  // The legacy `change` handler on #effect-type wipes #effect-end-animation
  // and refills it from the (now empty) legacy animationCtx. Re-fill from the
  // new store after it runs (event listeners fire in registration order).
  if (effectTypeSelect) {
    effectTypeSelect.addEventListener('change', () => {
      if (effectTypeSelect.value === 'Trigger') populateAnimSelect(endAnimSelect)
    })
  }

  // -------------------------------------------------------------------------
  // Effect construction.
  // -------------------------------------------------------------------------

  const buildEffect = ({ effectType, animIdx, settings, endAnimIdx }) => {
    const anim = store.animations[animIdx]
    if (!anim) return null
    let effect
    if (effectType === 0) effect = new EffectPulse(anim, settings)
    else if (effectType === 1) effect = new EffectAnim(anim, settings)
    else if (effectType === 2) {
      const endAnim = store.animations[endAnimIdx]
      if (!endAnim) return null
      effect = new EffectTriger(anim, endAnim, settings)
    } else {
      return null
    }
    effect._animationId = anim.id
    effect._endAnimationId = (effectType === 2 && store.animations[endAnimIdx])
      ? store.animations[endAnimIdx].id : null
    effect._effectType = effectType
    return effect
  }

  const readSettingsFromForm = () => ({
    HzRange: {
      min: parseInt(document.getElementById('effect-Hz-min-range').value),
      max: parseInt(document.getElementById('effect-Hz-max-range').value),
    },
    range: {
      min: parseInt(document.getElementById('effect-min-range').value),
      max: parseInt(document.getElementById('effect-max-range').value),
    },
    timeWindow: parseFloat(document.getElementById('effect-time-window').value) || 0,
    animationRate: parseFloat(document.getElementById('effect-animation-rate').value) || 0,
    endAnimationIndex: 0,
  })

  // -------------------------------------------------------------------------
  // UI: list, control panel, selection, audio bands.
  // -------------------------------------------------------------------------

  const updateBandsInSpectrum = () => {
    if (typeof audioToolContext === 'undefined' || !audioToolContext.audioSpectrum) return
    audioToolContext.audioSpectrum.resetBands()
    for (const e of effects) {
      const s = e.effect && e.effect.settings && e.effect.settings.HzRange
      if (!s) continue
      audioToolContext.audioSpectrum.addBand(s.min, s.max)
    }
  }

  const updateEffectList = () => {
    if (!effectListEl) return
    effectListEl.innerHTML = ''
    effects.forEach((e, index) => {
      const li = document.createElement('li')
      li.classList.add('list-group-item', 'd-flex', 'ps-2')
      const ctorName = e.effect.constructor.name
      const animName = (e.effect && e.effect.animation && e.effect.animation.name) || ''
      const hzMin = e.effect.settings?.HzRange?.min ?? ''
      const hzMax = e.effect.settings?.HzRange?.max ?? ''
      const lvlMin = e.effect.settings?.range?.min ?? ''
      const lvlMax = e.effect.settings?.range?.max ?? ''
      li.innerHTML =
        `<input id="effect_checkbox${index}" type="checkbox"/>` +
        `<div class="w-100 ms-1 d-flex flex-column">` +
        `<label class="list-item-label">${EFFECT_TYPE_NAME[ctorName] || ctorName}: ${animName}</label>` +
        `<label class="list-item-content">Band: ${hzMin}-${hzMax} Hz</label>` +
        `<label class="list-item-content">Level: ${lvlMin}-${lvlMax}</label>` +
        `</div>`
      li.addEventListener('click', (event) => {
        if (event.target && event.target.type === 'checkbox') return
        selectEffect(index)
      })
      li.addEventListener('dblclick', (event) => {
        if (event.target && event.target.type === 'checkbox') return
        openEditEffectModal(index)
      })
      if (index === currentEffectIdx) li.classList.add('selected-item')
      effectListEl.appendChild(li)
      const cb = document.getElementById(`effect_checkbox${index}`)
      if (cb) {
        cb.checked = !!e.selected
        cb.addEventListener('click', () => { e.selected = cb.checked })
      }
    })
  }

  const setVal = (id, v) => {
    const el = document.getElementById(id)
    if (el) el.value = (v === undefined || v === null) ? '' : v
  }

  const updateEffectControl = (index) => {
    if (index < 0 || index >= effects.length) {
      setVal('effect-Hz-min-range', '')
      setVal('effect-Hz-max-range', '')
      setVal('effect-min-range', '')
      setVal('effect-max-range', '')
      return
    }
    const e = effects[index]
    const ctorName = e.effect.constructor.name
    if (effectTypeSelect) {
      effectTypeSelect.selectedIndex = EFFECT_TYPE_INDEX[ctorName] ?? 0
      // Trigger the legacy change-handler so trigger/anim controls show/hide.
      effectTypeSelect.dispatchEvent(new Event('change'))
    }
    populateAnimSelect(animSelect)
    populateAnimSelect(endAnimSelect)
    if (animSelect && e.animationId !== undefined && e.animationId !== null) {
      const idx = store.animations.findIndex(a => a.id === e.animationId)
      if (idx >= 0) animSelect.value = String(idx)
    }
    if (endAnimSelect && e.endAnimationId) {
      const idx = store.animations.findIndex(a => a.id === e.endAnimationId)
      if (idx >= 0) endAnimSelect.value = String(idx)
    }
    setVal('effect-Hz-min-range', e.effect.settings?.HzRange?.min)
    setVal('effect-Hz-max-range', e.effect.settings?.HzRange?.max)
    setVal('effect-min-range', e.effect.settings?.range?.min)
    setVal('effect-max-range', e.effect.settings?.range?.max)
    if (e.effect instanceof EffectTriger) {
      setVal('effect-time-window', e.effect.settings?.timeWindow)
      setVal('effect-animation-rate', e.effect.settings?.animationRate)
    }
  }

  const selectEffect = (index) => {
    currentEffectIdx = index
    updateEffectList()
    updateEffectControl(index)
  }

  // ---- Add / edit modal helpers ------------------------------------------

  const getAddEffectButton = () => {
    if (!addEffectModalEl) return null
    return addEffectModalEl.querySelector('.modal-footer button[onclick="addEffect()"]')
  }

  // Switch the modal title and the primary button between "Add" and "Edit"
  // styles so it's obvious which action will fire on click.
  const setEditEffectModalMode = (editing) => {
    const title = document.getElementById('add-effect-modal-title')
    if (title) title.textContent = editing ? 'Edit effect' : 'Add effect'
    const btn = getAddEffectButton()
    if (btn) {
      btn.title = editing ? 'Save changes' : 'Add effect'
      const icon = btn.querySelector('span')
      if (icon) {
        icon.classList.toggle('fa-plus', !editing)
        icon.classList.toggle('fa-save', editing)
      }
    }
  }

  const populateModalFromEffect = (idx) => {
    if (idx < 0 || idx >= effects.length) return
    const e = effects[idx]
    populateAnimSelect(animSelect)
    populateAnimSelect(endAnimSelect)
    if (effectTypeSelect && Number.isFinite(e.effectType)) {
      effectTypeSelect.selectedIndex = e.effectType
      effectTypeSelect.dispatchEvent(new Event('change'))
    }
    if (animSelect && e.animationId !== undefined && e.animationId !== null) {
      const aIdx = store.animations.findIndex(a => a.id === e.animationId)
      if (aIdx >= 0) animSelect.value = String(aIdx)
    }
    if (endAnimSelect && e.endAnimationId) {
      const aIdx = store.animations.findIndex(a => a.id === e.endAnimationId)
      if (aIdx >= 0) endAnimSelect.value = String(aIdx)
    }
    setVal('effect-Hz-min-range', e.effect.settings?.HzRange?.min)
    setVal('effect-Hz-max-range', e.effect.settings?.HzRange?.max)
    setVal('effect-min-range', e.effect.settings?.range?.min)
    setVal('effect-max-range', e.effect.settings?.range?.max)
    if (e.effect instanceof EffectTriger) {
      setVal('effect-time-window', e.effect.settings?.timeWindow)
      setVal('effect-animation-rate', e.effect.settings?.animationRate)
    }
  }

  const openEditEffectModal = (idx) => {
    if (idx < 0 || idx >= effects.length || !addEffectModalEl) return
    editingEffectIdx = idx
    populateModalFromEffect(idx)
    setEditEffectModalMode(true)
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(addEffectModalEl).show()
    }
  }

  // Reset edit mode whenever the modal closes - covers both Save and Cancel.
  if (addEffectModalEl) {
    addEffectModalEl.addEventListener('hidden.bs.modal', () => {
      editingEffectIdx = -1
      setEditEffectModalMode(false)
    })
  }

  const addEffect = () => {
    if (!animSelect) return
    const animIdx = parseInt(animSelect.value)
    const effectType = effectTypeSelect ? effectTypeSelect.selectedIndex : 0
    const endAnimIdx = endAnimSelect ? parseInt(endAnimSelect.value) : -1
    if (!Number.isFinite(animIdx)) return
    const settings = readSettingsFromForm()
    const effect = buildEffect({ effectType, animIdx, settings, endAnimIdx })
    if (!effect) return
    const entry = {
      effect,
      animationId: store.animations[animIdx]?.id ?? null,
      endAnimationId: effect._endAnimationId,
      effectType,
    }
    if (editingEffectIdx >= 0 && editingEffectIdx < effects.length) {
      // Preserve the existing checkbox state on edit so an active effect
      // stays active across the edit.
      entry.selected = !!effects[editingEffectIdx].selected
      effects[editingEffectIdx] = entry
    } else {
      entry.selected = true
      effects.push(entry)
    }
    updateEffectList()
    updateEffectControl(-1)
    updateBandsInSpectrum()
    // Close the modal on save - the `hidden.bs.modal` listener resets the
    // edit state and the button/title back to "Add effect".
    if (addEffectModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(addEffectModalEl).hide()
    }
  }

  const deleteEffect = () => {
    if (currentEffectIdx < 0 || currentEffectIdx >= effects.length) return
    effects.splice(currentEffectIdx, 1)
    currentEffectIdx = -1
    updateEffectList()
    updateEffectControl(-1)
    updateBandsInSpectrum()
  }

  // Push the active effect set into the controller (used by the Update button).
  const pushActiveEffectsToController = () => {
    if (typeof audioToolContext === 'undefined' || !audioToolContext.audioCtrl) return
    audioToolContext.audioCtrl.resetEffects()
    for (const e of effects) {
      if (e.selected) audioToolContext.audioCtrl.addEffect(e.effect)
    }
    updateBandsInSpectrum()
  }

  // -------------------------------------------------------------------------
  // Save / load (project-aware format).
  //
  // Effects are written as part of the unified project file (see led_animation.js).
  // We expose `serializeEffects()` / `deserializeEffects(data)` on window so the
  // project save/load can pull effects in/out without owning the effects state
  // itself. We also keep the standalone "effects only" load in case someone
  // imports a legacy `led_effects.json` file.
  // -------------------------------------------------------------------------

  const serializeEffects = () => effects.map(e => ({
    effectType: e.effectType,
    animationId: e.animationId,
    endAnimationId: e.endAnimationId || null,
    settings: e.effect && e.effect.settings ? e.effect.settings : null,
    selected: !!e.selected,
  }))

  const hasEffects = () => effects.length > 0

  // Replace the current effects with the ones described in `data` (an array
  // produced by serializeEffects, or undefined to clear). Returns the number
  // of effects loaded (skipping any whose animation is missing).
  const deserializeEffects = (data) => {
    effects.length = 0
    let loaded = 0
    for (const ed of data || []) {
      const animIdx = store.animations.findIndex(a => a.id === ed.animationId)
      const endAnimIdx = (ed.endAnimationId !== null && ed.endAnimationId !== undefined)
        ? store.animations.findIndex(a => a.id === ed.endAnimationId) : -1
      if (animIdx < 0) continue
      const effect = buildEffect({
        effectType: ed.effectType,
        animIdx,
        settings: ed.settings || {},
        endAnimIdx,
      })
      if (!effect) continue
      effects.push({
        effect,
        selected: !!ed.selected,
        animationId: ed.animationId,
        endAnimationId: ed.endAnimationId || null,
        effectType: ed.effectType,
      })
      loaded++
    }
    currentEffectIdx = -1
    updateEffectList()
    updateEffectControl(-1)
    updateBandsInSpectrum()
    return loaded
  }

  const saveEffectsToFile = () => {
    // Standalone effects-only file (legacy). The unified project save/load
    // (window.saveLedsConfig) is the preferred path.
    const out = {
      version: 2,
      kind: 'led-effects',
      effects: serializeEffects(),
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'led_effects.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const loadEffectsFromFile = (event) => {
    const file = event && event.target && event.target.files && event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data || data.kind !== 'led-effects') {
          console.warn('Not a led-effects file')
          return
        }
        deserializeEffects(data.effects)
      } catch (err) {
        console.error('Failed to load effects:', err)
      }
      if (event && event.target) event.target.value = ''
    }
    reader.readAsText(file)
  }

  // -------------------------------------------------------------------------
  // Expose to inline `onclick`/`onchange` handlers in the HTML.
  // -------------------------------------------------------------------------

  window.addEffect = addEffect
  window.deleteEffect = deleteEffect
  window.updateEffect = pushActiveEffectsToController
  window.updateEffectList = updateEffectList
  window.updateEffectControl = updateEffectControl
  window.selectEffect = selectEffect
  window.updateBandsInSpectrum = updateBandsInSpectrum
  window.saveEffectsToFile = saveEffectsToFile
  window.loadEffectsFromFile = loadEffectsFromFile

  // Used by the unified project save/load in led_animation.js so the project
  // file can include effects when they exist.
  window.serializeEffects = serializeEffects
  window.deserializeEffects = deserializeEffects
  window.hasEffects = hasEffects

  // Initial select population so the modal shows up populated even before
  // shown.bs.modal (e.g. if the modal is opened programmatically).
  refreshAddEffectModalSelects()
  // Clear any stale list rendering from the legacy bootstrap.
  updateEffectList()
})
