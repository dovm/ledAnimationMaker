// Project-aware animation model and controllers.
//
// Designed to work with LedProject (layout_project.js):
//   - Strips are addressed by stable id (LedStripObject.id), and LEDs
//     within a strip by their integer index.
//   - Groups reference (stripId, ledIndex) pairs so they survive layout
//     edits.
//   - Each frame stores a color per group; LEDs not in any group are off.
//   - The project emits 'strip-removed' / 'strip-changed' so we can prune
//     stale group members.
//
// This is intentionally separate from the legacy classes in led_common.js
// so the Effects tab keeps working unchanged.

class LedGroup {
  static _nextId = 1

  constructor(name = '') {
    this.id = LedGroup._nextId++
    this.name = name || `Group ${this.id}`
    this.members = [] // array of { stripId, ledIndex }
    this.selected = false
  }

  has(stripId, ledIndex) {
    return this.members.some(m => m.stripId === stripId && m.ledIndex === ledIndex)
  }

  addLed(stripId, ledIndex) {
    if (!this.has(stripId, ledIndex)) {
      this.members.push({ stripId, ledIndex })
    }
  }

  removeLed(stripId, ledIndex) {
    this.members = this.members.filter(
      m => !(m.stripId === stripId && m.ledIndex === ledIndex)
    )
  }

  size() {
    return this.members.length
  }
}

class AnimFrame {
  constructor() {
    // Map: groupId -> [r, g, b]
    this.groupColors = new Map()
  }

  setGroupColor(groupId, color) {
    this.groupColors.set(groupId, [color[0], color[1], color[2]])
  }

  getGroupColor(groupId) {
    return this.groupColors.get(groupId) || null
  }

  removeGroup(groupId) {
    this.groupColors.delete(groupId)
  }

  clone() {
    const f = new AnimFrame()
    for (const [k, v] of this.groupColors) f.groupColors.set(k, [...v])
    return f
  }
}

class ProjectAnimation {
  static _nextId = 1

  constructor(name = '') {
    this.id = ProjectAnimation._nextId++
    this.name = name || `Animation ${this.id}`
    this.frames = []
    this.groups = []
    this.selected = false
  }

  addGroup(group) {
    this.groups.push(group)
    return group
  }

  removeGroup(group) {
    this.groups = this.groups.filter(g => g !== group)
    for (const f of this.frames) f.removeGroup(group.id)
  }

  removeGroupByIndex(idx) {
    const g = this.groups[idx]
    if (g) this.removeGroup(g)
  }

  addFrame(frame, atIndex = -1) {
    if (atIndex < 0 || atIndex >= this.frames.length) {
      this.frames.push(frame)
    } else {
      this.frames.splice(atIndex, 0, frame)
    }
    return frame
  }

  removeFrame(idx) {
    if (idx >= 0 && idx < this.frames.length) this.frames.splice(idx, 1)
  }

  // Convenience accessors used by effects and other consumers that prefer a
  // method-based API over direct array access.
  getFrameCount() {
    return this.frames.length
  }

  getFrame(idx) {
    if (idx < 0 || idx >= this.frames.length) return null
    return this.frames[idx]
  }

  pruneInvalidMembers(stripIdRemoved = null, project = null) {
    for (const g of this.groups) {
      g.members = g.members.filter(m => {
        if (stripIdRemoved !== null && m.stripId === stripIdRemoved) return false
        if (project) {
          const s = project.getStripById(m.stripId)
          if (!s) return false
          if (m.ledIndex < 0 || m.ledIndex >= s.points.length) return false
        }
        return true
      })
    }
  }
}

class AnimationStore {
  constructor(project) {
    this.project = project
    this.animations = []
    this.currentAnimationIndex = -1
    this.currentFrameIndex = -1
    this.listeners = []
    this._bindProject()
  }

  on(event, handler) { this.listeners.push({ event, handler }) }
  emit(event, ...args) {
    for (const l of this.listeners) {
      if (l.event === event) {
        try { l.handler(...args) } catch (e) { console.error(e) }
      }
    }
  }

  _bindProject() {
    if (!this.project) return
    this.project.on('strip-removed', (strip) => {
      for (const a of this.animations) a.pruneInvalidMembers(strip.id, this.project)
      this.emit('groups-changed')
      this.emit('frame-changed')
    })
    this.project.on('strip-changed', (_strip) => {
      for (const a of this.animations) a.pruneInvalidMembers(null, this.project)
      this.emit('groups-changed')
      this.emit('frame-changed')
    })
  }

  getCurrentAnimation() {
    if (this.currentAnimationIndex < 0) return null
    return this.animations[this.currentAnimationIndex] || null
  }

  setCurrentAnimation(idx) {
    if (idx >= 0 && idx < this.animations.length) {
      this.currentAnimationIndex = idx
      const a = this.animations[idx]
      this.currentFrameIndex = a.frames.length > 0 ? 0 : -1
    } else {
      this.currentAnimationIndex = -1
      this.currentFrameIndex = -1
    }
    this.emit('animation-changed')
    this.emit('frame-changed')
    this.emit('groups-changed')
  }

  getCurrentFrame() {
    const a = this.getCurrentAnimation()
    if (!a) return null
    if (this.currentFrameIndex < 0 || this.currentFrameIndex >= a.frames.length) return null
    return a.frames[this.currentFrameIndex]
  }

  setCurrentFrame(idx) {
    const a = this.getCurrentAnimation()
    if (!a) return
    if (idx >= 0 && idx < a.frames.length) this.currentFrameIndex = idx
    this.emit('frame-changed')
  }

  addAnimation(animation) {
    this.animations.push(animation)
    this.emit('animation-list-changed')
    return animation
  }

  removeAnimation(idx) {
    if (idx < 0 || idx >= this.animations.length) return
    this.animations.splice(idx, 1)
    if (this.currentAnimationIndex >= this.animations.length) {
      this.setCurrentAnimation(this.animations.length - 1)
    } else if (this.currentAnimationIndex === idx) {
      this.setCurrentAnimation(this.animations.length > 0 ? 0 : -1)
    }
    this.emit('animation-list-changed')
  }
}

// ---------------------------------------------------------------------------
// Canvas controller for the animation tab.
//
// Renders the project (strips + wires), colors LEDs according to the current
// frame's group colors, and provides selection (click + drag-rectangle).

class AnimationCanvasController {
  constructor(canvas, project, store) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.project = project
    this.store = store

    // selection: array of { stripId, ledIndex }
    this.selection = []

    // drag state
    this.dragging = false
    this.dragStart = null
    this.dragCurrent = null
    this.additive = false

    this.hitRadius = 10

    this.onSelectionChange = null
    this.onLedDoubleClick = null

    this.viewport = new Viewport()
    this.panning = false
    this.panLastScreen = { x: 0, y: 0 }
    this.spaceDown = false

    this._draw = this._draw.bind(this)

    this.resize()
    addEventListener('resize', () => this.resize())
    this._bindInput()
    requestAnimationFrame(this._draw)

    if (this.store) {
      this.store.on('frame-changed', () => {})
      this.store.on('groups-changed', () => this._pruneSelection())
    }
    if (this.project) {
      this.project.on('strip-removed', (s) => {
        this.selection = this.selection.filter(m => m.stripId !== s.id)
        this._notifySelection()
      })
      this.project.on('strip-changed', () => {
        this._pruneSelection()
      })
    }
  }

  _pruneSelection() {
    const before = this.selection.length
    this.selection = this.selection.filter(m => {
      const s = this.project.getStripById(m.stripId)
      return s && m.ledIndex >= 0 && m.ledIndex < s.points.length
    })
    if (this.selection.length !== before) this._notifySelection()
  }

  _notifySelection() {
    if (this.onSelectionChange) this.onSelectionChange(this.selection)
  }

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

  pointerScreen(e) {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  pointerPos(e) {
    const s = this.pointerScreen(e)
    return this.viewport.screenToWorld(s.x, s.y)
  }

  resetView() {
    this.viewport.reset()
  }

  _shouldPan(e) {
    return e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)
  }

  _isInputTarget(el) {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  _bindInput() {
    this.canvas.onmousedown = (e) => {
      if (this._shouldPan(e)) {
        e.preventDefault()
        this.panning = true
        this.panLastScreen = this.pointerScreen(e)
        this.canvas.style.cursor = 'grabbing'
        return
      }
      const p = this.pointerPos(e)
      this.additive = e.shiftKey || e.ctrlKey || e.metaKey
      const hit = this._findLedAt(p.x, p.y)
      if (hit) {
        if (this.additive) {
          if (this._selectionHas(hit)) this._selectionRemove(hit)
          else this.selection.push(hit)
        } else {
          this.selection = [hit]
        }
        this._notifySelection()
        this.dragging = false
        return
      }
      // start rectangle drag
      this.dragging = true
      this.dragStart = p
      this.dragCurrent = p
      if (!this.additive) {
        this.selection = []
        this._notifySelection()
      }
    }

    this.canvas.onmousemove = (e) => {
      if (this.panning) {
        const cur = this.pointerScreen(e)
        const dx = cur.x - this.panLastScreen.x
        const dy = cur.y - this.panLastScreen.y
        this.viewport.panBy(dx, dy)
        this.panLastScreen = cur
        return
      }
      const p = this.pointerPos(e)
      if (this.dragging) this.dragCurrent = p
    }

    this.canvas.onmouseup = (e) => {
      if (this.panning) {
        this.panning = false
        this.canvas.style.cursor = this.spaceDown ? 'grab' : 'default'
        return
      }
      if (!this.dragging) return
      this.dragging = false
      const p = this.pointerPos(e)
      this.dragCurrent = p
      this._applyRectSelection()
      this.dragStart = null
      this.dragCurrent = null
      this._notifySelection()
    }

    this.canvas.onmouseleave = () => {
      this.panning = false
      if (this.dragging) {
        this.dragging = false
        this._applyRectSelection()
        this.dragStart = null
        this.dragCurrent = null
        this._notifySelection()
      }
    }

    this.canvas.oncontextmenu = (e) => {
      e.preventDefault()
    }

    this.canvas.ondblclick = (e) => {
      const p = this.pointerPos(e)
      const hit = this._findLedAt(p.x, p.y)
      if (hit && this.onLedDoubleClick) this.onLedDoubleClick(hit)
    }

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const s = this.pointerScreen(e)
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

  _selectionHas(led) {
    return this.selection.some(m => m.stripId === led.stripId && m.ledIndex === led.ledIndex)
  }

  _selectionRemove(led) {
    this.selection = this.selection.filter(
      m => !(m.stripId === led.stripId && m.ledIndex === led.ledIndex)
    )
  }

  _findLedAt(x, y) {
    let best = null
    let bestDist = this.hitRadius / this.viewport.scale
    for (const s of this.project.strips) {
      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i]
        const d = Math.hypot(p.x - x, p.y - y)
        if (d < bestDist) {
          bestDist = d
          best = { stripId: s.id, ledIndex: i }
        }
      }
    }
    return best
  }

  _applyRectSelection() {
    if (!this.dragStart || !this.dragCurrent) return
    const x1 = Math.min(this.dragStart.x, this.dragCurrent.x)
    const x2 = Math.max(this.dragStart.x, this.dragCurrent.x)
    const y1 = Math.min(this.dragStart.y, this.dragCurrent.y)
    const y2 = Math.max(this.dragStart.y, this.dragCurrent.y)
    if ((x2 - x1) < 2 && (y2 - y1) < 2) return
    const additions = []
    for (const s of this.project.strips) {
      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i]
        if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
          additions.push({ stripId: s.id, ledIndex: i })
        }
      }
    }
    if (this.additive) {
      for (const a of additions) {
        if (!this._selectionHas(a)) this.selection.push(a)
      }
    } else {
      this.selection = additions
    }
  }

  selectAll() {
    const all = []
    for (const s of this.project.strips) {
      for (let i = 0; i < s.points.length; i++) all.push({ stripId: s.id, ledIndex: i })
    }
    this.selection = all
    this._notifySelection()
  }

  clearSelection() {
    this.selection = []
    this._notifySelection()
  }

  setSelectionFromGroup(group) {
    this.selection = group.members.map(m => ({ stripId: m.stripId, ledIndex: m.ledIndex }))
    this._notifySelection()
  }

  // ---- rendering ----

  _ledColor(stripId, ledIndex) {
    const anim = this.store && this.store.getCurrentAnimation()
    const frame = this.store && this.store.getCurrentFrame()
    if (!anim || !frame) return null
    let color = null
    for (const g of anim.groups) {
      if (g.has(stripId, ledIndex)) {
        const c = frame.getGroupColor(g.id)
        if (c) color = c
      }
    }
    return color
  }

  _isSelected(stripId, ledIndex) {
    return this.selection.some(m => m.stripId === stripId && m.ledIndex === ledIndex)
  }

  _isInSelectedGroup(stripId, ledIndex) {
    const anim = this.store && this.store.getCurrentAnimation()
    if (!anim) return false
    return anim.groups.some(g => g.selected && g.has(stripId, ledIndex))
  }

  _draw() {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.viewport.applyToCtx(ctx)
    const k = 1 / this.viewport.scale // keep visual sizes constant in screen px

    // wires (faded)
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

    // strips: draw base line, then color each LED
    for (const s of this.project.strips) {
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
        const c = this._ledColor(s.id, i)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5 * k, 0, Math.PI * 2)
        ctx.fillStyle = c ? `rgb(${c[0]},${c[1]},${c[2]})` : '#222'
        ctx.fill()
        if (c) {
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`
          ctx.lineWidth = 1 * k
          ctx.beginPath()
          ctx.arc(p.x, p.y, 7 * k, 0, Math.PI * 2)
          ctx.stroke()
        }
        if (this._isInSelectedGroup(s.id, i)) {
          ctx.strokeStyle = '#9aa1ff'
          ctx.lineWidth = 1.5 * k
          ctx.beginPath()
          ctx.arc(p.x, p.y, 6 * k, 0, Math.PI * 2)
          ctx.stroke()
        }
        if (this._isSelected(s.id, i)) {
          ctx.strokeStyle = '#ff5cae'
          ctx.lineWidth = 2 * k
          ctx.beginPath()
          ctx.arc(p.x, p.y, 7.5 * k, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    // selection rectangle (drawn in world space; stroke kept constant in screen px)
    if (this.dragging && this.dragStart && this.dragCurrent) {
      const x1 = Math.min(this.dragStart.x, this.dragCurrent.x)
      const y1 = Math.min(this.dragStart.y, this.dragCurrent.y)
      const w = Math.abs(this.dragCurrent.x - this.dragStart.x)
      const h = Math.abs(this.dragCurrent.y - this.dragStart.y)
      ctx.strokeStyle = '#ff5cae'
      ctx.fillStyle = 'rgba(255,92,174,0.08)'
      ctx.lineWidth = 1 * k
      ctx.fillRect(x1, y1, w, h)
      ctx.strokeRect(x1, y1, w, h)
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    requestAnimationFrame(this._draw)
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: wire the new model into the animation tab.

window.addEventListener('load', () => {
  const animCanvas = document.getElementById('ledCanvasAnimation')
  const project = window.ledProject
  if (!animCanvas || !project) return

  // Make sure canvas has a sized parent (set when tab becomes active too).
  const sizeAnimCanvas = () => {
    const parent = animCanvas.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w > 0 && h > 0) {
      animCanvas.width = w
      animCanvas.height = h
    }
  }
  sizeAnimCanvas()

  const store = new AnimationStore(project)
  window.animStore = store

  const ctrl = new AnimationCanvasController(animCanvas, project, store)
  window.animCtrl = ctrl

  const animList = document.getElementById('animation-list')
  const groupList = document.getElementById('led-group-list')
  const frameTimeline = document.getElementById('frame-thumbnails')
  const animNameInput = document.getElementById('animName')
  const brushColorInput = document.getElementById('brushColor')
  const selectedLedsLabel = document.getElementById('animation-status-line-selected-leds')
  const ledNumberLabel = document.getElementById('animation-status-line-led-number')
  const coordsLabel = document.getElementById('animation-status-line-coordinates')

  const getBrushColor = () => {
    const hex = brushColorInput?.value || '#ff0000'
    return [
      parseInt(hex.substr(1, 2), 16),
      parseInt(hex.substr(3, 2), 16),
      parseInt(hex.substr(5, 2), 16),
    ]
  }

  const refreshSelectedCount = () => {
    if (selectedLedsLabel) {
      selectedLedsLabel.textContent = `${ctrl.selection.length} leds`
    }
  }

  ctrl.onSelectionChange = refreshSelectedCount
  refreshSelectedCount()

  // ---- Animation list rendering ----
  const renderAnimationList = () => {
    if (!animList) return
    animList.innerHTML = ''
    store.animations.forEach((anim, index) => {
      const li = document.createElement('li')
      li.classList.add('list-group-item')
      if (index === store.currentAnimationIndex) li.classList.add('selected-item')
      li.innerHTML = `
        <input id="animation${index}" type="checkbox" />
        <label style="min-width: 30px; min-height: 20px;" id="animLabel${index}">${anim.name}</label>
        <input type="text" class="form-control hidden-input" id="animLabelEdit${index}" />
      `
      animList.appendChild(li)

      li.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return
        store.setCurrentAnimation(index)
      })

      const label = li.querySelector(`#animLabel${index}`)
      const input = li.querySelector(`#animLabelEdit${index}`)
      label.addEventListener('dblclick', () => {
        label.classList.add('hidden-input')
        input.value = label.textContent
        input.classList.remove('hidden-input')
        input.focus()
      })
      const save = () => {
        label.textContent = input.value
        label.classList.remove('hidden-input')
        input.classList.add('hidden-input')
        anim.name = label.textContent
      }
      input.addEventListener('blur', save)
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur() })

      const cb = li.querySelector(`#animation${index}`)
      cb.checked = anim.selected
      cb.addEventListener('click', () => { anim.selected = cb.checked })
    })
  }

  // ---- Group list rendering ----
  const rgbToHex = (c) => {
    if (!c) return '#000000'
    const h = (n) => n.toString(16).padStart(2, '0')
    return '#' + h(c[0]) + h(c[1]) + h(c[2])
  }

  const renderGroupList = () => {
    if (!groupList) return
    groupList.innerHTML = ''
    const anim = store.getCurrentAnimation()
    if (!anim) return
    const frame = store.getCurrentFrame()
    anim.groups.forEach((group, index) => {
      const li = document.createElement('li')
      li.classList.add('list-group-item', 'led-group')
      li.dataset.groupIndex = index
      if (group.selected) li.classList.add('selected-item')

      const colorHex = rgbToHex(frame ? frame.getGroupColor(group.id) : null)
      li.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <input id="groupSel${index}" type="checkbox" />
          <input type="color" class="form-control form-control-color" style="width: 32px; padding: 0; border: 0;"
                 id="groupColor${index}" value="${colorHex}" title="Color in current frame" />
          <span style="flex: 1; min-width: 0;" class="text-truncate">${group.name} (${group.size()} LEDs)</span>
          <button type="button" class="btn btn-sm btn-default" id="groupDel${index}" title="Remove group">
            <span class="fa-solid fa-xmark"></span>
          </button>
        </div>
      `
      groupList.appendChild(li)

      li.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return
        for (const g of anim.groups) g.selected = false
        group.selected = true
        ctrl.setSelectionFromGroup(group)
        renderGroupList()
      })

      const cb = li.querySelector(`#groupSel${index}`)
      cb.checked = group.selected
      cb.addEventListener('click', (e) => {
        e.stopPropagation()
        group.selected = cb.checked
      })

      const colorInput = li.querySelector(`#groupColor${index}`)
      colorInput.addEventListener('input', () => {
        const f = store.getCurrentFrame()
        if (!f) return
        f.setGroupColor(group.id, [
          parseInt(colorInput.value.substr(1, 2), 16),
          parseInt(colorInput.value.substr(3, 2), 16),
          parseInt(colorInput.value.substr(5, 2), 16),
        ])
        renderFrameThumbnails()
      })

      const delBtn = li.querySelector(`#groupDel${index}`)
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        anim.removeGroup(group)
        renderGroupList()
        renderFrameThumbnails()
      })
    })
  }

  // ---- Frame thumbnails ----
  const drawFrameThumb = (anim, frame, canvas) => {
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (project.strips.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of project.strips) for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    if (!Number.isFinite(minX)) return
    const margin = 4
    const sw = (maxX - minX) || 1
    const sh = (maxY - minY) || 1
    const scale = Math.min((canvas.width - 2 * margin) / sw, (canvas.height - 2 * margin) / sh)
    const offX = margin + ((canvas.width - 2 * margin) - sw * scale) / 2
    const offY = margin + ((canvas.height - 2 * margin) - sh * scale) / 2

    const colorOf = (stripId, idx) => {
      let c = null
      for (const g of anim.groups) {
        if (g.has(stripId, idx)) {
          const fc = frame.getGroupColor(g.id)
          if (fc) c = fc
        }
      }
      return c
    }
    for (const s of project.strips) {
      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i]
        const c = colorOf(s.id, i)
        ctx.fillStyle = c ? `rgb(${c[0]},${c[1]},${c[2]})` : '#444'
        ctx.fillRect(offX + (p.x - minX) * scale - 1, offY + (p.y - minY) * scale - 1, 2, 2)
      }
    }
  }

  const renderFrameThumbnails = () => {
    if (!frameTimeline) return
    frameTimeline.innerHTML = ''
    const anim = store.getCurrentAnimation()
    if (!anim) return
    anim.frames.forEach((frame, index) => {
      const div = document.createElement('div')
      div.classList.add('frame-thumbnail')
      div.dataset.frameIndex = index
      const c = document.createElement('canvas')
      c.width = 60
      c.height = 60
      drawFrameThumb(anim, frame, c)
      div.appendChild(c)
      if (index === store.currentFrameIndex) div.classList.add('frame-thumbnail-current')
      div.onclick = () => {
        store.setCurrentFrame(index)
        renderFrameThumbnails()
        renderGroupList()
      }
      frameTimeline.appendChild(div)
    })
  }

  store.on('animation-list-changed', () => {
    renderAnimationList()
    renderGroupList()
    renderFrameThumbnails()
  })
  store.on('animation-changed', () => {
    renderAnimationList()
    renderGroupList()
    renderFrameThumbnails()
  })
  store.on('frame-changed', () => {
    renderFrameThumbnails()
    renderGroupList()
  })
  store.on('groups-changed', () => {
    renderGroupList()
    renderFrameThumbnails()
  })

  // Re-render thumbnails when project changes (so colors track new layout).
  project.on('strip-added', () => renderFrameThumbnails())
  project.on('strip-removed', () => { renderGroupList(); renderFrameThumbnails() })
  project.on('strip-changed', () => { renderGroupList(); renderFrameThumbnails() })
  project.on('wire-added', () => renderFrameThumbnails())
  project.on('wire-removed', () => renderFrameThumbnails())

  // Resize canvas when entering the animation tab.
  const animationTab = document.getElementById('animation-tab')
  if (animationTab) {
    animationTab.addEventListener('shown.bs.tab', () => {
      sizeAnimCanvas()
      ctrl.resize()
      renderAnimationList()
      renderGroupList()
      renderFrameThumbnails()
    })
  }

  // ---- Status line ----
  animCanvas.addEventListener('mousemove', (e) => {
    const r = animCanvas.getBoundingClientRect()
    const sx = e.clientX - r.left
    const sy = e.clientY - r.top
    const w = ctrl.viewport.screenToWorld(sx, sy)
    if (coordsLabel) coordsLabel.textContent = `${Math.floor(w.x)} / ${Math.floor(w.y)}`
    const hit = ctrl._findLedAt(w.x, w.y)
    if (ledNumberLabel) ledNumberLabel.textContent = hit ? `s${hit.stripId}:${hit.ledIndex + 1}` : '-'
  })

  // ===========================================================================
  // Override legacy onclick handlers used by the animation tab markup.
  // (These names are referenced from led_editor.html via inline onclick=...)
  // ===========================================================================

  window.createAnimation = function () {
    const name = animNameInput && animNameInput.value ? animNameInput.value : ''
    const a = new ProjectAnimation(name)
    a.addFrame(new AnimFrame())
    store.addAnimation(a)
    store.setCurrentAnimation(store.animations.length - 1)
  }

  window.deleteAnimation = function () {
    if (store.currentAnimationIndex >= 0) {
      store.removeAnimation(store.currentAnimationIndex)
    }
  }

  window.selectAnimation = function (index) {
    store.setCurrentAnimation(index)
  }

  window.addGroup = function () {
    const anim = store.getCurrentAnimation()
    if (!anim) return
    if (ctrl.selection.length === 0) return
    const g = new LedGroup()
    for (const m of ctrl.selection) g.addLed(m.stripId, m.ledIndex)
    anim.addGroup(g)
    for (const og of anim.groups) og.selected = (og === g)
    ctrl.setSelectionFromGroup(g)
    renderGroupList()
    renderFrameThumbnails()
  }

  window.clearGroups = function () {
    const anim = store.getCurrentAnimation()
    if (!anim) return
    anim.groups = []
    for (const f of anim.frames) f.groupColors.clear()
    renderGroupList()
    renderFrameThumbnails()
  }

  window.paintSelected = function () {
    const anim = store.getCurrentAnimation()
    const frame = store.getCurrentFrame()
    if (!anim || !frame) return
    const color = getBrushColor()
    // Apply to every group that intersects the current selection.
    const touched = new Set()
    for (const m of ctrl.selection) {
      for (const g of anim.groups) {
        if (!touched.has(g.id) && g.has(m.stripId, m.ledIndex)) {
          frame.setGroupColor(g.id, color)
          touched.add(g.id)
        }
      }
    }
    // If nothing matched but a group is selected, paint that group.
    if (touched.size === 0) {
      for (const g of anim.groups) {
        if (g.selected) frame.setGroupColor(g.id, color)
      }
    }
    renderGroupList()
    renderFrameThumbnails()
  }

  window.paint_tool = function () {
    // Simple stub: paint_tool is a one-shot brush in the new model.
    window.paintSelected()
  }

  window.select_tool = function () {
    ctrl.clearSelection()
  }

  window.addFrame = function () {
    const anim = store.getCurrentAnimation()
    if (!anim) return
    const at = store.currentFrameIndex < 0 ? anim.frames.length : store.currentFrameIndex + 1
    anim.addFrame(new AnimFrame(), at)
    store.setCurrentFrame(at)
    renderFrameThumbnails()
    renderGroupList()
  }

  window.deleteFrame = function () {
    const anim = store.getCurrentAnimation()
    if (!anim || store.currentFrameIndex < 0) return
    anim.removeFrame(store.currentFrameIndex)
    if (store.currentFrameIndex >= anim.frames.length) {
      store.currentFrameIndex = anim.frames.length - 1
    }
    store.emit('frame-changed')
    renderFrameThumbnails()
    renderGroupList()
  }

  window.duplicateFrame = function () {
    const anim = store.getCurrentAnimation()
    const cur = store.getCurrentFrame()
    if (!anim || !cur) return
    const dup = cur.clone()
    const at = store.currentFrameIndex + 1
    anim.addFrame(dup, at)
    store.setCurrentFrame(at)
    renderFrameThumbnails()
    renderGroupList()
  }

  window.prevFrame = function () {
    if (store.currentFrameIndex > 0) {
      store.setCurrentFrame(store.currentFrameIndex - 1)
      renderFrameThumbnails()
    }
  }

  window.nextFrame = function () {
    const anim = store.getCurrentAnimation()
    if (anim && store.currentFrameIndex < anim.frames.length - 1) {
      store.setCurrentFrame(store.currentFrameIndex + 1)
      renderFrameThumbnails()
    }
  }

  window.playAnimation = function () {
    const anim = store.getCurrentAnimation()
    if (!anim || anim.frames.length === 0) return
    const saved = store.currentFrameIndex
    let i = 0
    const interval = setInterval(() => {
      if (i >= anim.frames.length) {
        clearInterval(interval)
        store.setCurrentFrame(saved)
        renderFrameThumbnails()
        return
      }
      store.setCurrentFrame(i)
      renderFrameThumbnails()
      i++
    }, 200)
  }

  // ---------------------------------------------------------------------------
  // Group-animation generator (the "Group animation" modal in the animation tab).
  //
  // The "Groups" checkbox in the modal switches between two modes:
  //
  //   1) Unchecked - "single group, color animates":
  //        Pick exactly one target group (the currently-selected one, or the
  //        first group in the animation as a fallback). For each new frame
  //        i in [0, framesCount), set that group's color to the value
  //        produced by the configured color scheme at step i.
  //
  //   2) Checked - "all groups by their index":
  //        Walk the list of groups (those with `selected = true`, or every
  //        group in the animation if none are checked). For each new frame
  //        i in [0, framesCount), paint exactly one group - groups[i % N] -
  //        with the color produced by the color scheme at step i. Other
  //        groups in that frame keep whatever color they already had.
  //
  // Frames are appended starting at the current frame index, so callers can
  // stack several group-animations after each other.
  // ---------------------------------------------------------------------------
  // Resolve color-scheme functions via bare identifier lookup. In classic
  // <script> tags, top-level `function` declarations live in the global scope
  // chain even when they don't attach to `window` (which has bitten us before
  // with `let` declarations). `typeof <identifier>` is safe for undeclared
  // names - it returns the string 'undefined' instead of throwing.
  const buildSchemeMap = () => ({
    rainbow: (typeof rainbowColorScheme === 'function') ? rainbowColorScheme
           : (typeof window !== 'undefined' && typeof window.rainbowColorScheme === 'function') ? window.rainbowColorScheme
           : null,
    fade: (typeof fadeColorScheme === 'function') ? fadeColorScheme
        : (typeof window !== 'undefined' && typeof window.fadeColorScheme === 'function') ? window.fadeColorScheme
        : null,
    random: (typeof randomColorScheme === 'function') ? randomColorScheme
          : (typeof window !== 'undefined' && typeof window.randomColorScheme === 'function') ? window.randomColorScheme
          : null,
  })

  window.createAnimationOnGroup = function () {
    const anim = store.getCurrentAnimation()
    if (!anim) {
      console.warn('createAnimationOnGroup: no current animation')
      return
    }

    const framesEl = document.getElementById('framesCount')
    const schemeEl = document.getElementById('colorScheme')
    const groupsToggle = document.getElementById('apply-on-groups')
    if (!framesEl || !schemeEl || !groupsToggle) return

    const framesCount = parseInt(framesEl.value, 10)
    if (!Number.isFinite(framesCount) || framesCount <= 0) return

    const scheme = buildSchemeMap()[schemeEl.value]
    if (!scheme) {
      console.warn('createAnimationOnGroup: unknown color scheme', schemeEl.value)
      return
    }

    const startFrame = Math.max(0, store.currentFrameIndex)
    while (anim.frames.length < startFrame + framesCount) {
      anim.addFrame(new AnimFrame())
    }

    const selectedGroups = anim.groups.filter(g => g.selected)
    const useAllGroups = !!groupsToggle.checked

    if (useAllGroups) {
      const list = selectedGroups.length > 0 ? selectedGroups : anim.groups.slice()
      if (list.length === 0) {
        console.warn('createAnimationOnGroup: no groups available to sequence')
        return
      }
      for (let i = 0; i < framesCount; i++) {
        const frame = anim.frames[startFrame + i]
        const color = scheme(i, framesCount)
        const g = list[i % list.length]
        frame.setGroupColor(g.id, color)
      }
    } else {
      const target = selectedGroups[0] || anim.groups[0]
      if (!target) {
        console.warn('createAnimationOnGroup: no group to animate')
        return
      }
      for (let i = 0; i < framesCount; i++) {
        const frame = anim.frames[startFrame + i]
        const color = scheme(i, framesCount)
        frame.setGroupColor(target.id, color)
      }
    }

    store.emit('frame-changed')
    renderFrameThumbnails()
    renderGroupList()
  }

  // ===========================================================================
  // Project save / load (file menu).
  //
  // Format:
  //   { version: 2, kind: 'led-project',
  //     project: { strips: [...], wires: [...] },
  //     animations?: [...],
  //     effects?: [...] }
  //
  // What is included is determined by what content the user has authored:
  //   - layout only             ->  { project }
  //   - layout + animations     ->  { project, animations }
  //   - layout + anim + effects ->  { project, animations, effects }
  //
  // Effects are only saved when both effects exist AND animations exist (the
  // effects reference animations by id, so an effects-without-animations file
  // would deserialize to nothing useful).
  // ===========================================================================

  const serializeProject = () => ({
    strips: project.strips.map(s => ({
      id: s.id,
      length: s.length,
      ledsPerMeter: s.ledsPerMeter,
      points: s.points.map(p => {
        const pt = { x: p.x, y: p.y }
        if (p.fixed) {
          pt.fixed = true
          pt.fx = p.fx
          pt.fy = p.fy
        }
        return pt
      }),
    })),
    wires: project.wires.map(w => ({
      from: w.from.id,
      to: w.to.id,
      length: w.length || 0,
    })),
  })

  const deserializeProject = (data) => {
    // Clear existing strips (also drops associated wires via removeStrip).
    while (project.strips.length > 0) project.removeStrip(project.strips[0])
    while (project.wires.length > 0) project.removeWire(project.wires[0])

    let maxId = 0
    for (const sd of (data && data.strips) || []) {
      const s = new LedStripObject(sd.length, sd.ledsPerMeter)
      // Restore stable id so saved animations still reference the right strips.
      if (Number.isFinite(sd.id)) s.id = sd.id
      s.points = (sd.points || []).map(p => {
        const sp = new StripPoint(p.x, p.y)
        if (p.fixed) {
          sp.fixed = true
          sp.fx = (p.fx !== undefined) ? p.fx : p.x
          sp.fy = (p.fy !== undefined) ? p.fy : p.y
        }
        return sp
      })
      project.addStrip(s)
      if (s.id > maxId) maxId = s.id
    }
    LedStripObject._nextId = Math.max(LedStripObject._nextId, maxId + 1)

    for (const wd of (data && data.wires) || []) {
      const from = project.getStripById(wd.from)
      const to = project.getStripById(wd.to)
      if (from && to) project.addWire(new WireConnection(from, to, wd.length || 0))
    }
  }

  const hasAnimationData = () => {
    for (const a of store.animations) {
      if (a.frames.length > 0 || a.groups.length > 0) return true
    }
    return false
  }

  const serializeAnimations = () => store.animations.map(a => ({
    id: a.id,
    name: a.name,
    selected: !!a.selected,
    groups: a.groups.map(g => ({
      id: g.id,
      name: g.name,
      members: g.members.map(m => ({ stripId: m.stripId, ledIndex: m.ledIndex })),
    })),
    frames: a.frames.map(f => {
      const gc = {}
      for (const [k, v] of f.groupColors) gc[String(k)] = [v[0], v[1], v[2]]
      return { groupColors: gc }
    }),
  }))

  const deserializeAnimations = (data) => {
    store.animations = []
    store.currentAnimationIndex = -1
    store.currentFrameIndex = -1
    let maxAnimId = 0
    let maxGroupId = 0
    for (const ad of data || []) {
      const anim = new ProjectAnimation(ad.name)
      if (Number.isFinite(ad.id)) anim.id = ad.id
      if (ad.selected) anim.selected = true
      if (anim.id > maxAnimId) maxAnimId = anim.id
      for (const gd of ad.groups || []) {
        const g = new LedGroup(gd.name)
        if (Number.isFinite(gd.id)) g.id = gd.id
        if (g.id > maxGroupId) maxGroupId = g.id
        g.members = (gd.members || []).map(m => ({
          stripId: m.stripId,
          ledIndex: m.ledIndex,
        }))
        anim.groups.push(g)
      }
      for (const fd of ad.frames || []) {
        const f = new AnimFrame()
        const gc = (fd && fd.groupColors) || {}
        for (const k of Object.keys(gc)) {
          const c = gc[k]
          if (Array.isArray(c) && c.length >= 3) {
            f.groupColors.set(Number(k), [c[0], c[1], c[2]])
          }
        }
        anim.frames.push(f)
      }
      store.animations.push(anim)
    }
    ProjectAnimation._nextId = Math.max(ProjectAnimation._nextId, maxAnimId + 1)
    LedGroup._nextId = Math.max(LedGroup._nextId, maxGroupId + 1)
    if (store.animations.length > 0) {
      store.currentAnimationIndex = 0
      store.currentFrameIndex = store.animations[0].frames.length > 0 ? 0 : -1
    }
    // Drop any group members that don't match the freshly-loaded layout.
    for (const a of store.animations) a.pruneInvalidMembers(null, project)
  }

  const downloadJson = (obj, filename) => {
    const json = JSON.stringify(obj, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const saveProject = () => {
    const out = {
      version: 2,
      kind: 'led-project',
      project: serializeProject(),
    }
    if (hasAnimationData()) {
      out.animations = serializeAnimations()
      // Only embed effects when there are also animations to anchor them to.
      if (typeof window.hasEffects === 'function' && window.hasEffects() &&
          typeof window.serializeEffects === 'function') {
        const eff = window.serializeEffects()
        if (Array.isArray(eff) && eff.length > 0) out.effects = eff
      }
    }

    let filename = 'led_layout.json'
    if (out.effects) filename = 'led_project.json'
    else if (out.animations) filename = 'led_project.json'
    downloadJson(out, filename)
  }

  const loadProjectFromEvent = (event) => {
    const file = event && event.target && event.target.files && event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data && data.kind === 'led-project') {
          deserializeProject(data.project || {})
          if (data.animations) {
            deserializeAnimations(data.animations)
          } else {
            // Layout-only file: clear any stale animation data so groups don't
            // dangle on top of a brand-new layout.
            deserializeAnimations([])
          }
          // Effects are restored only after animations are in place (effects
          // reference animations by id). If the file has no effects, clear any
          // effects currently in memory so the editor matches the file.
          if (typeof window.deserializeEffects === 'function') {
            window.deserializeEffects(data.effects || [])
          }
          ctrl.clearSelection()
          store.emit('animation-list-changed')
          store.emit('animation-changed')
          store.emit('frame-changed')
          store.emit('groups-changed')
          renderAnimationList()
          renderGroupList()
          renderFrameThumbnails()
        } else if (typeof window.loadLedsFromJson === 'function') {
          // Fallback for old single-strip files.
          window.loadLedsFromJson(data)
        } else {
          console.warn('Unrecognized project file')
        }
      } catch (err) {
        console.error('Failed to load project:', err)
      }
      // Clear the input so re-selecting the same file still triggers change.
      if (event && event.target) event.target.value = ''
    }
    reader.readAsText(file)
  }

  // The file menus in both the layout tab and the animation tab call these
  // names via inline onclick/onchange handlers. Override the legacy
  // implementations so they save/load the new project model from any tab.
  window.saveLedsConfig = saveProject
  window.loadLedsConfig = loadProjectFromEvent

  // The legacy animation sidebar buttons (Save/Load animation) now do the
  // same thing as the file menu, for consistency.
  window.saveAnimationToFile = saveProject
  window.loadAnimationFromFile = loadProjectFromEvent

  // Not yet ported.
  window.exportAnimation = () => console.warn('exportAnimation: not implemented')

  // Initial render (in case user starts on the animation tab via deep-link).
  renderAnimationList()
  renderGroupList()
  renderFrameThumbnails()
})
