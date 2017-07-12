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
        self._hudLayer = new M.Canvas(self);
        
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
                hudLayer = self._hudLayer,
                mobsLayer = self._mobsLayer;
            
            self.setHeight(w);
            mobsLayer.setWidth(w);
            mobsLayer.setHeight(w);
            hudLayer.setWidth(w);
            hudLayer.setHeight(w);
            
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
        var self = this,
            pos = myt.MouseObservable.getMouseFromEventRelativeToView(event, self._mobsLayer),
            centerMob = self.getCenterMob(),
            inverseScale = self.inverseDistanceScale,
            halfMapSize = self._halfMapSize;
        gv.app.setHighlightMob(gv.spacetime.getNearestMob(
            {
                // Converts a position in pixels into a position in spacetime meters.
                x:inverseScale * (pos.x - halfMapSize) + centerMob.x, 
                y:inverseScale * (pos.y - halfMapSize) + centerMob.y
            }, centerMob
        ));
    },
    
    /** @private */
    _handleWheel: function(event) {
        // Limit wheel Y to the allowed exponential values
        var self = this;
        self._wheelY = Math.min(Math.max(-230, self._wheelY + event.value.deltaY), self._MAX_SCALE_EXPONENT * self._wheelSpeed);
        self._updateDistanceScale();
    },
    
    /** @private */
    _updateDistanceScale: function() {
        var newScale = Math.exp(this._wheelY / this._wheelSpeed),
            scale = 1 / newScale;
        
        // Set distance scale
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
    
    /** Redraw the hud layer and the mobs layer.
        @private */
    _redraw: function() {
        var self = this,
            halfMapSize = self._halfMapSize;
        
        if (halfMapSize <= 0) return;
        
        var GV = gv,
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
            
            drawSelected = selectedMob && selectedMob !== centerMob,
            drawHighlight = highlightMob && highlightMob !== centerMob && highlightMob !== selectedMob,
            
            scale = self._distanceScale,
            offsetX = halfMapSize - (centerMob ? centerMob.x : 0) * scale,
            offsetY = halfMapSize - (centerMob ? centerMob.y : 0) * scale,
            
            type, mobCx, mobCy, mobR, mobHaloR, color, rotation,
            cicFunc = GV.circleIntersectsCircle,
            
            layer = self._hudLayer,
            
            canvasMobs = [],
            canvasMobsLen,
            mobInfo,
            forces, forceCount, forceObj,
            dvx, dvy,
            angle, cosA, sinA, endR,
            
            strongestForceMob, distance, orbitSpeed,
            
            // Use two data accumulators to avoid prepending and concating large
            // arrays since that gets CPU intensive. We use two accumulators
            // so we can ensure that all mobs are drawn on top of all halos.
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
        
        while (i) {
            mob = mobs[--i];
            type = mob.type;
            
            mobR = mob.radius * scale;
            mobHaloR = Math.max(6, mobR * HALO_RADIUS_BY_TYPE[type]);
            
            mobCx = offsetX + mob.x * scale;
            mobCy = offsetY + mob.y * scale;
            
            // Don't draw halos or mobs that do not intersect the map
            if (cicFunc(halfMapSize, halfMapSize, centerToCornerMapSize, mobCx, mobCy, mobHaloR)) {
                rotation = mob.angle;
                color = MOB_COLOR_BY_TYPE[type];
                
                if (type === 'ship') {
                    self._appendTo(
                        haloData, mobCx, mobCy, rotation, 2 * mobHaloR, color, 
                        Math.max(0, 1.0 - (mobHaloR / 1000)), 3
                    );
                } else {
                    self._appendTo(
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
                            self._appendTo(mobData, mobCx, mobCy, rotation, 2 * mobR, color, 1, type === 'ship' ? 2 : 0);
                        }
                    }
                }
            }
        }
        
        layer.clear();
        layer.setFont('11px "Lucida Console", Monaco, monospace');
        layer.setLineWidth(1.5);
        
        // Draw canvas mobs if necessary
        canvasMobsLen = canvasMobs.length;
        while (canvasMobsLen) {
            mobInfo = canvasMobs[--canvasMobsLen];
            self._drawCircle(layer, mobInfo[0], mobInfo[1], mobInfo[3]);
            layer.setFillStyle(self._convertColorToHex(mobInfo[4]));
            layer.fill();
        }
        
        layer.setGlobalAlpha(0.5);
        
        // Draw the highlight mob ring if necessary
        if (drawHighlight) {
            mobR = Math.max(highlightMob.radius * scale, 8);
            mobCx = offsetX + highlightMob.x * scale;
            mobCy = offsetY + highlightMob.y * scale;
            self._drawCircle(layer, mobCx, mobCy, mobR);
            layer.setStrokeStyle('#00ff00');
            layer.stroke();
            layer.setGlobalAlpha(0.75);
            self._drawDocks(layer, highlightMob, mobCx, mobCy, mobR);
        }
        
        layer.setGlobalAlpha(0.5);
        
        // Draw the selected mob ring if necessary
        if (drawSelected) {
            mobR = Math.max(selectedMob.radius * scale, 8);
            mobCx = offsetX + selectedMob.x * scale;
            mobCy = offsetY + selectedMob.y * scale;
            self._drawCircle(layer, mobCx, mobCy, mobR);
            layer.setStrokeStyle('#00ff00');
            layer.stroke();
            layer.setGlobalAlpha(0.75);
            self._drawDocks(layer, selectedMob, mobCx, mobCy, mobR);
        }
        
        //// Draw the center mob highlight /////////////////////////////////////
        mobCx = offsetX + centerMob.x * scale;
        mobCy = offsetY + centerMob.y * scale;
        mobR = Math.max(centerMob.radius * scale, 20),
        
        // Force Arrows
        layer.setGlobalAlpha(1.0);
        forces = centerMob.getForces();
        forceCount = forces.length;
        while (forceCount) {
            forceObj = forces[--forceCount];
            self._drawForce(
                layer, forceObj, mobCx, mobCy, scale, mobR + 4,
                forceObj.mob === centerMob ? '#ff0000' : '#00ffff'
            );
        }
        
        // Net Force Arrow
        dvx = centerMob.dvx;
        dvy = centerMob.dvy;
        forceObj = {
            force:Math.sqrt(dvx * dvx + dvy * dvy), 
            angle:Math.atan2(dvy, dvx), 
            mob:centerMob
        };
        self._drawForce(layer, forceObj, mobCx, mobCy, scale, mobR + 4, '#00ff00');
        
        // Directional Arrow
        layer.beginPath();
        layer.moveTo(mobCx, mobCy);
        angle = centerMob.angle - 0.02;
        layer.lineTo(mobCx + mobR * Math.cos(angle), mobCy + mobR * Math.sin(angle));
        angle += 0.04;
        layer.lineTo(mobCx + mobR * Math.cos(angle), mobCy + mobR * Math.sin(angle));
        layer.setFillStyle('#00ff00');
        layer.fill();
        
        // Inner ring and label
        layer.beginPath();
        layer.circle(mobCx, mobCy, mobR);
        layer.setStrokeStyle('#00ff00');
        layer.stroke();
        layer.fillText(centerMob.label, mobCx - layer.measureText(centerMob.label).width / 2, mobCy - mobR - 6);
        
        // Draw docks
        self._drawDocks(layer, centerMob, mobCx, mobCy, mobR);
        
        // Outer ring
        layer.setGlobalAlpha(0.25);
        mobR += 60;
        
        layer.beginPath();
        layer.circle(mobCx, mobCy, mobR);
        layer.setStrokeStyle('#ffffff');
        layer.stroke();
        
        // Potential Circular Orbit Ring
        layer.setGlobalAlpha(0.5);
        strongestForceMob = self._findStrongestForce(forces, centerMob);
        if (strongestForceMob) {
            distance = strongestForceMob.measureCenterDistance(centerMob);
            var orbitCx = offsetX + strongestForceMob.x * scale,
                orbitCy = offsetY + strongestForceMob.y * scale,
                orbitR = distance * scale;
            self._drawCircle(layer, orbitCx, orbitCy, orbitR);
            layer.setStrokeStyle('#ffffff');
            layer.setGlobalAlpha(0.33);
            layer.stroke();
            
            orbitSpeed = GV.getSpeedForCircularOrbit(centerMob, strongestForceMob, distance);
            
            layer.setGlobalAlpha(0.66);
            layer.setFillStyle('#ffffff');
            var intersection = GV.getIntersectionOfTwoCircles(orbitCx, orbitCy, orbitR, mobCx, mobCy, mobR);
            if (intersection.length) {
                intersection = intersection[0];
            } else {
                intersection = GV.getClosestPointOnACircleToAPoint(mobCx, mobCy, mobR, orbitCx, orbitCy);
            }
            var label = strongestForceMob.label + ' Orbit - tangential ' + (orbitSpeed).toFixed(2) + ' m/sec';
            layer.fillText(
                label, 
                intersection.x + (intersection.x > mobCx ? 5 : -5 - layer.measureText(label).width), 
                intersection.y + (intersection.y > mobCy ? -5 : 11)
            );
        }
        
        // Lines from outer ring to other mobs
        if (drawHighlight) self._drawLineToMob(layer, highlightMob, centerMob, mobCx, mobCy, scale, mobR, true);
        if (drawSelected) self._drawLineToMob(layer, selectedMob, centerMob, mobCx, mobCy, scale, mobR, false);
        
        
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
    _drawDocks: function(layer, mob, mobCx, mobCy, mobR) {
        if (mob.type === 'ship') {
            var docks = mob.getDocks(),
                i = docks.length,
                dock, dockStatus;
            while (i) {
                dock = docks[--i];
                dockStatus = mob.getDockStatus(dock);
                
                // Don't draw dock if it's disabled
                if (dockStatus === 'disabled') continue;
                
                layer.beginPath();
                layer.arc(mobCx, mobCy, mobR + 0.5, mob.angle + dock.start, mob.angle + dock.end);
                layer.setStrokeStyle(dockStatus === 'docked' ? '#00ff66' : '#cccc00');
                layer.setLineWidth(3.5);
                layer.stroke();
                layer.setLineWidth(1.5);
            }
        }
    },
    
    /** @private */
    _findStrongestForce: function(forces, skipMob) {
        var i = forces.length, mob;
        while (i) {
            mob = forces[--i].mob;
            if (mob !== skipMob) return mob;
        }
    },
    
    /** @private */
    _convertColorToHex: function(v) {
        return myt.Color.rgbToHex(v[0] * v[0] * 255, v[1] * v[1] * 255, v[2] * v[2] * 255, true);
    },
    
    /** @private */
    _appendTo: function(data, x, y, rotation, size, color, alpha, renderType) {
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
    },
    
    /** @private */
    _drawForce: function(layer, forceObj, mobCx, mobCy, scale, startRadius, color) {
        layer.beginPath();
        var angle = forceObj.angle - 0.05,
            endR = startRadius + 10 * forceObj.force;
        layer.moveTo(mobCx + startRadius * Math.cos(angle), mobCy + startRadius * Math.sin(angle));
        angle += 0.05;
        layer.lineTo(mobCx + endR * Math.cos(angle), mobCy + endR * Math.sin(angle));
        angle += 0.05;
        layer.lineTo(mobCx + startRadius * Math.cos(angle), mobCy + startRadius * Math.sin(angle));
        layer.setFillStyle(color);
        layer.fill();
    },
    
    /** @private */
    _drawLineToMob: function(layer, mob, centerMob, mobCx, mobCy, scale, startRadius, minimalText) {
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
            layer.setStrokeStyle('#ffffff');
            layer.setGlobalAlpha(0.25);
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
        
        layer.setGlobalAlpha(1.0);
        
        layer.beginPath();
        layer.moveTo(startX, startY);
        layer.lineTo(startX + speed * cosVA, startY + speed * sinVA);
        layer.setStrokeStyle(velocityColor);
        layer.stroke();
        
        // Draw Label
        layer.setFillStyle('#00ff00');
        tYAdj = (angle > 0 && angle < Math.PI) ? 12 : (minimalText ? -5 : -33);
        tXadj = (angle > GV.HALF_PI || angle < -GV.HALF_PI) ? -layer.measureText(label).width - 5 : 5;
        layer.fillText(label, mobCx + startRadius * cosA + tXadj, mobCy + startRadius * sinA + tYAdj);
        
        if (!minimalText) {
            // Draw relative velocity labels
            layer.setFillStyle(velocityColor);
            tYAdj = (angle > 0 && angle < Math.PI) ? 26 : -19;
            tXadj = (angle > GV.HALF_PI || angle < -GV.HALF_PI) ? -layer.measureText(normalVelLabel).width - 5 : 5;
            layer.fillText(normalVelLabel, mobCx + startRadius * cosA + tXadj, mobCy + startRadius * sinA + tYAdj);
            
            tYAdj = (angle > 0 && angle < Math.PI) ? 40 : -5;
            tXadj = (angle > GV.HALF_PI || angle < -GV.HALF_PI) ? -layer.measureText(tangentialVelLabel).width - 5 : 5;
            layer.fillText(tangentialVelLabel, mobCx + startRadius * cosA + tXadj, mobCy + startRadius * sinA + tYAdj);
        }
    },
    
    /** @private */
    _drawCircle: function(layer, x, y, r) {
        layer.beginPath();
        
        if (r > 50000) {
            var GV = gv,
                halfMapSize = this._halfMapSize,
                mapSize = 2 * halfMapSize,
                pt, angle;
            if (GV.circleContainsCircle(x, y, r, halfMapSize, halfMapSize, mapSize)) {
                // Draw a rect when the circle contains the viewport
                layer.rect(0, 0, mapSize, mapSize);
            } else {
                // Draw large circles as a poly to prevent jitter
                pt = GV.getClosestPointOnACircleToAPoint(x, y, r, halfMapSize, halfMapSize);
                angle = Math.atan2(halfMapSize - y, halfMapSize - x) + GV.HALF_PI;
                x = pt.x;
                y = pt.y;
                layer.moveTo(x + 8192 * Math.cos(angle), y + 8192 * Math.sin(angle));
                angle += Math.PI;
                layer.lineTo(x + 8192 * Math.cos(angle), y + 8192 * Math.sin(angle));
            }
        } else {
            layer.circle(x, y, r);
        }
    }
});
