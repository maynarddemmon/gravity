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
            GV = gv,
            scaleValue = attrs.scaleValue;
            wheelSpeed = self._wheelSpeed = 100;
        delete attrs.scaleValue;
        
        self.wheelX = 0;
        self.wheelY = scaleValue * wheelSpeed;
        self._maxScaleExponent = 26;
        self.distanceScale = 1;
        
        attrs.pointerEvents = 'none';
        self.callSuper(parent, attrs);
        
        var mobsContainer = self.mobsContainer = new M.View(self);
        var mobsLayer = self.mobsLayer = new GV.WebGL(mobsContainer, {
            border:[1, 'solid', '#009900'],
            bgColor:'#000000',
            pointerEvents:'auto'
        });
        self.attachToDom(mobsLayer, '_handleWheel', 'wheel');
        self.attachToDom(mobsLayer, '_handleMove', 'mousemove');
        self.attachToDom(mobsLayer, '_handleClick', 'click');
        
        self.labelLayer = new M.Canvas(mobsContainer, {x:1, y:1});
        
        self.scaleLabel = new M.Text(mobsContainer, {
            align:'center', y:7, fontSize:'10px', textColor:'#00ff00'
        });
        self.centerMobLabel = new M.Text(mobsContainer, {
            align:'center', y:19, fontSize:'10px', textColor:'#00ff00'
        });
        
        self.hideBtn = new GV.CircleButton(self, {
            text:M.FontAwesome.makeTag(['close']),
            inset:4.29, textY:3,
            tooltip:'Hide this map.',
            align:attrs.align, alignOffset:5,
            valign:attrs.valign, valignOffset:5,
            disabled:attrs.expanded || attrs.closed,
            pointerEvents:'auto'
        }, [{doActivated: function() {self.setClosed(!self.closed);}}]);
        
        self.resizeBtn = new GV.CircleButton(self, {
            text:M.FontAwesome.makeTag(['angle-up']),
            inset:5, textY:2,
            tooltip:'Expand this map.',
            align:attrs.align, alignOffset:24,
            valign:attrs.valign, valignOffset:5,
            disabled:attrs.expanded,
            pointerEvents:'auto'
        }, [{
            doActivated: function() {
                if (self.closed) {
                    self.setClosed(false);
                } else {
                    self.setExpanded(!self.expanded);
                }
            }
        }]);
        
        self.attachTo(M.global.idle, '_update', 'idle');
        
        self._updateDistanceScale();
        self._updateCenterMobLabel();
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setExpanded: function(v) {
        this.expanded = v;
        if (this.inited) {
            if (v) this.sendToBack();
            gv.app.notifyMapExpansionChange(this);
            
            if (this.closed) {
                this.setClosed(false);
            } else {
                this._updateBtnState();
                this.updateSize();
            }
        }
    },
    
    setClosed: function(v) {
        this.closed = v;
        if (this.inited) {
            this._updateBtnState();
            this.updateSize();
        }
    },
    
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
        var mob = this.getCenterMob(),
            txt = '';
        if (mob) txt = mob.label;
        this.centerMobLabel.setText(txt);
    },
    
    /** @private */
    _handleClick: function(event) {
        var highlightMob = gv.app.highlightMob;
        if (highlightMob) {
            this.setCenterMob(highlightMob);
            gv.app.setHighlightMob();
        }
    },
    
    /** @private */
    _handleMove: function(event) {
        var GV = gv,
            pos = myt.MouseObservable.getMouseFromEventRelativeToView(event, this.mobsLayer),
            nearestMob = GV.spacetime.getNearestMob(this._convertPixelsToMeters(pos));
        GV.app.setHighlightMob(nearestMob);
        
        // Used for shader drawing by mouse position
        //this.mobsLayer.mouseX = pos.x;
        //this.mobsLayer.mouseY = pos.y;
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
    _updateBtnState: function() {
        var self = this,
            expanded = self.expanded,
            closed = self.closed;
        self.resizeBtn.setDisabled(expanded);
        self.hideBtn.setDisabled(expanded || closed);
    },
    
    _updateWidth: function() {
        var w = this.width,
            rounding = w / 2,
            labelLayer = this.labelLayer,
            mobsLayer = this.mobsLayer,
            mobsContainer = this.mobsContainer;
        
        mobsLayer.setRoundedCorners(rounding);
        this.setHeight(w);
        mobsContainer.setWidth(w);
        mobsContainer.setHeight(w);
        mobsContainer.deStyle.clipPath = 'circle(' + rounding + 'px at ' + rounding + 'px ' + rounding + 'px)';
        
        w -= 2;
        mobsLayer.setWidth(w);
        mobsLayer.setHeight(w);
        
        labelLayer.setWidth(w);
        labelLayer.setHeight(w);
        
        this.forceUpdate();
    },
    
    updateSize: function() {
        var self = this,
            mobsLayer = self.mobsLayer,
            size = self.parent.width;
        if (self.closed) {
            size = 0;
        } else if (!self.expanded) {
            size *= 3/8;
        } else {
            size -= 8;
        }
        
        self.stopActiveAnimators('width');
        if (!mobsLayer.visible) mobsLayer.setVisible(true);
        self.animate({attribute:'width', to:size, duration:400}).next(function(success) {
            if (size === 0) mobsLayer.setVisible(false);
        });
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
        if (this.closed) return;
        
        // Redraw mobs layer
        var self = this,
            mapSize = self.width;
        
        if (mapSize <= 0) return;
        
        var halfMapSize = mapSize / 2,
            GV = gv,
            HALO_RADIUS_BY_TYPE = GV.HALO_RADIUS_BY_TYPE,
            MOB_COLOR_BY_TYPE = GV.MOB_COLOR_BY_TYPE,
            
            mobs = GV.spacetime.getAllMobs(),
            i = mobs.length,
            mob,
            centerMob = self.getCenterMob() || {x:0, y:0},
            
            scale = self.distanceScale,
            offsetX = halfMapSize - centerMob.x * scale,
            offsetY = halfMapSize - centerMob.y * scale,
            
            type, mobCx, mobCy, mobR, mobHaloR,
            cicFunc = GV.circleIntersectsCircle,
            
            highlightMob = GV.app.highlightMob,
            labelLayer = self.labelLayer,
            
            vertexData = {
                count:0,
                position:[],
                size:[],
                color:[]
            };
        
        function addVertex(x, y, size, color, alpha) {
            if (alpha === 0) return;
            if (alpha < 1) {
                color[0] *= alpha;
                color[1] *= alpha;
                color[2] *= alpha;
            }
            vertexData.position.push(x, y);
            vertexData.size.push(size);
            vertexData.color = vertexData.color.concat(color);
            vertexData.count++;
        }
        
        while (i) {
            mob = mobs[--i];
            type = mob.type;
            
            mobR = mob.radius * scale;
            mobHaloR = mobR * HALO_RADIUS_BY_TYPE[type];
            
            // Don't draw halos that are too small to see
            if (mobHaloR > 0.25) {
                mobCx = offsetX + mob.x * scale;
                mobCy = offsetY + mob.y * scale;
                
                // Don't draw halos or mobs that do not intersect the map
                if (cicFunc(halfMapSize, halfMapSize, halfMapSize, mobCx, mobCy, mobHaloR)) {
                    addVertex(
                        mobCx, mobCy,
                        2 * mobHaloR, 
                        MOB_COLOR_BY_TYPE[type].concat(), 
                        Math.max(0, 0.5 - (mobHaloR / (8 * mapSize)))
                    );
                    
                    // Don't draw mobs that are too small to see
                    if (mobR > 0.25) {
                        // Don't draw mobs that do not intersect the map
                        if (cicFunc(halfMapSize, halfMapSize, halfMapSize, mobCx, mobCy, mobR)) {
                            addVertex(
                                mobCx, mobCy, 
                                2 * mobR, 
                                MOB_COLOR_BY_TYPE[type].concat(), 
                                1
                            );
                        }
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
        
        self.mobsLayer.redraw(vertexData);
    }
});
