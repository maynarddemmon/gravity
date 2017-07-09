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
        var app = gv.app,
            highlightMob = app.highlightMob;
        if (highlightMob) {
            if (myt.global.keys.isAltKeyDown()) {
                this.setCenterMob(highlightMob);
                if (app.isSelectedMob(highlightMob)) app.setSelectedMob();
            } else {
                if (app.isSelectedMob(highlightMob)) {
                    app.setSelectedMob();
                } else if (this.getCenterMob() !== highlightMob) {
                    app.setSelectedMob(highlightMob);
                }
            }
        }
    },
    
    /** @private */
    _handleMove: function(event) {
        var pos = myt.MouseObservable.getMouseFromEventRelativeToView(event, this._mobsLayer);
        gv.app.setHighlightMob(gv.spacetime.getNearestMob(this._convertPixelsToMeters(pos), this.getCenterMob()));
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
        
        var GEOM = myt.Geometry,
            GV = gv,
            app = GV.app,
            centerToCornerMapSize = Math.SQRT2 * halfMapSize,
            HALO_RADIUS_BY_TYPE = GV.HALO_RADIUS_BY_TYPE,
            MOB_COLOR_BY_TYPE = GV.MOB_COLOR_BY_TYPE,
            
            mobs = GV.spacetime.getAllMobs(),
            i = mobs.length,
            mob,
            centerMob = self.getCenterMob(),
            highlightMob = app.highlightMob,
            selectedMob = app.getSelectedMob(),
            
            scale = self._distanceScale,
            offsetX = halfMapSize - (centerMob ? centerMob.x : 0) * scale,
            offsetY = halfMapSize - (centerMob ? centerMob.y : 0) * scale,
            
            type, mobCx, mobCy, mobR, mobHaloR, color,
            cicFunc = GV.circleIntersectsCircle,
            
            layer = self._labelLayer,
            
            canvasMobs = [],
            canvasMobsLen,
            mobInfo,
            angle, cosA, sinA, endR,
            
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
                        Math.max(0, 0.75 - (mobHaloR / 1000)), 1
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
        
        layer.clear();
        
        layer.setFont('11px "Lucida Console", Monaco, monospace');
        
        // Draw canvas mobs if necessary
        canvasMobsLen = canvasMobs.length;
        while (canvasMobsLen) {
            mobInfo = canvasMobs[--canvasMobsLen];
            
            layer.beginPath();
            self._drawCircle(layer, mobInfo[0], mobInfo[1], mobInfo[3]);
            layer.setFillStyle(self.convertColorToHex(mobInfo[4]));
            layer.fill();
        }
        
        // Draw the highlight mob if necessary
        if (highlightMob && highlightMob !== centerMob && highlightMob !== selectedMob) {
            self._drawHighlight(layer, scale, offsetX, offsetY, highlightMob, 8, '#009900');
        }
        
        // Draw the selected mob if necessary
        if (selectedMob && selectedMob !== centerMob) {
            self._drawHighlight(layer, scale, offsetX, offsetY, selectedMob, 8, '#669966');
        }
        
        // Draw the center mob highlight
        if (centerMob) {
            mobCx = offsetX + centerMob.x * scale;
            mobCy = offsetY + centerMob.y * scale;
            mobR = Math.max(centerMob.radius * scale, 40),
            
            // Directional arrow
            layer.beginPath();
            layer.moveTo(mobCx, mobCy);
            angle = centerMob.angle - 0.05;
            layer.lineTo(mobCx + mobR * Math.cos(angle), mobCy + mobR * Math.sin(angle));
            angle += 0.05;
            layer.lineTo(mobCx + mobR * Math.cos(angle), mobCy + mobR * Math.sin(angle));
            angle += 0.05;
            layer.lineTo(mobCx + mobR * Math.cos(angle), mobCy + mobR * Math.sin(angle));
            layer.setFillStyle('#00ff00');
            layer.fill();
            
            // Thick inner ring
            layer.beginPath();
            layer.circle(mobCx, mobCy, mobR);
            layer.setLineWidth(3.0);
            layer.setStrokeStyle('#00ff00');
            layer.stroke();
            
            // Thin middle ring
            mobR += 4;
            layer.beginPath();
            layer.circle(mobCx, mobCy, mobR);
            layer.setLineWidth(1.5);
            layer.setStrokeStyle('#006600');
            layer.stroke();
            
            // Thin outer ring
            mobR += 80;
            layer.beginPath();
            layer.circle(mobCx, mobCy, mobR);
            layer.setLineWidth(1.5);
            layer.setStrokeStyle('#006600');
            layer.stroke();
            
            // Lines from outer ring to other mobs
            if (highlightMob && highlightMob !== centerMob) {
                self._drawLineToMob(layer, highlightMob, centerMob, mobCx, mobCy, scale, mobR);
            }
            if (selectedMob && selectedMob !== centerMob) {
                self._drawLineToMob(layer, selectedMob, centerMob, mobCx, mobCy, scale, mobR);
            }
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
    _drawLineToMob: function(layer, mob, centerMob, mobCx, mobCy, scale, startRadius) {
        var GV = gv,
            targetMobR = Math.max(mob.radius * scale, 8),
            distance = mob.measureDistance(centerMob),
            endR = (distance + mob.radius + centerMob.radius) * scale - targetMobR, 
            angle, cosA, sinA,
            cosVA, sinVA,
            label = mob.label + (distance != null ? ' - ' + GV.formatMetersForDistance(distance, true) : ''),
            tXadj = 0, tYAdj = 0, startX, startY,
            dv, velocityAngle, speed, velocityColor,
            angleDiff,
            tangentialVel, normalVel,
            normalVelLabel, tangentialVelLabel;
        
        angle = Math.atan2(mob.y - centerMob.y, mob.x - centerMob.x);
        cosA = Math.cos(angle);
        sinA = Math.sin(angle);
        
        if (endR > startRadius || endR + 2 * targetMobR < startRadius) {
            if (endR < startRadius) endR += 2 * targetMobR;
            
            endR = Math.min(endR, 4000);
            
            layer.beginPath();
            layer.moveTo(mobCx + startRadius * cosA, mobCy + startRadius * sinA);
            layer.lineTo(mobCx + endR * cosA, mobCy + endR * sinA);
            layer.setLineWidth(1.5);
            layer.setStrokeStyle('#006600');
            layer.stroke();
        }
        
        // Draw relative velocity line
        dv = centerMob.measureRelativeVelocity(mob);
        velocityAngle = Math.atan2(dv.y, dv.x);
        speed = Math.sqrt((dv.x * dv.x) + (dv.y * dv.y));
        velocityColor = speed <= GV.SAFE_SHIP_COLLISION_THRESHOLD ? '#00ccff' : '#ff6600';
        
        // Parallel and perpendicular component of velocity relative to the target
        angleDiff = angle - velocityAngle;
        tangentialVel = speed * Math.sin(angleDiff);
        normalVel = -speed * Math.cos(angleDiff);
        normalVelLabel =     '    normal ' + (normalVel > 0 ? ' ' : '') + (normalVel).toFixed(2) + ' m/sec';
        tangentialVelLabel = 'tangential '  + (tangentialVel > 0 ? ' ' : '') + (tangentialVel).toFixed(2)  + ' m/sec';
        
        // Convert to logarithmic scale
        if (speed > 2) speed = Math.log2(speed) + 1;
        speed *= 16; // Make it easier to see.
        
        cosVA = Math.cos(velocityAngle);
        sinVA = Math.sin(velocityAngle);
        startX = mobCx + startRadius * cosA;
        startY = mobCy + startRadius * sinA;
        
        layer.beginPath();
        layer.moveTo(startX, startY);
        layer.lineTo(startX + speed * cosVA, startY + speed * sinVA);
        layer.setLineWidth(1.5);
        layer.setStrokeStyle(velocityColor);
        layer.stroke();
        
        // Draw Label
        layer.setFillStyle('#00ff00');
        tYAdj = (angle > 0 && angle < Math.PI) ? 12 : -33;
        tXadj = (angle > GV.HALF_PI || angle < -GV.HALF_PI) ? -layer.measureText(label).width - 5 : 5;
        layer.fillText(label, mobCx + startRadius * cosA + tXadj, mobCy + startRadius * sinA + tYAdj);
        
        // Draw relative velocity labels
        layer.setFillStyle(velocityColor);
        tYAdj = (angle > 0 && angle < Math.PI) ? 26 : -19;
        tXadj = (angle > GV.HALF_PI || angle < -GV.HALF_PI) ? -layer.measureText(normalVelLabel).width - 5 : 5;
        layer.fillText(normalVelLabel, mobCx + startRadius * cosA + tXadj, mobCy + startRadius * sinA + tYAdj);
        
        tYAdj = (angle > 0 && angle < Math.PI) ? 40 : -5;
        tXadj = (angle > GV.HALF_PI || angle < -GV.HALF_PI) ? -layer.measureText(tangentialVelLabel).width - 5 : 5;
        layer.fillText(tangentialVelLabel, mobCx + startRadius * cosA + tXadj, mobCy + startRadius * sinA + tYAdj);
    },
    
    /** @private */
    _drawHighlight: function(layer, scale, offsetX, offsetY, mob, minRadius, color) {
        layer.beginPath();
        this._drawCircle(layer, offsetX + mob.x * scale, offsetY + mob.y * scale, Math.max(mob.radius * scale, minRadius));
        layer.setLineWidth(1.5);
        layer.setStrokeStyle(color);
        layer.stroke();
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
