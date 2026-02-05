class editorTool{
    constructor(name, icon, description){
        this.name = name;
        this.icon = icon;
        this.description = description;
        this.mouseDownBound = this.mousedown.bind(this);
        this.mouseUpBound = this.mouseup.bind(this);
        this.mouseMoveBound = this.mousemove.bind(this);
        this.clickBound = this.click.bind(this);
        this.canvas = undefined
    }

    mousedown(event){
        return this;
    }

    mouseup(event){
        return this;
    }

    mousemove(event){
        return this;
    }

    click(event){
        return this;
    }

    activate(canvas){
        if(this.active)
            return;
        this.canvas = canvas;
        this.active = true;
        if(this.cursor_style)
            this.canvas.style.cursor = this.cursor_style;
        else
            this.canvas.style.cursor = "default";
        this.canvas.addEventListener("mousedown", this.mouseDownBound);
        this.canvas.addEventListener("mouseup", this.mouseUpBound);
        this.canvas.addEventListener("mousemove", this.mouseMoveBound);
        this.canvas.addEventListener("click", this.clickBound);
    }

    deactivate(){
        if(!this.active)
            return;
        this.active = false;
        this.canvas.style.cursor = "default";
        this.canvas.removeEventListener("mousedown", this.mouseDownBound);
        this.canvas.removeEventListener("mouseup", this.mouseUpBound);
        this.canvas.removeEventListener("mousemove", this.mouseMoveBound);
        this.canvas.removeEventListener("click", this.clickBound);
    }
}

class drawTool extends editorTool{
    constructor(ledStrip, layoutArea){
        super("draw", "fa-pencil", "Draw a new LED strip");
        this.last_point = {x: 0, y: 0};
        
        this.mode = "none";
        this.ledStrip = ledStrip;
        this.cursor_style = "copy";
        this.layoutArea = layoutArea;
    }

    mousedown(event){
        this.led_distance = 1/this.layoutArea.getLedPerMeter();
        const {x, y} = this.layoutArea.getRealPointFromEvent(event);
        this.last_point = {x, y};
        this.ledStrip.push({x,y})
        this.mode = "drawing";
        drawFrame();
    }
    
     mouseup(event){
        this.mode = "none";
    }
    
     calc_distance(x1, y1, x2, y2){
        return Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
    }
    
     mousemove(event){
        if(this.mode == "drawing"){
            const {x, y} =  this.layoutArea.getRealPointFromEvent(event);
            let distance = this.calc_distance(x, y, this.last_point.x, this.last_point.y);
            while(distance > this.led_distance){
                const angle = Math.atan2(y - this.last_point.y, x - this.last_point.x);
                const new_x = this.last_point.x + this.led_distance * Math.cos(angle);
                const new_y = this.last_point.y + this.led_distance * Math.sin(angle);
                this.ledStrip.push({x: new_x, y: new_y})
                this.last_point = {x: new_x, y: new_y};
                distance = this.calc_distance(x, y, this.last_point.x, this.last_point.y);
            }
            drawFrame();
        }
    }
}

class brushTool extends editorTool{
    constructor(ledStrip, animation){
        super("brush", "fa-paint-brush", "Paint a new LED strip");
        this.color = [255, 0, 0];
        this.painting = false;
        this.ledStrip = ledStrip;
        this.animation = animation;
    }

    mousedown(event) {
        this.painting = true;
    };

     originalBrushMousedown(event){  }
     mouseup(event){ this.painting = false; }
     mousemove(event){ 
        if (!this.painting) return;
        const {x, y} = fixPointScale(event);
        const {point, index } = this.ledStrip.get_led_at({x, y})
        if(index != -1){
            this.animation.getCurrentFrame().setColor(index, this.color);
        }
        drawFrame();
    }

     click(event){
        const {x, y} = fixPointScale(event);
        const {point, index } = ledStrip.get_led_at({x, y})
        if(index != -1){
            this.animation.getCurrentFrame().setColor(index, this.color);
        }
        drawFrame();
    }

    setColor(color){
        this.color = color;
    }
}

class selectTool extends editorTool{
    constructor(ledStrip, selectBox){
        super("select", "fa-object-group", "Select a new LED strip");
        this.ledStrip = ledStrip;
        this.selectedLeds = [];
        this.move_start = {x: 0, y: 0};
        this.moving = false;
        this.physicalBox = new Box(new Point(0,0), new Point(0,0));
        this.selectBox = selectBox;
    }



    mousedown(event){
        const rect = event.target.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        const {x, y} = fixPointScale(event);
        if(!event.ctrlKey)
        {
            const {point, index} = ledStrip.get_led_at({x,y});
            if(index != -1){
                if (this.selectedLeds.findIndex(led => led.index === index) != -1)
                {
                    this.move_start = {x,y};
                    this.moving = true;
                    canvasLayout.style.cursor = "move";
                    saveState();
                    return;
                }
            }
        }
        this.selectBox.setStart(new Point(canvasX,canvasY)).setEnd(new Point(canvasX,canvasY)).setMode("selecting").draw();
        this.physicalBox = new Box(new Point(x,y), new Point(x,y));
    }
    
    getLedsInSelectedBox()
    {
        let result = []
        this.ledStrip.ledPath.forEach((point, index) => { 
            let pPoint = layoutArea.getCanvasPoint(point.x, point.y);
            const pointBox = new Box(
                new Point(pPoint.x, pPoint.y),
                new Point(pPoint.x + 15, pPoint.y + 15));
            
            if(this.selectBox.box.intersects(pointBox)){
                result.push({index, x: point.x, y: point.y});
            }
        });
        return result;
    }
    
    mouseup(event){
        if(this.moving == true){
            this.moving = false;
            canvasLayout.style.cursor = "default";
            if(this.moved){
                this.moved = false;
                this.selectedLeds.forEach((led, index) =>{
                    let point = this.ledStrip.ledPath[led.index]
                    led.x = point.x;
                    led.y = point.y; 
                });
            }
            else{
                const {point, index} = this.ledStrip.get_led_at(this.move_start);
                this.selectedLeds = []
                this.selectedLeds.push({index, x: point.x, y: point.y});
            }
        }
        else if(this.selectBox.getMode() == "selecting"){
            if(!event.ctrlKey)
                this.selectedLeds = []
            this.getLedsInSelectedBox().forEach((led => {
                const existingIndex = this.selectedLeds.findIndex(l => l.index === led.index);
                if(existingIndex == -1)
                    this.selectedLeds.push(led);
                else
                    this.selectedLeds.splice(existingIndex, 1);
            }));
            this.selectBox.setMode("none").reset().draw();
        }
        drawFrame();
    }
    
    mousemove(event) {
        const rect = event.target.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        const {x, y} = fixPointScale(event);
        if(this.selectBox.getMode() == "selecting")
        {
            this.physicalBox = new Box(this.physicalBox.getStart(), new Point(x,y));
            this.selectBox.setEnd(new Point(canvasX,canvasY)).draw()
        }
        else if(this.moving == true){
            let diffX = x - this.move_start.x;
            let diffY = y - this.move_start.y;
            
            this.selectedLeds.forEach((led, index) =>{
                this.ledStrip.ledPath[led.index] = {x:  led.x + diffX, y: led.y + diffY}; 
            });
            this.moved = true;
            drawFrame();
        }
        
    }
    
    click(event){
        
    }

    get_selected_leds()
    {
        return this.selectedLeds;
    }

    get_selected_leds_count()
    {
        return this.selectedLeds.length;
    }

    clear_selected_leds()
    {
        this.selectedLeds = [];
    }

    set_selected_leds(leds)
    {
        this.selectedLeds = leds;
    }
}

class insertTool extends editorTool{
    constructor(ledStrip, selectTool){
        super("insert", "fa-plus", "Insert a new LED strip");
        this.ledStrip = ledStrip;
        this.selectTool = selectTool;
        this.cursor_style = "pointer";
    }
    
    mousedown(event){}
    mouseup(event){}
    mousemove(event){}

    insertLedsClick(event) {
        if (this.selectTool.get_selected_leds_count() === 0) return;
        
        const {x, y} = fixPointScale(event);
        
        let {point, index} = this.ledStrip.get_led_at({x,y})
        // Check if click is on any LED
        
        if (index !== -1) {
            // Insert the selected LEDs at the target position
            insertLedsAtPosition(index);
            drawFrame();
        }
        this.deactivate(canvasLayout);
    }

    click(event){
        this.insertLedsClick(event);
    }
}