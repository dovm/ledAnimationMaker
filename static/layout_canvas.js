
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
    this.canvas.width = innerWidth
    this.canvas.height = innerHeight
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

  bindInput() {
    this.canvas.onmousedown = e => {
      this.pointer.isDown = true
      this.pointer.x = e.clientX
      this.pointer.y = e.clientY
      for (const obj of this.objects) {
        if (obj.onPointerDown) obj.onPointerDown(this.pointer, e)
      }
    }

    this.canvas.onmousemove = e => {
      this.pointer.x = e.clientX
      this.pointer.y = e.clientY
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
      this.pointer.x = e.clientX
      this.pointer.y = e.clientY
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

class StripPoint {
  constructor(x, y) {
    this.p = new Point(x, y)
    this.fixed = false
    this.fp = new Point(x, y)
  }
}

class LedStripObject {
  constructor(length, ledsPerMeter) {
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
      ctx.strokeStyle = "#6a6a74"
      ctx.lineWidth = 1
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(this.points[0].p.x, this.points[0].p.y)
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].p.x, this.points[i].p.y)
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
    const dx = end.p.x - start.p.x;
    const dy = end.p.y - start.p.y;
    const magSquared = dx * dx + dy * dy;
    let dist;

    if (magSquared > 0) {
        const u = ((point.p.x - start.p.x) * dx + (point.p.y - start.p.y) * dy) / magSquared;
        if (u < 0) {
            dist = this.distanceBetween(point, start);
        } else if (u > 1) {
            dist = this.distanceBetween(point, end);
        } else {
            const intersectionX = start.p.x + u * dx;
            const intersectionY = start.p.y + u * dy;
            dist = this.distanceBetween(point, new StripPoint(intersectionX, intersectionY));
        }
    } else {
        dist = this.distanceBetween(point, start);
    }
    return dist;
}

// Helper function to calculate distance between two points
  distanceBetween(point1, point2) {
    const dx = point1.p.x - point2.p.x;
    const dy = point1.p.y - point2.p.y;
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
    this.path.push(new StripPoint(pointer.p.x, pointer.p.y))
    this.drawing = true;
  }

  onPointerUp(pointer) {
    this.path.push(new StripPoint(pointer.p.x, pointer.p.y))
    this.drawing = false;
  }

  onPointerMove(pointer) {
    if(this.drawing) {
      this.path.push(new StripPoint(pointer.p.x, pointer.p.y))
    }
  }

  onContextMenu(pointer) {
    this.callback(this.path)
    this.path.length = 0
    this.drawing = false;
  }

  draw(ctx) {
    for (const p of this.path) {
      ctx.strokeStyle = "#6a6a74"
      ctx.lineWidth = 1
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(this.path[0].p.x, this.path[0].p.y)
      for (let i = 1; i < this.path.length; i++) {
        ctx.lineTo(this.path[i].p.x, this.path[i].p.y)
      }
      ctx.stroke()
    }
  }
}

const app = new CanvasApp(document.getElementById("c"))
const dp = new drawPath(path => {
  const ledStrip = new LedStripObject(5, 120)
  ledStrip.setPointsFromPath(path)
  app.add(ledStrip)
  app.remove(dp)
}); 
const ledStrip = new LedStripObject(5, 120) 
ledStrip.reset(app.canvas.width, app.canvas.height)
app.add(ledStrip)
app.start()
