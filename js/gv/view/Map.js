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
        var mobsLayer = self.mobsLayer = new M.Canvas(mobsContainer, {
            border:[1, 'solid', '#009900'],
            bgColor:'#000000',
            pointerEvents:'auto'
        });
        self.attachToDom(mobsLayer, '_handleWheel', 'wheel');
        self.attachToDom(mobsLayer, '_handleMove', 'mousemove');
        self.attachToDom(mobsLayer, '_handleClick', 'click');
        self.scaleLabel = new M.Text(mobsLayer, {
            align:'center', y:7, fontSize:'10px', textColor:'#00ff00'
        });
        self.centerMobLabel = new M.Text(mobsLayer, {
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
                
                // Force a redraw if spacetime is not updating
                if (!gv.spacetime.isRunning()) this.redraw();
            }
        }
    },
    getCenterMob: function() {return this._centerMob;},
    
    setDistanceScale: function(v) {
        if (v !== this.distanceScale) {
            this.distanceScale = v;
            
            // Force a redraw if spacetime is not updating
            if (this.inited && !gv.spacetime.isRunning()) this.redraw();
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
        
        // Force a redraw if spacetime is not updating
        if (!gv.spacetime.isRunning()) this.redraw();
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
    
    /** @private */
    _update: function(event) {
        // Only redraw if spacetime is updating.
        if (gv.spacetime.isRunning()) this.redraw();
    },
    
    /** @private */
    redraw: function() {
        if (this.closed) return;
        
        // Redraw mobs layer
        var self = this,
            GV = gv,
            HALO_RADIUS_BY_TYPE = GV.HALO_RADIUS_BY_TYPE,
            MOB_COLOR_BY_TYPE = GV.MOB_COLOR_BY_TYPE,
            mobs = gv.spacetime.getAllMobs(),
            i = mobs.length, mob,
            centerMob = self.getCenterMob() || {x:0, y:0},
            mobsLayer = self.mobsLayer,
            scale = self.distanceScale,
            
            mapSize = self.width,
            halfMapSize = mapSize / 2,
            
            offsetX = halfMapSize - centerMob.x * scale,
            offsetY = halfMapSize - centerMob.y * scale,
            type,
            cicFunc = GV.circleIntersectsCircle,
            cccFunc = GV.circleContainsCircle,
            mobCx, mobCy, mobR, mobHaloR,
            highlightMob = GV.app.highlightMob;
        
        mobsLayer.clear();
        
        while (i) {
            mob = mobs[--i];
            type = mob.type;
            
            mobCx = offsetX + mob.x * scale;
            mobCy = offsetY + mob.y * scale;
            mobR = mob.radius * scale;
            mobHaloR = mobR * HALO_RADIUS_BY_TYPE[type];
            
            // Don't draw halos that are too small to see
            if (mobHaloR > 0.25) {
                // Don't draw halos or mobs that do not intersect the map
                if (cicFunc(halfMapSize, halfMapSize, halfMapSize, mobCx, mobCy, mobHaloR)) {
                    mobsLayer.setFillStyle(MOB_COLOR_BY_TYPE[type]);
                    
                    mobsLayer.setGlobalAlpha(Math.max(0, 0.3 - (mobHaloR / (8 * mapSize))));
                    mobsLayer.beginPath();
                    
                    // Draw a rect rather than a circle where possible.
                    if (cccFunc(mobCx, mobCy, mobHaloR, halfMapSize, halfMapSize, halfMapSize)) {
                        mobsLayer.rect(0, 0, mapSize, mapSize);
                    } else {
                        mobsLayer.circle(mobCx, mobCy, mobHaloR);
                    }
                    
                    mobsLayer.fill();
                    
                    // Don't draw mobs that are too small to see
                    if (mobR > 0.25) {
                        // Don't draw mobs that do not intersect the map
                        if (cicFunc(halfMapSize, halfMapSize, halfMapSize, mobCx, mobCy, mobR)) {
                            mobsLayer.setGlobalAlpha(1);
                            mobsLayer.beginPath();
                            
                            // Draw a rect rather than a circle where possible.
                            if (cccFunc(mobCx, mobCy, mobR, halfMapSize, halfMapSize, halfMapSize)) {
                                mobsLayer.rect(0, 0, mapSize, mapSize);
                            } else {
                                mobsLayer.circle(mobCx, mobCy, mobR);
                            }
                            
                            mobsLayer.fill();
                        }
                    }
                }
            }
            
            // Draw the highlight if necessary
            if (highlightMob === mob) {
                var highlightRadius = Math.max(mobR + 4, 4);
                mobsLayer.setGlobalAlpha(1);
                mobsLayer.beginPath();
                mobsLayer.circle(mobCx, mobCy, highlightRadius);
                mobsLayer.setLineWidth(1.0);
                mobsLayer.setStrokeStyle('#00ff00');
                mobsLayer.stroke();
                
                mobsLayer.setFillStyle('#00ff00');
                mobsLayer.setFont('10px "Lucida Console", Monaco, monospace');
                mobsLayer.setTextAlign('center');
                mobsLayer.fillText(highlightMob.label, mobCx, mobCy - highlightRadius - 4);
            }
        }
    },
});
