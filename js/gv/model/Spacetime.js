/** The model of spacetime.
    
    Events:
        None
    
    Attributes:
        None
*/
gv.Spacetime = new JS.Class('Spacetime', myt.Eventable, {
    // Life Cycle //////////////////////////////////////////////////////////////
    init: function(attrs) {
        this._mobs = [];
        this._reactOnlyMobs = [];
        this._allMobs = [];
        this._mobsById = {};
        
        this.callSuper(attrs);
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    bulkAddMob: function(arrayOfMobs) {
        var i = arrayOfMobs.length;
        while (i) this.addMob(arrayOfMobs[--i]);
    },
    
    // MOB CRUD
    getAllMobs: function(makeCopy) {
        return makeCopy ? this._allMobs.concat() : this._allMobs;
    },
    
    getMob: function(id) {
        return this._mobsById[id];
    },
    
    getMobByLabel: function(label) {
        var mobs = this._allMobs, 
            i = mobs.length, 
            mob;
        while (i) {
            mob = mobs[--i];
            if (mob.label === label) return mob;
        }
    },
    
    getNearestMob: function(pos) {
        var mobs = this._allMobs, 
            i = mobs.length, mob,
            distance, nearestDistance, nearestMob;
        while (i) {
            mob = mobs[--i];
            distance = mob.measureDistanceSquared(pos);
            if (distance < nearestDistance || !nearestMob) {
                nearestDistance = distance;
                nearestMob = mob;
            }
        }
        
        return nearestMob
    },
    
    hasMob: function(mob) {
        return mob ? this.getMob(mob.getId()) != null : false;
    },
    
    addMob: function(mob) {
        if (mob) {
            if (!this.hasMob(mob)) {
                if (mob.mass < gv.REACT_ONLY_THRESHOLD) {
                    this._reactOnlyMobs.push(mob);
                } else {
                    this._mobs.push(mob);
                }
                this._allMobs.push(mob);
                this._mobsById[mob.getId()] = mob;
            }
        }
        return mob;
    },
    
    removeMob: function(mobToRemove) {
        if (mobToRemove) {
            if (this.hasMob(mobToRemove)) {
                var mobs = mobToRemove.mass < gv.REACT_ONLY_THRESHOLD ? this._reactOnlyMobs : this._mobs,
                    i = mobs.length;
                while (i) {
                    if (mobs[--i] === mobToRemove) {
                        mobs.splice(i, 1);
                        break;
                    }
                }
                
                // Remove from _allMobs as well
                mobs = this._allMobs;
                i = mobs.length;
                while (i) {
                    if (mobs[--i] === mobToRemove) {
                        mobs.splice(i, 1);
                        break;
                    }
                }
                
                delete this._mobsById[mobToRemove.getId()];
                return mobToRemove;
            }
        }
    },
    
    // Time
    start: function() {
        var self = this;
        if (!self._intervalId) {
            self._intervalId = setInterval(
                function() {
                    if (!self._paused) self._loop();
                }, gv.MILLIS_PER_CALC
            );
        }
    },
    
    pause: function() {
        this._paused = true;
    },
    
    resume: function() {
        this._paused = false;
    },
    
    stop: function() {
        clearInterval(this._intervalId);
        delete this._intervalId;
    },
    
    isRunning: function() {
        return !this._paused && this._intervalId;
    },
    
    // Main Loop
    /** @private */
    _loop: function() {
        var self = this;
        
        // Lock in a time scale for the duration of this loop iteration.
        this.dt = gv.SIMULATED_SECONDS_PER_TIME_SLICE;
        
        // Resolve collisions
        var allMobs = self.getAllMobs(true),
            mobsToCheck = self.getAllMobs(true),
            mobToCheck, 
            i, 
            mob, 
            newMob, r1Squared;
        while (mobsToCheck.length) {
            mobToCheck = mobsToCheck.shift();
            r1Squared = mobToCheck.radiusSquared;
            
            // Mob is destroyed because of an earlier collision so no need to
            // check it
            if (mobToCheck.destroyed) continue;
            
            // Walk backwards so we can splice out destroyed mobs.
            i = allMobs.length;
            while (i) {
                mob = allMobs[--i];
                
                // Mob is destroyed from a previous collision so no need to
                // check it.
                if (mob.destroyed) {
                    // Prevent rechecking this mob for subsequent mobs to check.
                    allMobs.splice(i, 1);
                    continue;
                }
                
                if (mob !== mobToCheck) {
                    // Check for collision
                    if (mobToCheck.measureDistanceSquared(mob) < r1Squared + mob.radiusSquared) {
                        newMob = mobToCheck.resolveCollision(mob);
                        
                        mobsToCheck.push(newMob);
                        allMobs.push(newMob);
                        
                        // Premptively splice out the mob we were checking against
                        // since it will definitely be destroyed
                        allMobs.splice(i, 1);
                        
                        // Since a collision occured we can move on to the next
                        // mob to check so break out of the while loop
                        break;
                    }
                }
            }
        }
        
        // Calculate gravity forces
        var mobs = self._mobs,
            i = mobs.length,
            allMobs = self.getAllMobs(),
            j, mobA, mobB;
        while (i) {
            mobA = mobs[--i];
            j = allMobs.length;
            while (j) {
                mobB = allMobs[--j];
                if (mobA !== mobB) mobB.incrementDeltaV(mobA);
            }
        }
        
        // Update mob positions
        j = allMobs.length;
        while (j) allMobs[--j].applyDeltaV();
    }
});
