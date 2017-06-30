/** A view that shows the simulation
    
    Events:
        None
    
    Attributes:
        inverseDistanceScale
    
    Private Attributes:
        _wheelX
        _wheelY
        _wheelSpeed
        _distanceScale
        _halfMapSize
*/
gv.Map = new JS.Class('Map', myt.View, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        var self = this,
            M = myt;
        
        self._MAX_SCALE_EXPONENT = 32.5;
        
        self._wheelSpeed = 100;
        self._wheelX = 0;
        self._wheelY = attrs.scaleValue * self._wheelSpeed;
        self._distanceScale = self.inverseDistanceScale = 1;
        self._halfMapSize = 0;
        
        attrs.bgColor = '#000000';
        delete attrs.scaleValue;
        
        self.callSuper(parent, attrs);
        
        self._mobsLayer = new gv.WebGL(self);
        self._labelLayer = new M.Canvas(self);
        
        self.attachToDom(self, '_handleWheel', 'wheel');
        self.attachToDom(self, '_handleMove', 'mousemove');
        self.attachToDom(self, '_handleClick', 'click');
        self.attachTo(M.global.idle, '_update', 'idle');
        
        self._updateDistanceScale();
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setCenterMob: function(v) {
        if (v !== this._centerMob) {
            this._centerMob = v;
            
            if (this.inited) {
                gv.app.updateCenterMobLabel();
                this.forceUpdate();
            }
        }
    },
    getCenterMob: function() {return this._centerMob;},
    
    setWidth:function(v, supressEvent) {
        // Ensure an even integer value since things looks better this way.
        v = Math.round(v);
        if (v % 2 === 1) v += 1;
        
        this.callSuper(v, supressEvent);
        
        if (this.inited) {
            var self = this,
                w = self.width,
                labelLayer = self._labelLayer,
                mobsLayer = self._mobsLayer;
            
            self.setHeight(w);
            mobsLayer.setWidth(w);
            mobsLayer.setHeight(w);
            labelLayer.setWidth(w);
            labelLayer.setHeight(w);
            
            self._halfMapSize = w / 2;
            
            self.forceUpdate();
        }
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    /** @private */
    _handleClick: function(event) {
        var highlightMob = gv.app.highlightMob;
        if (highlightMob) this.setCenterMob(highlightMob);
    },
    
    /** @private */
    _handleMove: function(event) {
        var pos = myt.MouseObservable.getMouseFromEventRelativeToView(event, this._mobsLayer);
        gv.app.setHighlightMob(gv.spacetime.getNearestMob(this._convertPixelsToMeters(pos)));
        
        // Used for shader drawing by mouse position
        //this._mobsLayer.mouseX = pos.x;
        //this._mobsLayer.mouseY = pos.y;
    },
    
    /** Converts a position in pixels into a position in spacetime meters.
        @private */
    _convertPixelsToMeters: function(pos) {
        var centerMob = this.getCenterMob() || {x:0, y:0},
            inverseScale = this.inverseDistanceScale,
            halfMapSize = this._halfMapSize;
        return {
            x:(pos.x - halfMapSize) * inverseScale + centerMob.x, 
            y:(pos.y - halfMapSize) * inverseScale + centerMob.y
        };
    },
    
    /** @private */
    _handleWheel: function(event) {
        // Limit wheel Y to the allowed exponential values
        var self = this;
        self._wheelY = Math.min(Math.max(-235, self._wheelY + event.value.deltaY), self._MAX_SCALE_EXPONENT * self._wheelSpeed);
        self._updateDistanceScale();
    },
    
    /** @private */
    _updateDistanceScale: function() {
        var newScale = Math.exp(this._wheelY / this._wheelSpeed);
        
        // Set distance scale
        var scale = 1 / newScale;
        if (scale !== this._distanceScale) {
            this._distanceScale = scale;
            this.inverseDistanceScale = newScale;
            if (this.inited) this.forceUpdate();
        }
        
        gv.app.updateScaleLabel();
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
            halfMapSize = self._halfMapSize;
        
        if (halfMapSize <= 0) return;
        
        var GV = gv,
            haloFadeSize = halfMapSize * 16,
            shipHaloFadeSize = halfMapSize * 8,
            centerToCornerMapSize = GV.SQRT_OF_2 * halfMapSize,
            HALO_RADIUS_BY_TYPE = GV.HALO_RADIUS_BY_TYPE,
            MOB_COLOR_BY_TYPE = GV.MOB_COLOR_BY_TYPE,
            
            mobs = GV.spacetime.getAllMobs(),
            i = mobs.length,
            mob,
            centerMob = self.getCenterMob() || {x:0, y:0},
            highlightMob = GV.app.highlightMob,
            
            scale = self._distanceScale,
            offsetX = halfMapSize - centerMob.x * scale,
            offsetY = halfMapSize - centerMob.y * scale,
            
            type, mobCx, mobCy, mobR, mobHaloR, color,
            cicFunc = GV.circleIntersectsCircle,
            
            labelLayer = self._labelLayer,
            
            canvasMobs = [],
            canvasMobsLen,
            mobInfo,
            
            // Use two data accumulators to avoid prepending and concating large
            // arrays since that gets CPU intensive.
            haloData = {
                count:0,
                position:[],
                rotation:[],
                size:[],
                color:[],
                renderType:[]
            },
            mobData = {
                count:0,
                position:[],
                rotation:[],
                size:[],
                color:[],
                renderType:[]
            };
        
        function appendTo(data, x, y, rotation, size, color, alpha, renderType) {
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
            data.rotation.push(rotation);
            data.size.push(size);
            data.renderType.push(renderType);
            data.count++;
        }
        
        while (i) {
            mob = mobs[--i];
            type = mob.type;
            rotation = mob.angle;
            
            mobR = mob.radius * scale;
            mobHaloR = Math.max(4, mobR * HALO_RADIUS_BY_TYPE[type]);
            
            mobCx = offsetX + mob.x * scale;
            mobCy = offsetY + mob.y * scale;
            
            // Don't draw halos or mobs that do not intersect the map
            if (cicFunc(halfMapSize, halfMapSize, centerToCornerMapSize, mobCx, mobCy, mobHaloR)) {
                color = MOB_COLOR_BY_TYPE[type];
                if (type === 'ship') {
                    appendTo(
                        haloData, mobCx, mobCy, rotation, 2 * mobHaloR, color, 
                        Math.max(0, 1.0 - (mobHaloR / haloFadeSize)), 3
                    );
                } else {
                    appendTo(
                        haloData, mobCx, mobCy, rotation, 2 * mobHaloR, color, 
                        Math.max(0, 0.5 - (mobHaloR / shipHaloFadeSize)), 1
                    );
                }
                
                // Don't draw mobs that are too small to see
                if (mobR > 0.25) {
                    // Don't draw mobs that do not intersect the map
                    if (cicFunc(halfMapSize, halfMapSize, centerToCornerMapSize, mobCx, mobCy, mobR)) {
                        // Draw large mobs on the canvas since webgl won't draw points that large.
                        if (mobR > 1000) {
                            canvasMobs.push([mobCx, mobCy, rotation, mobR, color]);
                        } else {
                            appendTo(mobData, mobCx, mobCy, rotation, 2 * mobR, color, 1, type === 'ship' ? 2 : 0);
                        }
                    }
                }
            }
        }
        
        labelLayer.clear();
        
        // Draw canvas mobs if necessary
        canvasMobsLen = canvasMobs.length;
        while (canvasMobsLen) {
            mobInfo = canvasMobs[--canvasMobsLen];
            
            labelLayer.beginPath();
            labelLayer.circle(mobInfo[0], mobInfo[1], mobInfo[3]);
            labelLayer.setFillStyle(self.convertColorToHex(mobInfo[4]));
            labelLayer.fill();
        }
        
        // Draw the highlight if necessary
        if (highlightMob) {
            mobR = highlightMob.radius * scale;
            var highlightRadius = Math.max(mobR + 4, 4);
            mobCx = offsetX + highlightMob.x * scale;
            mobCy = offsetY + highlightMob.y * scale;
            
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
        haloData.rotation = haloData.rotation.concat(mobData.rotation);
        haloData.size = haloData.size.concat(mobData.size);
        haloData.color = haloData.color.concat(mobData.color);
        haloData.renderType = haloData.renderType.concat(mobData.renderType);
        haloData.count += mobData.count;
        
        // Redraw
        self._mobsLayer.redraw(haloData);
    },
    
    convertColorToHex: function(v) {
        return myt.Color.rgbToHex(v[0] * v[0] * 255, v[1] * v[1] * 255, v[2] * v[2] * 255, true);
    }
});
