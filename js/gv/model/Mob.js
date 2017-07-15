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
    
    destroy: function() {
        // Clean up references to this mob
        var self = this,
            app = gv.app;
        if (app.isHighlightMob(self)) app.setHighlightMob();
        if (app.isSelectedMob(self)) app.setSelectedMob();
        
        self.callSuper();
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
    
    setSpawnMob: function(v) {if (v) gv.app.setSpawnMob(this);},
    isSpawnMob: function() {return gv.app.getSpawnMob() === this;},
    
    
    // Methods /////////////////////////////////////////////////////////////////
    setMapCenter: function(v) {if (v) gv.map.setCenterMob(this);},
    isMapCenter: function() {return gv.map.getCenterMob() === this;},
    
    getForces: function() {
        return this._forces.sort(function(a, b) {return a.force - b.force;});
    },
    
    calculateGravityPullFrom: function(mob) {
        var self = this,
            radiansToMob = Math.atan2(mob.y - self.y, mob.x - self.x),
            dv = gv.G * mob.mass / self.measureCenterDistanceSquared(mob);
        return {
            dv:dv,
            dvx:Math.cos(radiansToMob) * dv, 
            dvy:Math.sin(radiansToMob) * dv
        };
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
    /*_shiftAwayFrom: function(mob, extraDistance) {
        var self = this,
            dx = self.x - mob.x,
            dy = self.y - mob.y,
            distance = self.measureCenterDistance(mob),
            targetDistance = self.radius + mob.radius + (extraDistance || 0),
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
    },*/
    
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
            speed = self.measureRelativeSpeed(mob),
            selfIsShip = self.isType('ship'),
            mobIsShip = mob.isType('ship');
        
        if (speed <= gv.ELASTIC_COLLISION_THRESHOLD) {
            self._resolveElasticCollision(mob);
            
            // Dock or Land if possible
            if (selfIsShip || mobIsShip) {
                if (selfIsShip && mobIsShip) {
                    // Both ships so dock if speed is below the safe docking speed.
                    if (speed <= gv.DOCKING_THRESHOLD) {
                        if (selfIsMoreMassive) {
                            mob.dockWith(self, true);
                        } else {
                            self.dockWith(mob, true);
                        }
                    }
                } else {
                    // One ship so land if speed is below the safe landing speed.
                    if (speed <= gv.LANDING_THRESHOLD) {
                        if (selfIsShip) {
                            self.landOn(mob);
                        } else {
                            mob.landOn(self);
                        }
                    }
                }
            }
            
            return null;
        } else {
            // Remove both mobs since they collided
            spacetime.removeMob(self);
            spacetime.removeMob(mob);
            
            // Make a new mob
            // FIXME: Why not just update the properties of the more massive mob?
            var mobKlass = selfIsMoreMassive ? self.klass : mob.klass,
                newMob = spacetime.addMob(new mobKlass({
                    mass:combinedMass,
                    density:self.density * massRatioA + mob.density * massRatioB,
                    x:self.x * massRatioA + mob.x * massRatioB,
                    y:self.y * massRatioA + mob.y * massRatioB,
                    vx:combinedVx,
                    vy:combinedVy,
                    mapCenter:self.isMapCenter() || mob.isMapCenter(),
                    spawnMob:self.isSpawnMob() || mob.isSpawnMob(),
                    label:selfIsMoreMassive ? self.label : mob.label,
                    type:selfIsMoreMassive ? self.type : mob.type,
                }));
            
            if (selfIsMoreMassive) {
                if (selfIsShip) {
                    newMob.setDocks(self.getDocks());
                    newMob.setLandingGear(self.getLandingGear());
                }
            } else if (mobIsShip) {
                if (mobIsShip) {
                    newMob.setDocks(mob.getDocks());
                    newMob.setLandingGear(mob.getLandingGear());
                }
            }
            
            // Finally destroy both mobs now that we're done using information from them.
            self.destroy();
            mob.destroy();
            
            return newMob;
        }
    },
    
    /** @private */
    _resolveElasticCollision: function(mobB) {
        // Roll back position to time of collision
        var mobA = this,
            
            xA = mobA.x,
            yA = mobA.y,
            vxA = mobA.vx,
            vyA = mobA.vy,
            
            xB = mobB.x,
            yB = mobB.y,
            vxB = mobB.vx,
            vyB = mobB.vy,
            
            collisionDistance = mobA.radius + mobB.radius,
            curXDiff = xA - xB,
            curYDiff = yA - yB,
            curVxDiff = vxA - vxB,
            curVyDiff = vyA - vyB,
            c = curXDiff * curXDiff + curYDiff * curYDiff - collisionDistance * collisionDistance;
            b = (2 * curVxDiff * curXDiff) + (2 * curVyDiff * curYDiff);
            a = curVxDiff * curVxDiff + curVyDiff * curVyDiff,
            twoA = 2 * a,
            discriminant = Math.sqrt(b * b - 4 * a * c),
            
            // We only care about the time most in the past
            t = Math.min((-b + discriminant) / twoA, (-b - discriminant) / twoA);
        
        mobA.x += vxA * t;
        mobA.y += vyA * t;
        
        mobB.x += vxB * t;
        mobB.y += vyB * t;
        
        // Resolve collision conserving momentum and energy
        var mA = mobA.mass,
            mB = mobB.mass,
            totalMass = mA + mB,
            
            speedA = mobA.getSpeed(),
            speedB = mobB.getSpeed(),
            
            dirA = Math.atan2(mobA.vy, mobA.vx),
            dirB = Math.atan2(mobB.vy, mobB.vx),
            dirCol = Math.atan2(mobA.y - mobB.y, mobA.x - mobB.x),
            dirTCol = dirCol + gv.HALF_PI,
            dirACol = dirA - dirCol,
            dirBCol = dirB - dirCol,
            dirColCos = Math.cos(dirCol),
            dirColSin = Math.sin(dirCol),
            dirTColCos = Math.cos(dirTCol),
            dirTColSin = Math.sin(dirTCol),
            dirAColCos = Math.cos(dirACol),
            dirAColSin = Math.sin(dirACol),
            dirBColCos = Math.cos(dirBCol),
            dirBColSin = Math.sin(dirBCol),
            
            fA = ((speedA * dirAColCos * (mA - mB)) + (2 * mB * speedB * dirBColCos)) / totalMass,
            f2A = speedA * dirAColSin,
            
            fB = ((speedB * dirBColCos * (mB - mA)) + (2 * mA * speedA * dirAColCos)) / totalMass,
            f2B = speedB * dirBColSin;
        
        mobA.vx = (dirColCos * fA) + f2A * dirTColCos;
        mobA.vy = (dirColSin * fA) + f2A * dirTColSin;
        
        mobB.vx = (dirColCos * fB) + f2B * dirTColCos;
        mobB.vy = (dirColSin * fB) + f2B * dirTColSin;
        
        // Apply new velocity for the rolled back time
        t = -t;
        
        mobA.x += mobA.vx * t;
        mobA.y += mobA.vy * t;
        
        mobB.x += mobB.vx * t;
        mobB.y += mobB.vy * t;
    },
    
    resetForces: function() {
        this._forces.length = this.dvx = this.dvy = 0;
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
        if (self.va !== 0) self.angle = (self.angle + self.va * dt) % gv.TWO_PI;
    },
    
    updateChildMob: function() {
        var self = this,
            parentMob = self._parentMob;
        if (parentMob) {
            self.vx = parentMob.vx;
            self.vy = parentMob.vy;
            self.x = parentMob.x + self._parentMobDx;
            self.y = parentMob.y + self._parentMobDy;
        }
    },
    
    // Child Mobs
    isChildMob: function() {return this._parentMob != null;},
    isChildMobOf: function(parentMob) {return this._parentMob === parentMob;},
    
    setParentMob: function(parentMob) {
        var self = this,
            spacetime = gv.spacetime;
        self._parentMob = parentMob;
        if (parentMob != null) {
            // Remember how far we are from our parent so we can preserve it
            // during spacetime updates.
            self._parentMobDx = self.x - parentMob.x;
            self._parentMobDy = self.y - parentMob.y;
            
            spacetime.addChildMob(self);
        } else {
            spacetime.removeChildMob(self);
        }
    }
});
