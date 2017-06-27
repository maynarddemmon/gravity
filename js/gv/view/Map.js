/** A view that shows the simulation
    
    Events:
        None
    
    Attributes:
        None
*/
gv.Map = new JS.Class('Map', myt.View, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        var self = this,
            M = myt,
            scaleValue = attrs.scaleValue;
            wheelSpeed = self._wheelSpeed = 100;
        delete attrs.scaleValue;
        
        self.wheelX = 0;
        self.wheelY = scaleValue * wheelSpeed;
        self._maxScaleExponent = 26;
        self.distanceScale = 1;
        
        attrs.bgColor = '#000000';
        
        self.callSuper(parent, attrs);
        
        self._mobsLayer = new gv.WebGL(self);
        self.labelLayer = new M.Canvas(self);
        self.scaleLabel = new M.Text(self, {align:'center', y:7, fontSize:'10px', textColor:'#00ff00'});
        self.centerMobLabel = new M.Text(self, {align:'center', y:19, fontSize:'10px', textColor:'#00ff00'});
        
        self.attachToDom(self, '_handleWheel', 'wheel');
        self.attachToDom(self, '_handleMove', 'mousemove');
        self.attachToDom(self, '_handleClick', 'click');
        self.attachTo(M.global.idle, '_update', 'idle');
        
        self._updateDistanceScale();
        self._updateCenterMobLabel();
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setCenterMob: function(v) {
        if (v !== this._centerMob) {
            this._centerMob = v;
            
            if (this.inited) {
                this._updateCenterMobLabel();
                this.forceUpdate();
            }
        }
    },
    getCenterMob: function() {return this._centerMob;},
    
    setDistanceScale: function(v) {
        if (v !== this.distanceScale) {
            this.distanceScale = v;
            if (this.inited) this.forceUpdate();
        }
    },
    
    setWidth:function(v, supressEvent) {
        v = Math.round(v);
        if (v % 2 === 1) v += 1;
        
        this.callSuper(v, supressEvent);
        if (this.inited) this._updateWidth();
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    /** @private */
    _updateCenterMobLabel: function() {
        var mob = this.getCenterMob();
        this.centerMobLabel.setText(mob ? mob.label : '');
    },
    
    /** @private */
    _handleClick: function(event) {
        var highlightMob = gv.app.highlightMob;
        if (highlightMob) this.setCenterMob(highlightMob);
    },
    
    /** @private */
    _handleMove: function(event) {
        var GV = gv,
            pos = myt.MouseObservable.getMouseFromEventRelativeToView(event, this._mobsLayer),
            nearestMob = GV.spacetime.getNearestMob(this._convertPixelsToMeters(pos));
        GV.app.setHighlightMob(nearestMob);
        
        // Used for shader drawing by mouse position
        //this._mobsLayer.mouseX = pos.x;
        //this._mobsLayer.mouseY = pos.y;
    },
    
    /** @private */
    _convertPixelsToMeters: function(pos) {
        var centerMob = this.getCenterMob() || {x:0, y:0},
            inverseScale = 1 / this.distanceScale,
            halfMapSize = this.width / 2;
        return {
            x:(pos.x - halfMapSize) * inverseScale + centerMob.x, 
            y:(pos.y - halfMapSize) * inverseScale + centerMob.y
        };
    },
    
    /** @private */
    _handleWheel: function(event) {
        // Limit wheel Y to the allowed exponential values
        var self = this;
        self.wheelY = Math.min(Math.max(0, self.wheelY + event.value.deltaY), self._maxScaleExponent * self._wheelSpeed);
        self._updateDistanceScale();
    },
    
    /** @private */
    _updateDistanceScale: function() {
        var newScale = Math.exp(this.wheelY / this._wheelSpeed), 
            unit, value;
        this.setDistanceScale(1 / newScale);
        
        // Clean up value for display
        if (newScale >= 100000000) {
            newScale /= gv.AU;
            unit = 'au';
            value = newScale.toFixed(4);
        } else if (newScale >= 1000000) {
            newScale /= 1000000;
            unit = 'Mm';
            value = newScale.toFixed(2);
        } else if (newScale >= 1000) {
            newScale /= 1000;
            unit = 'km';
            value = newScale.toFixed(2);
        } else {
            unit = 'm';
            value = newScale.toFixed(2);
        }
        
        this.scaleLabel.setText(value + ' ' + unit + '/px');
    },
    
    /** @private */
    _updateWidth: function() {
        var w = this.width,
            labelLayer = this.labelLayer,
            mobsLayer = this._mobsLayer;
        
        this.setHeight(w);
        
        mobsLayer.setWidth(w);
        mobsLayer.setHeight(w);
        
        labelLayer.setWidth(w);
        labelLayer.setHeight(w);
        
        this.forceUpdate();
    },
    
    /** Redraw when spacetime is running.
        @private */
    _update: function(event) {
        if (gv.spacetime.isRunning()) this._redraw();
    },
    
    /** Redraw when spacetime is not running.
        @private */
    forceUpdate: function() {
        if (!gv.spacetime.isRunning()) this._redraw();
    },
    
    /** @private */
    _redraw: function() {
        // Redraw mobs layer
        var self = this,
            mapSize = self.width;
        
        if (mapSize <= 0) return;
        
        var GV = gv,
            halfMapSize = mapSize / 2,
            centerToCornerMapSize = GV.SQRT_OF_2 * halfMapSize,
            HALO_RADIUS_BY_TYPE = GV.HALO_RADIUS_BY_TYPE,
            MOB_COLOR_BY_TYPE = GV.MOB_COLOR_BY_TYPE,
            
            mobs = GV.spacetime.getAllMobs(),
            i = mobs.length,
            mob,
            centerMob = self.getCenterMob() || {x:0, y:0},
            highlightMob = GV.app.highlightMob,
            
            scale = self.distanceScale,
            offsetX = halfMapSize - centerMob.x * scale,
            offsetY = halfMapSize - centerMob.y * scale,
            
            type, mobCx, mobCy, mobR, mobHaloR, color,
            cicFunc = GV.circleIntersectsCircle,
            
            labelLayer = self.labelLayer,
            
            // Use two data accumulators to avoid prepending and concating large
            // arrays since that gets CPU intensive.
            haloData = {
                count:0,
                position:[],
                size:[],
                color:[],
                renderType:[]
            },
            mobData = {
                count:0,
                position:[],
                size:[],
                color:[],
                renderType:[]
            };
        
        function appendTo(data, x, y, size, color, alpha, renderType) {
            // No need to render what can't be seen.
            if (alpha === 0) return;
            
            data.color = data.color.concat(color);
            
            // Apply alpha after the fact to avoid modifying the provided color
            if (alpha !== 1) {
                var c = data.color,
                    len = c.length;
                c[len - 2] *= alpha;
                c[len - 3] *= alpha;
                c[len - 4] *= alpha;
            }
            
            data.position.push(x, y);
            data.size.push(size);
            data.renderType.push(renderType);
            data.count++;
        }
        
        while (i) {
            mob = mobs[--i];
            type = mob.type;
            
            mobR = mob.radius * scale;
            mobHaloR = Math.max(4, mobR * HALO_RADIUS_BY_TYPE[type]);
            
            mobCx = offsetX + mob.x * scale;
            mobCy = offsetY + mob.y * scale;
            
            // Don't draw halos or mobs that do not intersect the map
            if (cicFunc(halfMapSize, halfMapSize, centerToCornerMapSize, mobCx, mobCy, mobHaloR)) {
                color = MOB_COLOR_BY_TYPE[type];
                appendTo(haloData, mobCx, mobCy, 2 * mobHaloR, color, Math.max(0, 0.5 - (mobHaloR / (8 * mapSize))), 1);
                
                // Don't draw mobs that are too small to see
                if (mobR > 0.25) {
                    // Don't draw mobs that do not intersect the map
                    if (cicFunc(halfMapSize, halfMapSize, centerToCornerMapSize, mobCx, mobCy, mobR)) {
                        appendTo(mobData, mobCx, mobCy, 2 * mobR, color, 1, 0);
                    }
                }
            }
        }
        
        // Draw the highlight if necessary
        labelLayer.clear();
        if (highlightMob) {
            mobR = highlightMob.radius * scale;
            var highlightRadius = Math.max(mobR + 4, 4);
            mobCx = offsetX + highlightMob.x * scale;
            mobCy = offsetY + highlightMob.y * scale;
            
            labelLayer.setGlobalAlpha(1);
            labelLayer.beginPath();
            labelLayer.circle(mobCx, mobCy, highlightRadius);
            labelLayer.setLineWidth(1.0);
            labelLayer.setStrokeStyle('#00ff00');
            labelLayer.stroke();
            
            labelLayer.setFillStyle('#00ff00');
            labelLayer.setFont('10px "Lucida Console", Monaco, monospace');
            labelLayer.setTextAlign('center');
            labelLayer.fillText(highlightMob.label, mobCx, mobCy - highlightRadius - 4);
        }
        
        // Combine Data Accumulators
        haloData.position = haloData.position.concat(mobData.position);
        haloData.size = haloData.size.concat(mobData.size);
        haloData.color = haloData.color.concat(mobData.color);
        haloData.renderType = haloData.renderType.concat(mobData.renderType);
        haloData.count += mobData.count;
        
        // Redraw
        self._mobsLayer.redraw(haloData);
    }
});
