/** The model of a moving object.
    
    Events:
        None
    
    Attributes:
        None
*/
gv.Mob = new JS.Class('Mob', myt.Eventable, {
    // Life Cycle //////////////////////////////////////////////////////////////
    init: function(attrs) {
        var self = this;
        
        self._id = myt.generateGuid();
        self.dvx = self.dvy = self.va = self.angle = 0;
        
        var mapCenter = attrs.mapCenter;
        delete attrs.mapCenter;
        
        // Used to show forces on center mobs
        self._forces = [];
        
        self.callSuper(attrs);
        
        self._calculateVolumeAndRadius();
        
        // Notify center status late
        if (mapCenter) self.setMapCenter(mapCenter);
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    getId: function() {return this._id;},
    
    setLabel: function(v) {this.label = v;},
    setType: function(v) {this.type = v;},
    isType: function(v) {return this.type === v;},
    
    setMass: function(m) {
        this.mass = Math.max(0, m);
        if (this.inited) this._calculateVolumeAndRadius();
    },
    setDensity: function(d) {
        this.density = Math.max(0, d);
        if (this.inited) this._calculateVolumeAndRadius();
    },
    
    setX: function(x) {this.x = x;},
    setY: function(y) {this.y = y;},
    setAngle: function(a) {this.angle = a;},
    
    setVx: function(vx) {this.vx = vx;},
    setVy: function(vy) {this.vy = vy;},
    setVa: function(va) {this.va = va;},
    
    
    // Methods /////////////////////////////////////////////////////////////////
    setMapCenter: function(v) {if (v) gv.map.setCenterMob(this);},
    isMapCenter: function() {return gv.map.getCenterMob() === this;},
    
    getForces: function() {
        return this._forces.sort(function(a, b) {return a.force - b.force;});
    },
    
    getSpeed: function() {
        var vx = this.vx,
            vy = this.vy;
        return Math.sqrt((vx * vx) + (vy * vy));
    },
    
    getMomentum: function() {
        return this.getSpeed() * this.mass;
    },
    
    measureDistance: function(mob) {
        return Math.sqrt(this.measureCenterDistanceSquared(mob)) - this.radius - mob.radius;
    },
    
    measureCenterDistance: function(mob) {
        return Math.sqrt(this.measureCenterDistanceSquared(mob));
    },
    
    measureCenterDistanceSquared: function(mob) {
        var diffX = mob.x - this.x,
            diffY = mob.y - this.y;
        return (diffX * diffX) + (diffY * diffY);
    },
    
    measureRelativeVelocity: function(mob) {
        return {
            x:mob.vx - this.vx, 
            y:mob.vy - this.vy
        };
    },
    
    measureRelativeSpeed: function(mob) {
        var v = this.measureRelativeVelocity(mob);
        return Math.sqrt((v.x * v.x) + (v.y * v.y));
    },
    
    /** @private */
    _calculateVolumeAndRadius: function() {
        var self = this,
            volume = self.volume = (self.mass / self.density) * gv.DENSITY_SCALING,
            radius = self.radius = Math.cbrt(volume * gv.THREE_OVER_FOUR_PI);
        self.radiusSquared = radius * radius;
    },
    
    /** @private */
    _shiftAwayFrom: function(mob) {
        var self = this,
            dx = self.x - mob.x,
            dy = self.y - mob.y,
            distance = self.measureCenterDistance(mob),
            targetDistance = self.radius + mob.radius + 0.125, // 0.125 meters extra
            scale;
            
        if (distance !== 0) {
            scale = (targetDistance / distance) - 1;
            self.setX(self.x + dx * scale);
            self.setY(self.y + dy * scale);
        } else {
            // Rare case where the two mobs are directly on top of each other
            // so we really don't know which direction to shift so we
            // arbitrarily adjust x.
            self.setX(self.x + targetDistance);
        }
    },
    
    resolveCollision: function(mob) {
        var self = this,
            spacetime = gv.spacetime,
            massA = self.mass,
            massB = mob.mass,
            selfIsMoreMassive = massA > massB,
            combinedMass = massA + massB,
            massRatioA = massA / combinedMass,
            massRatioB = massB / combinedMass,
            combinedVx = self.vx * massRatioA + mob.vx * massRatioB,
            combinedVy = self.vy * massRatioA + mob.vy * massRatioB,
            speed;
        
        // Check ship collision first
        if (self.isType('ship') || mob.isType('ship')) {
            speed = self.measureRelativeSpeed(mob);
            
console.log('speed', speed, gv.SAFE_SHIP_COLLISION_THRESHOLD);
            if (speed <= gv.SAFE_SHIP_COLLISION_THRESHOLD) {
console.log('SAFE COLLISION');
                // Lock together by giving each mob the same velocity.
                self.setVx(combinedVx);
                self.setVy(combinedVy);
                mob.setVx(combinedVx);
                mob.setVy(combinedVy);
                
                // Push back the less massive body a tiny bit so they won't
                // immediately recollide
                if (selfIsMoreMassive) {
                    mob._shiftAwayFrom(self);
                } else {
                    self._shiftAwayFrom(mob);
                }
                
                return;
            }
        }
console.log('COLLISION!!!', mob.label, self.label);
        
        // Remove both mobs since they collided
        spacetime.removeMob(self);
        spacetime.removeMob(mob);
        
        // Make a new mob
        var newMob = spacetime.addMob(new gv.Mob({
            mass:combinedMass,
            density:self.density * massRatioA + mob.density * massRatioB,
            x:self.x * massRatioA + mob.x * massRatioB,
            y:self.y * massRatioA + mob.y * massRatioB,
            vx:combinedVx,
            vy:combinedVy,
            mapCenter:self.isMapCenter() || mob.isMapCenter(),
            label:selfIsMoreMassive ? self.label : mob.label,
            type:selfIsMoreMassive ? self.type : mob.type
        }));
        
        // Finally destroy both mobs now that we're done using information from them.
        self.destroy();
        mob.destroy();
        
        return newMob;
    },
    
    resetForces: function() {
        var self = this;
        self._forces.length = self.dvx = self.dvy = 0;
    },
    
    incrementDeltaV: function(mob) {
        var self = this,
            radiansToMob = Math.atan2(mob.y - self.y, mob.x - self.x),
            dv = gv.G * mob.mass / self.measureCenterDistanceSquared(mob);
        self.dvx += Math.cos(radiansToMob) * dv;
        self.dvy += Math.sin(radiansToMob) * dv;
        
        if (self.isMapCenter() && dv > gv.FORCE_DISPLAY_THRESHOLD) self._forces.push({force:dv, angle:radiansToMob, mob:mob});
    },
    
    applyDeltas: function(dt) {
        var self = this,
            // Update velocity
            vx = self.vx += self.dvx * dt,
            vy = self.vy += self.dvy * dt;
        
        // Update Position
        self.x += vx * dt;
        self.y += vy * dt;
        
        // Update Angle
        self.angle = (self.angle + self.va * dt) % gv.TWO_PI;
    }
});
