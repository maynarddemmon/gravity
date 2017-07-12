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
        this._dockedWith = {};
        this._dockingArcs = [
            [-Math.PI / 12, Math.PI / 12]
        ];
        
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
    
    getDockingArcs: function() {
        return this._dockingArcs;
    },
    
    getDockStatus: function() {
        if (Object.keys(this._dockedWith).length > 0) return "docked";
        if (this.dockingEnabled) return 'enabled';
        return "disabled";
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    enableDock: function() {
        if (this.getDockStatus() === 'disabled') this.dockingEnabled = true;
        if (this.isPlayerShip()) gv.app.updateShipDockStatus();
    },
    
    disableDock: function() {
        if (this.getDockStatus() === 'enabled') this.dockingEnabled = false;
        if (this.isPlayerShip()) gv.app.updateShipDockStatus();
    },
    
    canDockWith: function(ship, checkOther) {
        if (this.thrust !== 0) return false;
        if (this.strafe !== 0) return false;
        if (this.va !== 0) return false;
        if (checkOther) {
            if (!ship.canDockWith(this, false)) return false;
        }
        if (this.getDockStatus() !== 'enabled') return false;
        
        // Lastly, verify dock angle
        var arcs = this.getDockingArcs(), i = arcs.length, arc,
            angleToCheck = Math.atan2(ship.y - this.y, ship.x - this.x) - this.angle;
        while (i) {
            arc = arcs[--i];
            if (gv.isAngleInRange(angleToCheck, arc[0], arc[1])) return true;
        }
        return false;
    },
    
    dockWith: function(ship, makeChild) {
        if (this.canDockWith(ship, true)) {
            if (makeChild) {
                this.setParentMob(ship);
                this.setThrust(0);
                this.setStrafe(0);
                ship.dockWith(this, false);
            }
            this._dockedWith[ship._id] = ship;
            if (this.isPlayerShip()) gv.app.updateShipDockStatus();
        }
    },
    
    undockFromAll: function() {
        for (var key in this._dockedWith) this.undockFrom(this._dockedWith[key]);
    },
    
    undockFrom: function(ship) {
        delete this._dockedWith[ship._id];
        if (this.isChildMobOf(ship)) {
            this.setParentMob();
            ship.undockFrom(this);
            if (this.isPlayerShip()) gv.app.updateShipDockStatus();
        }
    },
    
    isDocked: function() {
        return Object.keys(this._dockedWith).length > 0;
    },
    
    setPlayerShip: function(v) {if (v) gv.app.setPlayerShip(this);},
    isPlayerShip: function() {return gv.app.getPlayerShip() === this;},
    
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
