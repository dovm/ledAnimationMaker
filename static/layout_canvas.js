
class CanvasApp {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")
    this.objects = []
    this.pointer = { x: 0, y: 0, isDown: false }
    this.lastTime = 0

    this.resize()
    addEventListener("resize", () => this.resize())
    this.bindInput()
  }

  resize() {
    const parent = this.canvas.parentElement
    const w = parent ? parent.clientWidth : innerWidth
    const h = parent ? parent.clientHeight : innerHeight
    if (w > 0 && h > 0) {
      this.canvas.width = w
      this.canvas.height = h
    }
    for (const obj of this.objects) {
      if (obj.onResize) obj.onResize(this.canvas.width, this.canvas.height)
    }
  }

  add(obj) {
    this.objects.push(obj)
    if (obj.onAdd) obj.onAdd(this)
    return obj
  }

  remove(obj) {
    this.objects = this.objects.filter(o => o !== obj)
    if (obj.onRemove) obj.onRemove(this)
    return obj
  }

  updatePointerFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = e.clientX - rect.left
    this.pointer.y = e.clientY - rect.top
  }

  bindInput() {
    this.canvas.onmousedown = e => {
      this.pointer.isDown = true
      this.updatePointerFromEvent(e)
      for (const obj of this.objects) {
        if (obj.onPointerDown) obj.onPointerDown(this.pointer, e)
      }
    }

    this.canvas.onmousemove = e => {
      this.updatePointerFromEvent(e)
      for (const obj of this.objects) {
        if (obj.onPointerMove) obj.onPointerMove(this.pointer, e)
      }
    }

    this.canvas.onmouseup = e => {
      this.pointer.isDown = false
      for (const obj of this.objects) {
        if (obj.onPointerUp) obj.onPointerUp(this.pointer, e)
      }
    }

    this.canvas.onmouseleave = e => {
      this.pointer.isDown = false
      for (const obj of this.objects) {
        if (obj.onPointerUp) obj.onPointerUp(this.pointer, e)
      }
    }

    this.canvas.oncontextmenu = e => {
      e.preventDefault()
      this.updatePointerFromEvent(e)
      for (const obj of this.objects) {
        if (obj.onContextMenu) obj.onContextMenu(this.pointer, e)
      }
    }
  }

  frame = (time = 0) => {
    const dt = (time - this.lastTime) / 1000
    this.lastTime = time

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    for (const obj of this.objects) {
      if (obj.update && !obj.paused) obj.update(dt)
      if (obj.draw) obj.draw(this.ctx)
    }

    requestAnimationFrame(this.frame)
  }

  start() {
    requestAnimationFrame(this.frame)
  }

}

class Point {
  constructor(x, y) {
    this.x = x
    this.y = y
  }
}

// Shared 2D viewport: pan offset (tx, ty) in screen pixels and a uniform scale.
// Used by ProjectCanvasController (layout tab) and AnimationCanvasController
// (animation tab) to support wheel-zoom around the cursor and middle-mouse pan.
class Viewport {
  constructor() {
    this.tx = 0
    this.ty = 0
    this.scale = 1
    this.minScale = 0.1
    this.maxScale = 8
  }

  screenToWorld(sx, sy) {
    return { x: (sx - this.tx) / this.scale, y: (sy - this.ty) / this.scale }
  }

  worldToScreen(wx, wy) {
    return { x: wx * this.scale + this.tx, y: wy * this.scale + this.ty }
  }

  applyToCtx(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.tx, this.ty)
  }

  zoomAt(sx, sy, factor) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor))
    if (newScale === this.scale) return
    const ratio = newScale / this.scale
    this.tx = sx - (sx - this.tx) * ratio
    this.ty = sy - (sy - this.ty) * ratio
    this.scale = newScale
  }

  panBy(dx, dy) {
    this.tx += dx
    this.ty += dy
  }

  reset() {
    this.tx = 0
    this.ty = 0
    this.scale = 1
  }
}

class StripPoint {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.fixed = false
    this.fx = x
    this.fy = y
  }
}

class LedStripObject {
  static _nextId = 1

  constructor(length, ledsPerMeter) {
    this.id = LedStripObject._nextId++
    this.length = Math.max(0.1, Number(length) || 1)
    this.ledsPerMeter = Math.max(1, Number(ledsPerMeter) || 30)
    this.ledCount = Math.max(2, Math.round(this.length * this.ledsPerMeter))
    this.ledSpacingPx = LedStripObject.PIXELS_PER_METER / this.ledsPerMeter
    this.iterations = 120
    this.pickRadius = 18
    this.points = []
    this.grabbed = null
    this.anchorPointIndex = 0
    this.next = null
    this.prev = null
    this.paused = false
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  setNext(next) {
    this.next = next
    next.prev = this
  }

  setPrev(prev) {
    this.prev = prev
    prev.next = this
  }

  removeSelf(){
    if(this.next) {
      this.next.setPrev(this.prev)
    }
    if(this.prev) {
      this.prev.setNext(this.next)
    }
  }

  static PIXELS_PER_METER = 800

  onAdd(app) {
    this.app = app
    //this.reset(app.canvas.width, app.canvas.height)
  }

  distanceBetweenPoints(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y)
  }

  setPointsFromPath(path) {
    this.points.length = 0
    const rdp = new RDPPath()
    const newPath = rdp.simplifyDouglasPeucker(path, 0.1)
    
    for (let i = 0; i < newPath.length - 1; i++) {
      let x = newPath[i].x
      let y = newPath[i].y
      this.points.push(new StripPoint(x, y))
      while(this.distanceBetweenPoints({x, y}, newPath[i+1]) > this.ledSpacingPx) {
        const angle = Math.atan2(newPath[i+1].y - newPath[i].y, newPath[i+1].x - newPath[i].x)
        x = x + this.ledSpacingPx * Math.cos(angle)
        y = y + this.ledSpacingPx * Math.sin(angle)
        this.points.push(new StripPoint(x, y))
      }
    }
    this.points.push(new StripPoint(newPath[newPath.length - 1].x, newPath[newPath.length - 1].y))
    this.grabbed = null
    this.anchorPointIndex = 0
  }

  onResize(width, height) {
    if (this.points.length === 0) {
      this.reset(width, height)
      return
    }

    // Keep strip centered when canvas size changes.
    const minX = this.points[0].x
    const maxX = this.points[this.points.length - 1].x
    const centerX = (minX + maxX) * 0.5
    const centerY = this.points.reduce((sum, p) => sum + p.y, 0) / this.points.length
    const dx = width * 0.5 - centerX
    const dy = height * 0.5 - centerY

    for (const p of this.points) {
      p.x += dx
      p.y += dy
      if (p.fixed) {
        p.fx += dx
        p.fy += dy
      }
    }
  }

  reset(width, height) {
    this.points.length = 0
    const stripLengthPx = (this.ledCount - 1) * this.ledSpacingPx
    const startX = width / 2 
    const startY = height / 2
    for (let i = 0; i < this.ledCount; i++) {
      this.points.push(new StripPoint(startX + i * this.ledSpacingPx, startY))
    }
  }

  onPointerDown(pointer) {
    this.grabbed = this.findPoint(pointer.x, pointer.y, this.pickRadius)
    if(this.grabbed) {
      this.anchorPointIndex = this.points.indexOf(this.grabbed)
    }
  }

  onPointerUp() {
    if(!this.grabbed) return
    this.grabbed = null
  }

  onContextMenu(pointer) {
    const point = this.findPoint(pointer.x, pointer.y, this.pickRadius)
    if (!point) return

    point.fixed = !point.fixed
    if (point.fixed) {
      point.fx = point.x
      point.fy = point.y
    }
  }

  update() {
    if (this.grabbed) {
      this.grabbed.x = this.app.pointer.x
      this.grabbed.y = this.app.pointer.y
    }

    for (let i = 0; i < this.iterations; i++) {
      if (this.grabbed) {
      this.grabbed.x = this.app.pointer.x
      this.grabbed.y = this.app.pointer.y
      }
      this.solveConstraints()
    }
  }

  solveConstraintForPoint(a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return

    const nx = (dx / dist).toFixed(2)
    const ny = (dy / dist).toFixed(2)

    if (!a.fixed && !b.fixed) {
        const cx = (dx - nx * this.ledSpacingPx) * 0.9
        const cy = (dy - ny * this.ledSpacingPx) * 0.9
        a.x += cx
        a.y += cy
        b.x -= cx
        b.y -= cy
      } else if (a.fixed && !b.fixed) {
        b.x = a.x + nx * this.ledSpacingPx
        b.y = a.y + ny * this.ledSpacingPx
      } else if (!a.fixed && b.fixed) {
          a.x = b.x - nx * this.ledSpacingPx
          a.y = b.y - ny * this.ledSpacingPx
      }
  }

  solveConstraints() {
    for (let i = this.anchorPointIndex; i >= 1; i--) {
      const a = this.points[i]
      const b = this.points[i - 1]

      this.solveConstraintForPoint(a, b)
    }
    for (let i = this.anchorPointIndex; i < this.points.length - 1; i++) {
      const a = this.points[i]
      const b = this.points[i + 1]
      this.solveConstraintForPoint(a, b)
    }
    
    for (const p of this.points) {
      if (p.fixed ) {
        p.x = p.fx
        p.y = p.fy
      }
    }
  }

  draw(ctx) {
    if (this.points.length === 0) return

    // Draw strip base.
    ctx.strokeStyle = "#6a6a74"
    ctx.lineWidth = 1
    ctx.lineCap = "round"

    ctx.beginPath()
    ctx.moveTo(this.points[0].x, this.points[0].y)
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y)
    }
    ctx.stroke()

    // Draw LEDs.
    for (const p of this.points) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = p.fixed ? "#00ff99" : "#ffd550"
        ctx.fill()
    }
  }

  findPoint(x, y, radius) {
    let best = null
    let min = radius
    for (const p of this.points) {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < min) {
        min = d
        best = p
      }
    }
    return best
  }
}

class CableObject {
  constructor(points) {
    this.points = points
    this.next = null
    this.prev = null
  }

  setNext(next) {
    this.next = next
    next.prev = this
  }

  setPrev(prev) {
    this.prev = prev
    prev.next = this
  }

  removeSelf(){
    if(this.next) {
      this.next.setPrev(this.prev)
    }
    if(this.prev) {
      this.prev.setNext(this.next)
    }
  }
  
  onAdd(app) {
    this.app = app
  }

  draw(ctx) {
      if (this.points.length === 0) return
      ctx.strokeStyle = "#6a6a74"
      ctx.lineWidth = 1
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(this.points[0].x, this.points[0].y)
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y)
      }
      ctx.stroke()
  }
}

class RDPPath {
  // Function to simplify a polyline using the Ramer-Douglas-Peucker algorithm
  simplifyDouglasPeucker(points, tolerance) {
    if (points.length <= 2) {
        return points; // Cannot simplify a line with 2 or fewer points
    }

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;
    const startPoint = points[0];
    const endPoint = points[end];

    // Find the point with the maximum distance from the line segment (start, end)
    for (let i = 1; i < end; i++) {
        const distance = this.perpendicularDistance(points[i], startPoint, endPoint);
        if (distance > dmax) {
            index = i;
            dmax = distance;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (dmax > tolerance) {
        // Recursive call
        const firstSegment = points.slice(0, index + 1);
        const secondSegment = points.slice(index);
        const simplifiedFirst = this.simplifyDouglasPeucker(firstSegment, tolerance);
        const simplifiedSecond = this.simplifyDouglasPeucker(secondSegment, tolerance);

        // Combine the results (remove the duplicate point at the junction)
        return simplifiedFirst.slice(0, simplifiedFirst.length - 1).concat(simplifiedSecond);
    } else {
        // If the max distance is less than the tolerance, discard all intermediate points
        return [startPoint, endPoint];
    }
}

// Helper function to calculate the perpendicular distance from a point to a line segment
  perpendicularDistance(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const magSquared = dx * dx + dy * dy;
    let dist;

    if (magSquared > 0) {
        const u = ((point.x - start.x) * dx + (point.y - start.y) * dy) / magSquared;
        if (u < 0) {
            dist = this.distanceBetween(point, start);
        } else if (u > 1) {
            dist = this.distanceBetween(point, end);
        } else {
            const intersectionX = start.x + u * dx;
            const intersectionY = start.y + u * dy;
            dist = this.distanceBetween(point, new StripPoint(intersectionX, intersectionY));
        }
    } else {
        dist = this.distanceBetween(point, start);
    }
    return dist;
}

// Helper function to calculate distance between two points
  distanceBetween(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

class drawPath {
  constructor(callback) {
    this.callback = callback
    this.path = []
    this.drawing = false
  }
  onAdd(app) {
    this.app = app
  }

  onPointerDown(pointer) {
    this.path.push(new StripPoint(pointer.x, pointer.y))
    this.drawing = true;
  }

  onPointerUp(pointer) {
    this.path.push(new StripPoint(pointer.x, pointer.y))
    this.drawing = false;
  }

  onPointerMove(pointer) {
    if(this.drawing) {
      this.path.push(new StripPoint(pointer.x, pointer.y))
    }
  }

  onContextMenu(pointer) {
    this.callback(this.path)
    this.path.length = 0
    this.drawing = false;
  }

  draw(ctx) {
    if (this.path.length === 0) return
    ctx.strokeStyle = "#6a6a74"
    ctx.lineWidth = 1
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(this.path[0].x, this.path[0].y)
    for (let i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y)
    }
    ctx.stroke()
  }
}

