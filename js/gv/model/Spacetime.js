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
        this._childMobs = [];
        
        this._collisionCheckCount = 0;
        
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
    
    getNearestMob: function(pos, mobToIgnore) {
        var mobs = this._allMobs, 
            i = mobs.length, mob,
            distance, nearestDistance, nearestMob;
        while (i) {
            mob = mobs[--i];
            if (mob === mobToIgnore) continue;
            distance = mob.measureCenterDistance(pos) - mob.radius;
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
                // Remove from _reactOnlyMobs or regular _mobs
                var mobs = mobToRemove.mass < gv.REACT_ONLY_THRESHOLD ? this._reactOnlyMobs : this._mobs,
                    i = mobs.length;
                while (i) {
                    if (mobs[--i] === mobToRemove) {
                        mobs.splice(i, 1);
                        break;
                    }
                }
                
                // Remove from _childMobs if necessary
                if (mobToRemove.isChildMob()) this.removeChildMob(mobToRemove);
                
                // Remove from _allMobs as well
                mobs = this._allMobs;
                i = mobs.length;
                while (i) {
                    if (mobs[--i] === mobToRemove) {
                        mobs.splice(i, 1);
                        break;
                    }
                }
                
                // Also remove from _mobsById
                delete this._mobsById[mobToRemove.getId()];
                
                return mobToRemove;
            }
        }
    },
    
    addChildMob: function(mob) {
        this._childMobs.push(mob);
    },
    
    removeChildMob: function(mob) {
        var childMobs = this._childMobs, i = childMobs.length, childMob;
        while (i) {
            childMob = childMobs[--i];
            if (childMob === mob) {
                childMobs.splice(i, 1);
                return;
            }
        }
    },
    
    // Time
    start: function() {
        var self = this,
            app = gv.app;
        if (!self.isRunning()) self._intervalId = setInterval(function() {self._loop();}, gv.MILLIS_PER_CALC);
        
        app.playBtn.setDisabled(true);
        app.pauseBtn.setDisabled(false);
    },
    
    stop: function() {
        var self = this,
            app = gv.app;
        clearInterval(self._intervalId);
        delete self._intervalId;
        
        app.pauseBtn.setDisabled(true);
        app.playBtn.setDisabled(false);
    },
    
    isRunning: function() {
        return this._intervalId;
    },
    
    // Main Loop
    /** @private */
    _loop: function() {
        var self = this,
            i, j, mobA, mobB, newMob, r1, collisionDistance, allMobs, allMobsLen, mobs,
            childMobs,
            dt = gv.app.simulatedSecondsPerTimeSlice;
        
        // Resolve collisions. Don't check collisions every time since this 
        // is CPU intensive.
        self._collisionCheckCount++;
        if (self._collisionCheckCount === 4) {
            self._collisionCheckCount = 0;
            
            allMobs = self.getAllMobs(true);
            allMobsLen = allMobs.length;
            for (i = 0; allMobsLen > i;) {
                mobA = allMobs[i++];
                r1 = mobA.radius;
                for (j = i; allMobsLen > j; j++) {
                    mobB = allMobs[j];
                    
                    // No collisions between parent and child mobs
                    if (mobB.isChildMobOf(mobA) || mobA.isChildMobOf(mobB)) continue;
                    
                    collisionDistance = r1 + mobB.radius;
                    if (mobA.measureCenterDistanceSquared(mobB) < collisionDistance * collisionDistance) {
                        newMob = mobA.resolveCollision(mobB);
                        if (newMob) {
                            allMobs.push(newMob);
                            allMobs.splice(j, 1);
                        }
                        break;
                    }
                }
            }
        }
        
        // Reset forces
        allMobs = self.getAllMobs();
        i = allMobsLen = allMobs.length;
        while (i) allMobs[--i].resetForces();
        
        // Calculate gravity forces
        mobs = self._mobs;
        i = mobs.length;
        while (i) {
            mobA = mobs[--i];
            j = allMobsLen;
            while (j) {
                mobB = allMobs[--j];
                if (mobA !== mobB) mobB.incrementDeltaV(mobA);
            }
        }
        
        // Update mob positions
        i = allMobsLen;
        while (i) allMobs[--i].applyDeltas(dt);
        
        // Update child mobs so they can track their parent pos/vel
        childMobs = self._childMobs;
        i = childMobs.length;
        while (i) childMobs[--i].updateChildMob();
    }
});
