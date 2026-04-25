// Project model and layout-tab controllers.
//
// LedProject holds a collection of LedStripObject instances.
// ProjectCanvasController renders the project on the main layout canvas
// and lets the user grab/translate strips and double-click to edit them.
// StripEditController drives the strip-edit modal (uses CanvasApp from
// layout_canvas.js to provide the rope-physics shape editor).

class WireConnection {
  // Connects the LAST point of `fromStrip` to the FIRST point of `toStrip`.
  // `length` is a user-editable number (cable length between the two strips).
  constructor(fromStrip, toStrip, length = 0) {
    this.from = fromStrip
    this.to = toStrip
    this.length = Number.isFinite(Number(length)) ? Math.max(0, Number(length)) : 0
  }

  setLength(length) {
    const n = Number(length)
    this.length = Number.isFinite(n) ? Math.max(0, n) : 0
  }

  getStartPoint() {
    const pts = this.from.points
    return pts[pts.length - 1]
  }

  getEndPoint() {
    return this.to.points[0]
  }

  involves(strip) {
    return this.from === strip || this.to === strip
  }
}

class LedProject {
  constructor() {
    this.strips = []
    this.wires = []
    this._listeners = []
  }

  on(event, handler) {
    this._listeners.push({ event, handler })
    return () => this.off(event, handler)
  }

  off(event, handler) {
    this._listeners = this._listeners.filter(l => !(l.event === event && l.handler === handler))
  }

  emit(event, ...args) {
    for (const l of this._listeners) {
      if (l.event === event) {
        try { l.handler(...args) } catch (e) { console.error(e) }
      }
    }
  }

  addStrip(strip) {
    this.strips.push(strip)
    this.emit('strip-added', strip)
    return strip
  }

  removeStrip(strip) {
    this.strips = this.strips.filter(s => s !== strip)
    this.wires = this.wires.filter(w => !w.involves(strip))
    this.emit('strip-removed', strip)
  }

  notifyStripChanged(strip) {
    this.emit('strip-changed', strip)
  }

  addWire(wire) {
    if (wire.from === wire.to) return null
    const exists = this.wires.find(w => w.from === wire.from && w.to === wire.to)
    if (exists) return exists
    this.wires.push(wire)
    this.emit('wire-added', wire)
    return wire
  }

  removeWire(wire) {
    this.wires = this.wires.filter(w => w !== wire)
    this.emit('wire-removed', wire)
  }

  getStrips() {
    return this.strips
  }

  getWires() {
    return this.wires
  }

  getStripById(id) {
    return this.strips.find(s => s.id === id) || null
  }

  // Walk strips in chain order (following wires). Strips with no incoming wire
  // are roots; wires define the next-strip relationship. Returns an array of
  // chains, where each chain is an ordered array of LedStripObject instances.
  getChains() {
    const incoming = new Map()
    const outgoing = new Map()
    for (const s of this.strips) { incoming.set(s, null); outgoing.set(s, null) }
    for (const w of this.wires) {
      if (!incoming.get(w.to)) incoming.set(w.to, w.from)
      if (!outgoing.get(w.from)) outgoing.set(w.from, w.to)
    }
    const chains = []
    const visited = new Set()
    for (const s of this.strips) {
      if (visited.has(s)) continue
      if (incoming.get(s)) continue
      const chain = []
      let cur = s
      while (cur && !visited.has(cur)) {
        chain.push(cur)
        visited.add(cur)
        cur = outgoing.get(cur)
      }
      chains.push(chain)
    }
    // Add any remaining strips that are part of cycles.
    for (const s of this.strips) {
      if (!visited.has(s)) {
        const chain = []
        let cur = s
        while (cur && !visited.has(cur)) {
          chain.push(cur)
          visited.add(cur)
          cur = outgoing.get(cur)
        }
        chains.push(chain)
      }
    }
    return chains
  }
}

class ProjectCanvasController {
  constructor(canvas, project) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.project = project

    this.selectedStrip = null
    this.selectedWire = null
    this.draggingStrip = null
    this.dragLast = { x: 0, y: 0 }
    this.dragMoved = false
    this.hoverStrip = null
    this.hoverWire = null
    this.cursorPos = { x: 0, y: 0 }

    // Connect mode: 'idle' | 'pick-first' | 'pick-second'
    this.connectMode = 'idle'
    this.connectFirst = null

    this.onDoubleClickStrip = null
    this.onDoubleClickWire = null
    this.onSelectionChange = null
    this.onConnectModeChange = null

    this.hitRadius = 12
    this.wireHitRadius = 8

    this.viewport = new Viewport()
    this.panning = false
    this.panLastScreen = { x: 0, y: 0 }
    this.spaceDown = false

    this.resize()
    addEventListener('resize', () => this.resize())
    this.bindInput()
    this.start()
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

  setSelected(strip) {
    if (this.selectedStrip === strip && this.selectedWire === null) return
    this.selectedStrip = strip
    this.selectedWire = null
    if (this.onSelectionChange) this.onSelectionChange()
  }

  setSelectedWire(wire) {
    if (this.selectedWire === wire && this.selectedStrip === null) return
    this.selectedWire = wire
    this.selectedStrip = null
    if (this.onSelectionChange) this.onSelectionChange()
  }

  clearSelection() {
    if (this.selectedStrip === null && this.selectedWire === null) return
    this.selectedStrip = null
    this.selectedWire = null
    if (this.onSelectionChange) this.onSelectionChange()
  }

  hasSelection() {
    return !!(this.selectedStrip || this.selectedWire)
  }

  setConnectMode(mode) {
    this.connectMode = mode
    if (mode === 'idle') this.connectFirst = null
    if (this.onConnectModeChange) this.onConnectModeChange(mode)
    this.canvas.style.cursor = mode === 'idle' ? 'default' : 'crosshair'
  }

  startConnect() {
    this.clearSelection()
    this.setConnectMode('pick-first')
  }

  cancelConnect() {
    this.setConnectMode('idle')
  }

  deleteSelected() {
    if (this.selectedStrip) {
      this.project.removeStrip(this.selectedStrip)
      this.clearSelection()
    } else if (this.selectedWire) {
      this.project.removeWire(this.selectedWire)
      this.clearSelection()
    }
  }

  rotateSelected(angleDeg) {
    if (!this.selectedStrip) return
    const angle = angleDeg * Math.PI / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const pts = this.selectedStrip.points
    let cx = 0, cy = 0
    for (const p of pts) { cx += p.x; cy += p.y }
    cx /= pts.length
    cy /= pts.length
    for (const p of pts) {
      const dx = p.x - cx, dy = p.y - cy
      p.x = cx + dx * cos - dy * sin
      p.y = cy + dx * sin + dy * cos
      if (p.fixed) {
        const fdx = p.fx - cx, fdy = p.fy - cy
        p.fx = cx + fdx * cos - fdy * sin
        p.fy = cy + fdx * sin + fdy * cos
      }
    }
  }

  _shouldPan(e) {
    return e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)
  }

  bindInput() {
    this.canvas.onmousedown = e => {
      if (this._shouldPan(e)) {
        e.preventDefault()
        this.panning = true
        this.panLastScreen = this.pointerScreen(e)
        this.canvas.style.cursor = 'grabbing'
        return
      }
      const p = this.pointerPos(e)
      this.cursorPos = p
      const s = this.findStripAt(p.x, p.y)

      if (this.connectMode !== 'idle') {
        if (!s) return
        if (this.connectMode === 'pick-first') {
          this.connectFirst = s
          this.setConnectMode('pick-second')
        } else if (this.connectMode === 'pick-second') {
          if (s !== this.connectFirst) {
            this.project.addWire(new WireConnection(this.connectFirst, s))
          }
          this.setConnectMode('idle')
        }
        return
      }

      if (s) {
        this.setSelected(s)
        this.draggingStrip = s
        this.dragLast = p
        this.dragMoved = false
        return
      }

      const w = this.findWireAt(p.x, p.y)
      if (w) {
        this.setSelectedWire(w)
      } else {
        this.clearSelection()
      }
    }

    this.canvas.onmousemove = e => {
      if (this.panning) {
        const cur = this.pointerScreen(e)
        const dx = cur.x - this.panLastScreen.x
        const dy = cur.y - this.panLastScreen.y
        this.viewport.panBy(dx, dy)
        this.panLastScreen = cur
        return
      }
      const p = this.pointerPos(e)
      this.cursorPos = p
      if (this.draggingStrip) {
        const dx = p.x - this.dragLast.x
        const dy = p.y - this.dragLast.y
        if (dx !== 0 || dy !== 0) this.dragMoved = true
        for (const pt of this.draggingStrip.points) {
          pt.x += dx
          pt.y += dy
          if (pt.fixed) {
            pt.fx += dx
            pt.fy += dy
          }
        }
        this.dragLast = p
      } else if (this.connectMode === 'idle') {
        this.hoverStrip = this.findStripAt(p.x, p.y)
        this.hoverWire = this.hoverStrip ? null : this.findWireAt(p.x, p.y)
        if (this.spaceDown) this.canvas.style.cursor = 'grab'
        else if (this.hoverStrip) this.canvas.style.cursor = 'grab'
        else if (this.hoverWire) this.canvas.style.cursor = 'pointer'
        else this.canvas.style.cursor = 'default'
      } else {
        this.hoverStrip = this.findStripAt(p.x, p.y)
        this.hoverWire = null
      }
    }

    this.canvas.onmouseup = () => {
      if (this.panning) {
        this.panning = false
        this.canvas.style.cursor = this.spaceDown ? 'grab' : 'default'
        return
      }
      this.draggingStrip = null
    }

    this.canvas.onmouseleave = () => {
      this.panning = false
      this.draggingStrip = null
      this.hoverStrip = null
      this.hoverWire = null
      if (this.connectMode === 'idle') this.canvas.style.cursor = 'default'
    }

    this.canvas.oncontextmenu = e => {
      // Suppress context menu so right-drag can pan.
      e.preventDefault()
    }

    this.canvas.ondblclick = e => {
      if (this.connectMode !== 'idle') return
      const p = this.pointerPos(e)
      const s = this.findStripAt(p.x, p.y)
      if (s) {
        if (this.onDoubleClickStrip) this.onDoubleClickStrip(s)
        return
      }
      const w = this.findWireAt(p.x, p.y)
      if (w && this.onDoubleClickWire) this.onDoubleClickWire(w)
    }

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault()
      const s = this.pointerScreen(e)
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      this.viewport.zoomAt(s.x, s.y, factor)
    }, { passive: false })

    addEventListener('keydown', e => {
      if (e.code === 'Space' && !this._isInputTarget(e.target)) {
        if (!this.spaceDown) {
          this.spaceDown = true
          if (!this.panning) this.canvas.style.cursor = 'grab'
        }
        e.preventDefault()
      }
    })
    addEventListener('keyup', e => {
      if (e.code === 'Space') {
        this.spaceDown = false
        if (!this.panning) this.canvas.style.cursor = 'default'
      }
    })
  }

  _isInputTarget(el) {
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  findStripAt(x, y) {
    const r = this.hitRadius / this.viewport.scale
    for (let i = this.project.strips.length - 1; i >= 0; i--) {
      const s = this.project.strips[i]
      if (this.hitTestStrip(s, x, y, r)) return s
    }
    return null
  }

  findWireAt(x, y) {
    const r = this.wireHitRadius / this.viewport.scale
    for (let i = this.project.wires.length - 1; i >= 0; i--) {
      const w = this.project.wires[i]
      const a = w.getStartPoint()
      const b = w.getEndPoint()
      if (!a || !b) continue
      if (this.distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= r) return w
    }
    return null
  }

  distanceToSegment(x, y, ax, ay, bx, by) {
    const dx = bx - ax
    const dy = by - ay
    const lsq = dx * dx + dy * dy
    if (lsq === 0) return Math.hypot(ax - x, ay - y)
    let t = ((x - ax) * dx + (y - ay) * dy) / lsq
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * dx
    const py = ay + t * dy
    return Math.hypot(px - x, py - y)
  }

  hitTestStrip(strip, x, y, radius) {
    for (const p of strip.points) {
      if (Math.hypot(p.x - x, p.y - y) <= radius) return true
    }
    for (let i = 0; i < strip.points.length - 1; i++) {
      const a = strip.points[i]
      const b = strip.points[i + 1]
      if (this.distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= radius) return true
    }
    return false
  }

  drawStrip(strip) {
    const ctx = this.ctx
    if (strip.points.length === 0) return

    const isSelected = strip === this.selectedStrip
    const isHovered = strip === this.hoverStrip
    const isConnectFirst = strip === this.connectFirst
    const k = 1 / this.viewport.scale // keep visual sizes constant in screen px

    let stroke = '#6a6a74'
    let width = 1
    if (isSelected) { stroke = '#5cdcff'; width = 2 }
    else if (isConnectFirst) { stroke = '#ffae42'; width = 2 }
    else if (isHovered) { stroke = '#9aa1ff'; width = 2 }

    ctx.strokeStyle = stroke
    ctx.lineWidth = width * k
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(strip.points[0].x, strip.points[0].y)
    for (let i = 1; i < strip.points.length; i++) {
      ctx.lineTo(strip.points[i].x, strip.points[i].y)
    }
    ctx.stroke()

    for (const p of strip.points) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5 * k, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd550'
      ctx.fill()
    }

    if (isSelected || isConnectFirst) {
      // Mark endpoints so the user can see in/out direction.
      const start = strip.points[0]
      const end = strip.points[strip.points.length - 1]
      ctx.fillStyle = '#5cff8a'
      ctx.beginPath(); ctx.arc(start.x, start.y, 4 * k, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ff5c8a'
      ctx.beginPath(); ctx.arc(end.x, end.y, 4 * k, 0, Math.PI * 2); ctx.fill()
    }
  }

  drawWire(wire) {
    const ctx = this.ctx
    const a = wire.getStartPoint()
    const b = wire.getEndPoint()
    if (!a || !b) return

    const isSelected = wire === this.selectedWire
    const isHovered = wire === this.hoverWire
    const k = 1 / this.viewport.scale

    let stroke = '#7c8cff'
    let width = 1.5
    if (isSelected) { stroke = '#ff5c8a'; width = 2.5 }
    else if (isHovered) { stroke = '#bcb6ff'; width = 2 }

    ctx.strokeStyle = stroke
    ctx.lineWidth = width * k
    ctx.setLineDash([4 * k, 3 * k])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.setLineDash([])

    if (isSelected) {
      ctx.fillStyle = stroke
      ctx.beginPath(); ctx.arc(a.x, a.y, 4 * k, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(b.x, b.y, 4 * k, 0, Math.PI * 2); ctx.fill()
    }
  }

  drawWireLabel(wire) {
    const a = wire.getStartPoint()
    const b = wire.getEndPoint()
    if (!a || !b) return
    const k = 1 / this.viewport.scale
    let accent = '#7c8cff'
    if (wire === this.selectedWire) accent = '#ff5c8a'
    else if (wire === this.hoverWire) accent = '#bcb6ff'
    this.drawWireLength(wire, a, b, accent, k)
  }

  drawWireLength(wire, a, b, accent, k) {
    const ctx = this.ctx
    const mx = (a.x + b.x) * 0.5
    const my = (a.y + b.y) * 0.5
    const text = `${wire.length || 0} cm`
    const fontPx = 12 * k
    ctx.font = `${fontPx}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const tw = ctx.measureText(text).width
    const padX = 5 * k
    const padY = 3 * k
    const boxW = tw + 2 * padX
    const boxH = fontPx + 2 * padY
    const bx = mx - boxW * 0.5
    const by = my - boxH * 0.5

    ctx.fillStyle = 'rgba(20,22,32,0.85)'
    ctx.fillRect(bx, by, boxW, boxH)
    ctx.strokeStyle = accent
    ctx.lineWidth = 1 * k
    ctx.strokeRect(bx, by, boxW, boxH)
    ctx.fillStyle = '#e3e6ff'
    ctx.fillText(text, mx, my)
  }

  drawPendingWire() {
    if (this.connectMode !== 'pick-second' || !this.connectFirst) return
    const ctx = this.ctx
    const a = this.connectFirst.points[this.connectFirst.points.length - 1]
    if (!a) return
    const k = 1 / this.viewport.scale
    ctx.strokeStyle = '#ffae42'
    ctx.lineWidth = 1.5 * k
    ctx.setLineDash([4 * k, 3 * k])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(this.cursorPos.x, this.cursorPos.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  draw = () => {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.viewport.applyToCtx(ctx)
    for (const w of this.project.wires) {
      this.drawWire(w)
    }
    for (const s of this.project.strips) {
      this.drawStrip(s)
    }
    // Wire labels on top of everything so they stay legible.
    for (const w of this.project.wires) {
      this.drawWireLabel(w)
    }
    this.drawPendingWire()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    requestAnimationFrame(this.draw)
  }

  start() {
    requestAnimationFrame(this.draw)
  }
}

class StripEditController {
  constructor(canvas) {
    this.canvas = canvas
    this.app = null
    this.editingStrip = null
    this.isNew = false
    this.snapshot = null
    this.originalCentroid = null
  }

  ensureApp() {
    if (!this.app) {
      this.app = new CanvasApp(this.canvas)
      this.app.start()
    } else {
      this.app.objects = []
      this.app.resize()
    }
  }

  centroid(points) {
    if (points.length === 0) return { x: 0, y: 0 }
    let sx = 0, sy = 0
    for (const p of points) {
      sx += p.x
      sy += p.y
    }
    return { x: sx / points.length, y: sy / points.length }
  }

  translatePoints(points, dx, dy) {
    for (const p of points) {
      p.x += dx
      p.y += dy
      if (p.fixed) {
        p.fx += dx
        p.fy += dy
      }
    }
  }

  openCreate(length, ledsPerMeter) {
    this.ensureApp()
    this.isNew = true
    const strip = new LedStripObject(length, ledsPerMeter)
    strip.reset(this.canvas.width, this.canvas.height)
    this.editingStrip = strip
    this.snapshot = null
    this.originalCentroid = null
    this.app.objects = []
    this.app.add(strip)
  }

  openEdit(strip) {
    this.ensureApp()
    this.isNew = false
    this.editingStrip = strip
    // Snapshot points so Cancel can revert.
    this.snapshot = strip.points.map(p => ({
      x: p.x, y: p.y, fixed: p.fixed, fx: p.fx, fy: p.fy
    }))
    this.originalCentroid = this.centroid(strip.points)
    // Re-center the strip in the modal canvas while editing.
    const targetCx = this.canvas.width / 2
    const targetCy = this.canvas.height / 2
    this.translatePoints(strip.points, targetCx - this.originalCentroid.x, targetCy - this.originalCentroid.y)
    strip.grabbed = null
    this.app.objects = []
    this.app.add(strip)
  }

  save() {
    if (!this.editingStrip) return null
    this.editingStrip.grabbed = null
    if (!this.isNew && this.originalCentroid) {
      // Translate strip back so its centroid stays where it was.
      const cur = this.centroid(this.editingStrip.points)
      this.translatePoints(this.editingStrip.points, this.originalCentroid.x - cur.x, this.originalCentroid.y - cur.y)
    }
    return this.editingStrip
  }

  cancel() {
    if (!this.editingStrip) return
    this.editingStrip.grabbed = null
    if (!this.isNew && this.snapshot) {
      this.editingStrip.points = this.snapshot.map(s => {
        const p = new StripPoint(s.x, s.y)
        p.fixed = s.fixed
        p.fx = s.fx
        p.fy = s.fy
        return p
      })
      // Translate restored snapshot back to original centroid (already there
      // since snapshot was taken before centering).
    }
  }

  resize() {
    if (this.app) this.app.resize()
  }

  pause() {
    if (this.editingStrip) this.editingStrip.paused = true
  }

  resume() {
    if (this.editingStrip) this.editingStrip.paused = false
  }
}

window.addEventListener('load', () => {
  const projCanvas = document.getElementById('ledCanvasLayoutProject')
  const editCanvas = document.getElementById('ledCanvasStripEdit')
  const modalEl = document.getElementById('led-strip-edit-modal')
  if (!projCanvas || !editCanvas || !modalEl) return

  const project = new LedProject()
  window.ledProject = project

  const projectCtrl = new ProjectCanvasController(projCanvas, project)
  const editCtrl = new StripEditController(editCanvas)
  const modal = new bootstrap.Modal(modalEl)

  let pendingOpen = null

  modalEl.addEventListener('shown.bs.modal', () => {
    editCtrl.resize()
    if (pendingOpen) {
      pendingOpen()
      pendingOpen = null
    }
    editCtrl.resume()
  })

  modalEl.addEventListener('hidden.bs.modal', () => {
    editCtrl.pause()
    if (editCtrl.app) editCtrl.app.objects = []
  })

  const openCreateModal = () => {
    pendingOpen = () => {
      const lenEl = document.getElementById('strip-edit-length')
      const densEl = document.getElementById('strip-edit-density')
      const len = parseFloat(lenEl?.value) || 1
      const dens = parseFloat(densEl?.value) || 60
      editCtrl.openCreate(len, dens)
    }
    modal.show()
  }

  const openEditModal = (strip) => {
    pendingOpen = () => {
      const lenEl = document.getElementById('strip-edit-length')
      const densEl = document.getElementById('strip-edit-density')
      if (lenEl) lenEl.value = strip.length
      if (densEl) densEl.value = strip.ledsPerMeter
      editCtrl.openEdit(strip)
    }
    modal.show()
  }

  projectCtrl.onDoubleClickStrip = openEditModal

  // -- Wire edit modal --

  const wireModalEl = document.getElementById('wire-edit-modal')
  const wireLengthInput = document.getElementById('wire-edit-length')
  const wireSaveBtn = document.getElementById('wire-edit-save')
  let wireBeingEdited = null
  const wireModal = (wireModalEl && window.bootstrap)
    ? new bootstrap.Modal(wireModalEl)
    : null

  const openWireEditModal = (wire) => {
    if (!wireModal || !wireLengthInput) return
    wireBeingEdited = wire
    wireLengthInput.value = String(wire.length || 0)
    wireModal.show()
  }

  const commitWireEdit = () => {
    if (!wireBeingEdited || !wireLengthInput) return
    wireBeingEdited.setLength(wireLengthInput.value)
    wireBeingEdited = null
    if (wireModal) wireModal.hide()
  }

  if (wireSaveBtn) wireSaveBtn.addEventListener('click', commitWireEdit)
  if (wireLengthInput) wireLengthInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitWireEdit()
    }
  })
  if (wireModalEl) wireModalEl.addEventListener('shown.bs.modal', () => {
    if (wireLengthInput) {
      wireLengthInput.focus()
      wireLengthInput.select()
    }
  })

  projectCtrl.onDoubleClickWire = openWireEditModal

  // -- Layout toolbar wiring --

  const addBtn = document.getElementById('add-strip-btn')
  const deleteBtn = document.getElementById('delete-strip-btn')
  const rotateBtn = document.getElementById('rotate-strip-btn')
  const rotateAngleInput = document.getElementById('strip-rotate-angle')
  const connectBtn = document.getElementById('connect-strip-btn')

  const refreshSelectionUI = () => {
    const hasStrip = !!projectCtrl.selectedStrip
    const hasAny = projectCtrl.hasSelection()
    if (deleteBtn) deleteBtn.disabled = !hasAny
    if (rotateBtn) rotateBtn.disabled = !hasStrip
  }

  const refreshConnectUI = () => {
    if (!connectBtn) return
    const active = projectCtrl.connectMode !== 'idle'
    connectBtn.classList.toggle('active', active)
    connectBtn.title = active
      ? (projectCtrl.connectMode === 'pick-first'
          ? 'Click the source strip (Esc to cancel)'
          : 'Click the destination strip (Esc to cancel)')
      : 'Connect two strips with a wire'
  }

  projectCtrl.onSelectionChange = refreshSelectionUI
  projectCtrl.onConnectModeChange = refreshConnectUI
  refreshSelectionUI()
  refreshConnectUI()

  if (addBtn) addBtn.addEventListener('click', () => {
    projectCtrl.cancelConnect()
    openCreateModal()
  })

  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    projectCtrl.deleteSelected()
  })

  if (rotateBtn) rotateBtn.addEventListener('click', () => {
    const angle = parseFloat(rotateAngleInput?.value)
    projectCtrl.rotateSelected(Number.isFinite(angle) ? angle : 90)
  })

  if (connectBtn) connectBtn.addEventListener('click', () => {
    if (projectCtrl.connectMode === 'idle') projectCtrl.startConnect()
    else projectCtrl.cancelConnect()
  })

  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || ''
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    if (e.key === 'Escape' && projectCtrl.connectMode !== 'idle') {
      projectCtrl.cancelConnect()
      e.preventDefault()
      return
    }
    if (isInput) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && projectCtrl.hasSelection()) {
      projectCtrl.deleteSelected()
      e.preventDefault()
    }
  })

  // -- Modal save/cancel/delete --

  const saveBtn = document.getElementById('strip-edit-save')
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const strip = editCtrl.save()
    if (strip && editCtrl.isNew) {
      const c = editCtrl.centroid(strip.points)
      const dx = projCanvas.width / 2 - c.x
      const dy = projCanvas.height / 2 - c.y
      editCtrl.translatePoints(strip.points, dx, dy)
      project.addStrip(strip)
      projectCtrl.setSelected(strip)
    } else if (strip && !editCtrl.isNew) {
      project.notifyStripChanged(strip)
    }
    modal.hide()
  })

  const cancelBtn = document.getElementById('strip-edit-cancel')
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    editCtrl.cancel()
    modal.hide()
  })

  const modalDeleteBtn = document.getElementById('strip-edit-delete')
  if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', () => {
    const strip = editCtrl.editingStrip
    if (strip && !editCtrl.isNew) {
      project.removeStrip(strip)
      if (projectCtrl.selectedStrip === strip) projectCtrl.setSelected(null)
    }
    modal.hide()
  })
})
