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
        this._mobsById = {};
        
        this.callSuper(attrs);
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    bulkAdd: function(arrayOfMobAttrs) {
        var i = arrayOfMobAttrs.length;
        while (i) this.addMob(new gv.Mob(arrayOfMobAttrs[--i]));
    },
    
    // MOB CRUD
    getAllMobs: function(makeCopy) {
        return makeCopy ? this._mobs.concat() : this._mobs;
    },
    
    getMob: function(id) {
        return this._mobsById[id];
    },
    
    getMobByLabel: function(label) {
        var mobs = this._mobs, i = mobs.length, mob;
        while (i) {
            mob = mobs[--i];
            if (mob.label === label) return mob;
        }
    },
    
    getNearestMob: function(pos) {
        var mobs = this._mobs, i = mobs.length, mob,
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
                this._mobs.push(mob);
                this._mobsById[mob.getId()] = mob;
            }
        }
        return mob;
    },
    
    removeMob: function(mobToRemove) {
        if (mobToRemove) {
            if (this.hasMob(mobToRemove)) {
                var mobs = this._mobs, 
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
        var self = this,
            mobs = self._mobs;
        
        // Lock in a time scale for the duration of this loop iteration.
        this.dt = gv.SIMULATED_SECONDS_PER_TIME_SLICE;
        
        // Resolve collisions
        var allMobs = self.getAllMobs(true),
            mobsToCheck = self.getAllMobs(true),
            mobToCheck, 
            i, 
            mob, 
            newMob;
        while (mobsToCheck.length) {
            mobToCheck = mobsToCheck.shift();
            
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
                
                newMob = mobToCheck.collideWith(mob);
                if (newMob) {
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
        
        // Calculate gravity forces
        var len = mobs.length,
            j, mobA, mobB;
        i = len;
        while (i) {
            mobA = mobs[--i];
            j = len;
            while (j) if (i !== --j) mobA.incrementDeltaV(mobs[j]);
        }
        
        // Update mob positions
        i = len;
        while (i) mobs[--i].applyDeltaV();
    }
});
