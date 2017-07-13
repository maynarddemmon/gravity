/** The model of a spaceship object.
    
    Events:
        None
    
    Attributes:
        None
*/
gv.Ship = new JS.Class('Ship', gv.Mob, {
    // Life Cycle //////////////////////////////////////////////////////////////
    init: function(attrs) {
        this.rotationLevel = this.thrust = this.strafe = 0;
        
        if (attrs.docks == null) {
            var start = -Math.PI / 12;
            attrs.docks = [{start:start, end:-start}];
        }
        
        attrs.type = 'ship';
        
        this.callSuper(attrs);
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setFuel: function(v) {this.fuel = v;},
    
    setThrust: function(v) {
        this.thrust = v;
        if (this.isPlayerShip()) gv.app.updateShipThrustLabel();
    },
    
    setStrafe: function(v) {
        this.strafe = v;
        if (this.isPlayerShip()) gv.app.updateShipStrafeLabel();
    },
    
    setPlayerShip: function(v) {if (v) gv.app.setPlayerShip(this);},
    isPlayerShip: function() {return gv.app.getPlayerShip() === this;},
    
    setDocks: function(docks) {
        // Generate unique IDs for each dock.
        var i = docks.length, dock;
        while (i) {
            dock = docks[--i];
            if (dock.id == null) dock.id = myt.generateGuid();
            if (dock.enabled == null) dock.enabled = false;
        }
        
        this.docks = docks;
    },
    getDocks: function() {return this.docks;},
    
    
    // Methods /////////////////////////////////////////////////////////////////
    
    // Docking //
    getDock: function(id) {
        var docks = this.docks, i = docks.length, dock;
        
        // If only 1 dock exists and no id was provided then return it.
        if (i === 1 && id == null) return docks[0];
        
        while (i) {
            dock = docks[--i];
            if (dock.id === id) return dock;
        }
    },
    
    enableAllDocks: function() {
        var docks = this.docks, i = docks.length;
        while (i) this.enableDock(docks[--i]);
    },
    
    enableDock: function(dock) {
        if (this.getDockStatus(dock) === 'disabled') dock.enabled = true;
        this._updateDockStatus();
    },
    
    disableAllDocks: function() {
        var docks = this.docks, i = docks.length;
        while (i) this.disableDock(docks[--i]);
    },
    
    disableDock: function(dock) {
        if (this.getDockStatus(dock) === 'enabled') dock.enabled = false;
        this._updateDockStatus();
    },
    
    getDockStatus: function(dock) {
        if (this.isDockedViaDock(dock)) return 'docked';
        if (dock.enabled) return 'enabled';
        return "disabled";
    },
    
    /** Checks if the provided dock is in use. */
    isDockedViaDock: function(dock) {
        return dock.ship != null;
    },
    
    /** Checks if any docks are in use. */
    isDocked: function() {
        var docks = this.docks, i = docks.length;
        while (i) if (this.isDockedViaDock(docks[--i])) return true;
        return false;
    },
    
    /** Returns the dock, if any, that the provided ship can dock with on
        this ship. */
    canDockWith: function(ship, checkOther) {
        if (this.thrust === 0 && this.strafe === 0 && this.va === 0) {
            if (checkOther) if (ship.canDockWith(this, false) == null) return null;
            
            // Verify dock state and angle
            var dock = this.getClosestDockTo(ship);
            if (dock && this.getDockStatus(dock) === 'enabled') return dock;
        }
        
        return null;
    },
    
    getClosestDockTo: function(mob) {
        var docks = this.getDocks(), i = docks.length, dock,
            angleToCheck = Math.atan2(mob.y - this.y, mob.x - this.x) - this.angle;
        while (i) {
            dock = docks[--i];
            if (gv.isAngleInRange(angleToCheck, dock.start, dock.end)) return dock;
        }
        return null;
    },
    
    dockWith: function(ship, makeChild) {
        var dock = this.canDockWith(ship, true);
        if (dock) {
            if (makeChild) {
                this.setParentMob(ship);
                ship.dockWith(this, false);
            }
            dock.ship = ship;
            dock.shipDock = ship.getClosestDockTo(this);
            this._updateDockStatus();
        }
    },
    
    undockFromAll: function() {
        var docks = this.docks, i = docks.length;
        while (i) this.undockFrom(docks[--i], true);
    },
    
    undockFrom: function(dock, undockOther) {
        var ship = dock.ship,
            shipDock = dock.shipDock;
        if (ship) {
            dock.ship = dock.shipDock = null;
            
            if (undockOther) ship.undockFrom(shipDock, false);
            
            if (this.isChildMobOf(ship)) {
                this.setParentMob();
                this._updateDockStatus();
            }
        }
    },
    
    /** @private */
    _updateDockStatus: function() {
        if (this.isPlayerShip()) gv.app.updateShipDockStatus();
    },
    
    // Rotation //
    rotateLeft: function() {this._applyRotationalThrust(false);},
    rotateRight: function() {this._applyRotationalThrust(true);},
    
    /** @private */
    _applyRotationalThrust: function(clockwise) {
        // No changes when simulation isn't running.
        if (!gv.spacetime.isRunning()) return;
        
        // No changes when docked
        if (this.isDocked()) return;
        
        // Scale by simulatedSecondsPerTimeSlice
        var timeScaling = 1 / gv.app.simulatedSecondsPerTimeSlice,
            va = this.va + (clockwise ? 0.00125 : -0.00125) * timeScaling;
        
        // Snap to zero when close so it's easy for a user to stop rotation
        if (Math.abs(va) < 0.000625 * timeScaling) va = 0;
        
        this.setVa(va);
    },
    
    // Thrust //
    increaseThrust: function() {this._applyThrust(true);},
    decreaseThrust: function() {this._applyThrust(false);},
    
    /** @private */
    _applyThrust: function(increase) {
        // No changes when simulation isn't running.
        if (!gv.spacetime.isRunning()) return;
        
        // No changes when docked
        if (this.isDocked()) return;
        
        var thrust = this.thrust,
            factor = increase ? 1 : -1;
        if (increase ? thrust >= 0 : thrust > 0) {
            // Main Thrust
            thrust = Math.max(0, thrust + 0.5 * factor);
        } else {
            // Breaking
            thrust = Math.min(0, thrust + 0.25 * factor);
        }
        
        // Snap to zero when close so it's easy for a user to stop thrust
        if (Math.abs(thrust) < 0.25) thrust = 0;
        
        this.setThrust(thrust);
    },
    
    // Strafe Thrust //
    strafeLeft: function() {this._applyStrafe(false);},
    strafeRight: function() {this._applyStrafe(true);},
    
    /** @private */
    _applyStrafe: function(right) {
        // No changes when simulation isn't running.
        if (!gv.spacetime.isRunning()) return;
        
        // No changes when docked
        if (this.isDocked()) return;
        
        var strafe = this.strafe + 0.25 * (right ? 1 : -1);
        
        // Snap to zero when close so it's easy for a user to stop strafe
        if (Math.abs(strafe) < 0.25) strafe = 0;
        
        this.setStrafe(strafe);
    },
    
    // Spacetime Updates //
    /** @overrides */
    applyDeltas: function(dt) {
        var self = this,
            angle = self.angle,
            thrust = self.thrust,
            strafe = self.strafe,
            isMapCenter = self.isMapCenter();
        
        if (thrust !== 0) {
            // Apply thrust for 1 second
            self.dvx += Math.cos(angle) * thrust;
            self.dvy += Math.sin(angle) * thrust;
            
            if (isMapCenter) {
                var thrustMagnitude = Math.abs(thrust);
                if (thrustMagnitude > gv.FORCE_DISPLAY_THRESHOLD) {
                    self._forces.push({
                        force:thrustMagnitude, 
                        angle:angle + (thrust > 0 ? 0 : -Math.PI), 
                        mob:self
                    });
                }
            }
        }
        
        if (strafe !== 0) {
            // Apply strafe for 1 second
            angle += gv.HALF_PI;
            
            self.dvx += Math.cos(angle) * strafe;
            self.dvy += Math.sin(angle) * strafe;
            
            if (isMapCenter) {
                var strafeMagnitude = Math.abs(strafe);
                if (strafeMagnitude > gv.FORCE_DISPLAY_THRESHOLD) {
                    self._forces.push({
                        force:strafeMagnitude, 
                        angle:angle + (strafe > 0 ? 0 : -Math.PI), 
                        mob:self
                    });
                }
            }
        }
        
        this.callSuper(dt);
    }
});
