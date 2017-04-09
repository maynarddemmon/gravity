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
        
        self.callSuper(parent, attrs);
        
        var mobsLayer = self.mobsLayer = new M.Canvas(self, {
            border:[1, 'solid', '#009900'],
            bgColor:'#000000',
            overflow:'hidden'
        });
        self.attachToDom(mobsLayer, '_handleWheel', 'wheel');
        self.scaleLabel = new M.Text(mobsLayer, {
            align:'center', y:5, fontSize:'10px', textColor:'#00ff00'
        });
        
        self.hideBtn = new GV.CircleButton(self, {
            text:M.FontAwesome.makeTag(['close']),
            inset:4.29, textY:3,
            tooltip:'Hide this map.',
            align:attrs.align, alignOffset:5,
            valign:attrs.valign, valignOffset:5,
            disabled:attrs.expanded || attrs.closed
        }, [{doActivated: function() {self.setClosed(!self.closed);}}]);
        
        self.resizeBtn = new GV.CircleButton(self, {
            text:M.FontAwesome.makeTag(['angle-up']),
            inset:5, textY:2,
            tooltip:'Expand this map.',
            align:attrs.align, alignOffset:24,
            valign:attrs.valign, valignOffset:5,
            disabled:attrs.expanded
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
    
    setCenterMob: function(v) {this._centerMob = v;},
    getCenterMob: function() {return this._centerMob;},
    
    setDistanceScale: function(v) {this.distanceScale = v;},
    
    setWidth:function(v, supressEvent) {
        this.callSuper(v, supressEvent);
        if (this.inited) this._updateWidth();
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
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
            mobsLayer = this.mobsLayer;
        
        this.setHeight(w);
        mobsLayer.setRoundedCorners(w / 2);
        
        w -= 2;
        
        mobsLayer.setWidth(w);
        mobsLayer.setHeight(w);
        
        // Force a redraw if spacetime is not updating
        if (!gv.spacetime.isRunning()) this._redraw();
    },
    
    updateSize: function() {
        var self = this,
            mobsLayer = self.mobsLayer,
            size = self.parent.width,
            opacity = 1;
        if (self.closed) {
            size = 0;
        } else if (!self.expanded) {
            opacity = 0.6;
            size *= 4/9;
        }
        mobsLayer.setOpacity(opacity);
        
        self.stopActiveAnimators('width');
        if (!mobsLayer.visible) mobsLayer.setVisible(true);
        self.animate({attribute:'width', to:size, duration:400}).next(function(success) {
            if (size === 0) mobsLayer.setVisible(false);
        });
    },
    
    /** @private */
    _update: function(event) {
        // Only redraw if spacetime is updating.
        if (gv.spacetime.isRunning()) this._redraw();
    },
    
    /** @private */
    _redraw: function() {
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
            mobCx, mobCy, mobR, mobHaloR;
        
        mobsLayer.clear();
        
        while (i) {
            mob = mobs[--i];
            type = mob.type;
            
            mobCx = offsetX + mob.x * scale;
            mobCy = offsetY + mob.y * scale;
            mobR = mob.getRadius() * scale;
            mobHaloR = mobR * HALO_RADIUS_BY_TYPE[type];
            
            // Don't draw halos that are too small to see
            if (mobHaloR < 0.25) continue;
            
            // Don't draw halos or mobs that do not intersect the map
            if (cicFunc(halfMapSize, halfMapSize, halfMapSize, mobCx, mobCy, mobHaloR)) {
                mobsLayer.setFillStyle(MOB_COLOR_BY_TYPE[type]);
                
                mobsLayer.setGlobalAlpha(0.25);
                mobsLayer.beginPath();
                
                // Draw a rect rather than a circle where possible.
                if (cccFunc(mobCx, mobCy, mobHaloR, halfMapSize, halfMapSize, halfMapSize)) {
                    mobsLayer.rect(0, 0, mapSize, mapSize);
                } else {
                    mobsLayer.circle(mobCx, mobCy, mobHaloR);
                }
                
                mobsLayer.fill();
                
                // Don't draw mobs that are too small to see
                if (mobR < 0.25) continue;
                
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
    },
});
