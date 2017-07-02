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
            if (this.inited) this.forceUpdate();
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
            centerToCornerMapSize = Math.SQRT2 * halfMapSize,
            HALO_RADIUS_BY_TYPE = GV.HALO_RADIUS_BY_TYPE,
            MOB_COLOR_BY_TYPE = GV.MOB_COLOR_BY_TYPE,
            
            mobs = GV.spacetime.getAllMobs(),
            i = mobs.length,
            mob,
            centerMob = self.getCenterMob(),
            highlightMob = GV.app.highlightMob,
            
            scale = self._distanceScale,
            offsetX = halfMapSize - (centerMob ? centerMob.x : 0) * scale,
            offsetY = halfMapSize - (centerMob ? centerMob.y : 0) * scale,
            
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
                        Math.max(0, 1.0 - (mobHaloR / 1000)), 3
                    );
                } else {
                    appendTo(
                        haloData, mobCx, mobCy, rotation, 2 * mobHaloR, color, 
                        Math.max(0, 0.5 - (mobHaloR / 1000)), 1
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
            self._drawCircle(labelLayer, mobInfo[0], mobInfo[1], mobInfo[3]);
            labelLayer.setFillStyle(self.convertColorToHex(mobInfo[4]));
            labelLayer.fill();
        }
        
        // Draw the highlight if necessary
        if (highlightMob && highlightMob !== centerMob) {
            self._drawHighlight(
                labelLayer, scale, offsetX, offsetY, highlightMob, 8, '#00ff00',
                centerMob ? centerMob.measureDistance(highlightMob) : null
            );
        }
        
        // Draw the center mob highlight
        if (centerMob) {
            self._drawHighlight(labelLayer, scale, offsetX, offsetY, centerMob, 16, '#aaffaa');
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
    
    /** @private */
    _drawHighlight: function(layer, scale, offsetX, offsetY, mob, minRadius, color, distance) {
        var self = this,
            mapSize = 2 * self._halfMapSize,
            mobR = mob.radius * scale,
            highlightRadius = Math.max(mobR + 2, minRadius),
            mobCx = offsetX + mob.x * scale,
            mobCy = offsetY + mob.y * scale,
            label = mob.label + (distance != null ? ' - ' + gv.formatMetersForDistance(distance, true) : ''),
            tw, th, edgeInset = 4;
        
        layer.beginPath();
        self._drawCircle(layer, mobCx, mobCy, highlightRadius);
        layer.setLineWidth(1.5);
        layer.setStrokeStyle(color);
        layer.stroke();
        
        layer.setFillStyle(color);
        layer.setFont('10px "Lucida Console", Monaco, monospace');
        
        tw = layer.measureText(label).width;
        th = 8;
        
        layer.fillText(
            label, 
            Math.max(edgeInset, Math.min(mapSize - edgeInset - tw, mobCx - (tw / 2))),
            Math.max(edgeInset + th, Math.min(mapSize - (edgeInset + th) - th, mobCy - highlightRadius - 4))
        );
    },
    
    /** @private */
    _drawCircle: function(layer, x, y, r) {
        if (r > 100000) {
            var GV = gv,
                halfMapSize = this._halfMapSize,
                p3, a1, a2;
            if (GV.circleContainsCircle(x, y, r, halfMapSize, halfMapSize, 2 * halfMapSize)) {
                // Draw a rect when the circle contains the viewport
                layer.rect(0, 0, 2*halfMapSize, 2*halfMapSize);
            } else {
                // Draw large circles as a poly to prevent jitter
                p3 = GV.getClosestPointOnACircleToAPoint(x, y, r, halfMapSize, halfMapSize);
                
                if (halfMapSize === x) {
                    a1 = Math.PI / 2 * (y > halfMapSize ? 1 : -1);
                } else if (x > halfMapSize) {
                    a1 = Math.atan((halfMapSize - y) / (halfMapSize - x)) + Math.PI;
                } else {
                    a1 = Math.atan((halfMapSize - y) / (halfMapSize - x));
                }
                a1 -= 0.05;
                a2 = a1 + 0.1;
                
                console.log('arc');
                layer.moveTo(x, y);
                layer.lineTo(x + r * Math.cos(a1), y + r * Math.sin(a1));
                layer.lineTo(p3.x, p3.y);
                layer.lineTo(x + r * Math.cos(a2), y + r * Math.sin(a2));
            }
        } else {
            layer.circle(x, y, r);
        }
    },
    
    convertColorToHex: function(v) {
        return myt.Color.rgbToHex(v[0] * v[0] * 255, v[1] * v[1] * 255, v[2] * v[2] * 255, true);
    }
});
