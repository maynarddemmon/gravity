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
        delete attrs.scaleValue;
        
        self.distanceScale = 1;
        
        self.callSuper(parent, attrs);
        
        var mobsLayer = self.mobsLayer = new M.Canvas(self, {
            border:[1, 'solid', '#009900'],
            bgColor:'#000000',
            overflow:'hidden'
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
        
        self.scaleBtn = new GV.Slider(self, {
            align:attrs.align, alignOffset:43,
            valign:attrs.valign, valignOffset:5,
            width:150, 
            value:scaleValue, minValue:0, maxValue:29
        }, [{
            setValue: function(v) {
                this.callSuper(v);
                
                var txt, scale;
                switch (this.value) {
                    case 0:  scale = 1;            txt = '1 m/px'; break;
                    case 1:  scale = 1/2;          txt = '2 m/px'; break;
                    case 2:  scale = 1/5;          txt = '5 m/px'; break;
                    case 3:  scale = 1/10;         txt = '10 m/px'; break;
                    case 4:  scale = 1/25;         txt = '25 m/px'; break;
                    case 5:  scale = 1/50;         txt = '50 m/px'; break;
                    case 6:  scale = 1/100;        txt = '100 m/px'; break;
                    case 7:  scale = 1/250;        txt = '250 m/px'; break;
                    case 8:  scale = 1/500;        txt = '500 m/px'; break;
                    case 9:  scale = 1/1000;       txt = '1 km/px'; break;
                    case 10: scale = 1/2000;       txt = '2 km/px'; break;
                    case 11: scale = 1/5000;       txt = '5 km/px'; break;
                    case 12: scale = 1/10000;      txt = '10 km/px'; break;
                    case 13: scale = 1/250000;     txt = '25 km/px'; break;
                    case 14: scale = 1/500000;     txt = '50 km/px'; break;
                    case 15: scale = 1/1000000;    txt = '100 km/px'; break;
                    case 16: scale = 1/2500000;    txt = '250 km/px'; break;
                    case 17: scale = 1/5000000;    txt = '500 km/px'; break;
                    case 18: scale = 1/10000000;   txt = '1 Mm/px'; break;
                    case 19: scale = 1/20000000;   txt = '2 Mm/px'; break;
                    case 20: scale = 1/50000000;   txt = '5 Mm/px'; break;
                    case 21: scale = 1/100000000;  txt = '10 Mm/px'; break;
                    case 22: scale = 1/250000000;  txt = '25 Mm/px'; break;
                    case 23: scale = 1/500000000;  txt = '50 Mm/px'; break;
                    case 24: scale = 1/1000000000; txt = '100 Mm/px'; break;
                    case 25: scale = 1/2000000000; txt = '200 Mm/px'; break;
                    case 26: scale = 1/5000000000; txt = '500 Mm/px'; break;
                    
                    case 27: scale = 10/GV.AU;   txt = '0.1 au/px'; break;
                    case 28: scale = 5/GV.AU;    txt = '0.5 au/px'; break;
                    case 29: scale = 1/GV.AU;    txt = '1 au/px'; break;
                }
                this.setText(txt);
                
                if (self._uiReady) {
                    self.stopActiveAnimators('distanceScale');
                    self.animate({attribute:'distanceScale', to:scale, duration:500});
                } else {
                    self.setDistanceScale(scale);
                }
            }
        }]);
        
        self.attachTo(M.global.idle, '_update', 'idle');
        
        self._uiReady = true;
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
    _updateBtnState: function() {
        var self = this,
            expanded = self.expanded,
            closed = self.closed;
        self.resizeBtn.setDisabled(expanded);
        self.hideBtn.setDisabled(expanded || closed);
        self.scaleBtn.setDisabled(closed);
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
