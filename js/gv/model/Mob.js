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
        self.dvx = self.dvy = 0;
        
        var mapCenter = attrs.mapCenter,
            shipMapCenter = attrs.shipMapCenter,
            targetMapCenter = attrs.targetMapCenter;
        delete attrs.mapCenter;
        delete attrs.shipMapCenter;
        delete attrs.targetMapCenter;
        
        self.callSuper(attrs);
        
        self._calculateVolumeAndRadius();
        
        // Notify center status late
        if (mapCenter) self.setMapCenter(mapCenter);
        if (shipMapCenter) self.setShipMapCenter(shipMapCenter);
        if (targetMapCenter) self.setTargetMapCenter(targetMapCenter);
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    getId: function() {return this._id;},
    
    setLabel: function(v) {this.label = v;},
    setType: function(v) {this.type = v;},
    
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
    
    setVx: function(vx) {this.vx = vx;},
    setVy: function(vy) {this.vy = vy;},
    
    
    // Methods /////////////////////////////////////////////////////////////////
    setMapCenter: function(v) {if (v) gv.map.setCenterMob(this);},
    isMapCenter: function() {return gv.map.getCenterMob() === this;},
    
    setShipMapCenter: function(v) {if (v) gv.shipMap.setCenterMob(this);},
    isShipMapCenter: function() {return gv.shipMap.getCenterMob() === this;},
    
    setTargetMapCenter: function(v) {if (v) gv.targetMap.setCenterMob(this);},
    isTargetMapCenter: function() {return gv.targetMap.getCenterMob() === this;},
    
    getSpeed: function() {
        var vx = this.vx,
            vy = this.vy;
        return Math.sqrt((vx * vx) + (vy * vy));
    },
    
    getMomentum: function() {
        return this.getSpeed() * this.mass;
    },
    
    measureDistance: function(mob) {
        return Math.sqrt(this.measureDistanceSquared(mob));
    },
    
    measureDistanceSquared: function(mob) {
        var diffX = mob.x - this.x,
            diffY = mob.y - this.y;
        return (diffX * diffX) + (diffY * diffY);
    },
    
    /** @private */
    _calculateVolumeAndRadius: function() {
        var self = this,
            volume = self.volume = (self.mass / self.density) * gv.DENSITY_SCALING,
            radius = self.radius = Math.cbrt(volume * gv.THREE_OVER_FOUR_PI);
        self.radiusSquared = radius * radius;
    },
    
    resolveCollision: function(mob) {
        var self = this,
            spacetime = gv.spacetime;
        
        // Remove both mobs since they collided
        spacetime.removeMob(self);
        spacetime.removeMob(mob);
        
console.log('COLLISION!!!', mob.label, self.label);
        // Make a new mob
        var massA = self.mass,
            massB = mob.mass,
            selfIsMoreMassive = massA > massB,
            newMass = massA + massB,
            massRatioA = massA / newMass,
            massRatioB = massB / newMass,
            newMob = spacetime.addMob(new gv.Mob({
                mass:newMass,
                density:self.density * massRatioA + mob.density * massRatioB,
                x:self.x * massRatioA + mob.x * massRatioB,
                y:self.y * massRatioA + mob.y * massRatioB,
                vx:self.vx * massRatioA + mob.vx * massRatioB,
                vy:self.vy * massRatioA + mob.vy * massRatioB,
                mapCenter:self.isMapCenter() || mob.isMapCenter(),
                shipMapCenter:self.isShipMapCenter() || mob.isShipMapCenter(),
                targetMapCenter:self.isTargetMapCenter() || mob.isTargetMapCenter(),
                label:selfIsMoreMassive ? self.label : mob.label,
                type:selfIsMoreMassive ? self.type : mob.type
            }));
        
        // Finally destroy both mobs now that we're done using information from them.
        self.destroy();
        mob.destroy();
        
        return newMob;
    },
    
    incrementDeltaV: function(mob) {
        var self = this,
            radiansToMob = Math.atan2(mob.y - self.y, mob.x - self.x),
            dv = gv.G * mob.mass / self.measureDistanceSquared(mob);
        self.dvx += Math.cos(radiansToMob) * dv;
        self.dvy += Math.sin(radiansToMob) * dv;
    },
    
    applyDeltaV: function() {
        var self = this,
            dt = gv.spacetime.dt,
            
            // Update velocity
            vx = self.vx += self.dvx * dt,
            vy = self.vy += self.dvy * dt;
        
        // Update Position
        self.x += vx * dt;
        self.y += vy * dt;
        
        // Reset
        self.dvx = self.dvy = 0;
    }
});
