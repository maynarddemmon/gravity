/** The model of a spaceship object.
    
    Events:
        None
    
    Attributes:
        None
*/
gv.Ship = new JS.Class('Ship', gv.Mob, {
    // Life Cycle //////////////////////////////////////////////////////////////
    init: function(attrs) {
        var self = this;
        
        self.rotationLevel = self.thrust = self.strafe = 0;
        
        attrs.type = 'ship';
        if (attrs.docks == null) {
            var start = -Math.PI / 12;
            attrs.docks = [{start:start, end:-start}];
        }
        if (attrs.landingGear == null) attrs.landingGear = {start:5/6*Math.PI, end:7/6*Math.PI};
        
        self.callSuper(attrs);
    },
    
    destroy: function() {
        var self = this,
            app = gv.app;
        if (self.isPlayerShip()) {
            app.setPlayerShip();
            app.respawn(self);
        }
        
        self.callSuper();
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setFuel: function(v) {this.fuel = v;},
    
    setThrust: function(v) {
        this.thrust = v;
        if (this.isPlayerShip()) {
            var app = gv.app;
            app.updateShipThrustLabel();
            if (this.isLanded()) app.updateShipLandingGearStatus();
        }
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
    
    setLandingGear: function(landingGear) {
        if (landingGear) {
            if (landingGear.id == null) landingGear.id = myt.generateGuid();
            if (landingGear.enabled == null) landingGear.enabled = false;
        }
        this.landingGear = landingGear;
    },
    getLandingGear: function() {return this.landingGear;},
    
    
    // Methods /////////////////////////////////////////////////////////////////
    
    // Landing //
    isLanded: function() {
        var landingGear = this.landingGear;
        if (landingGear && landingGear.on != null) return true;
        return false;
    },
    
    isLandedOn: function(mob) {
        var landingGear = this.landingGear;
        if (landingGear && landingGear.on === mob) return true;
        return false;
    },
    
    enableLandingGear: function() {
        var landingGear = this.landingGear;
        if (landingGear && this.getLandingGearStatus() === 'disabled') landingGear.enabled = true;
        this._updateLandingGearStatus();
    },
    
    disableLandingGear: function() {
        var landingGear = this.landingGear;
        if (landingGear && this.getLandingGearStatus() === 'enabled') landingGear.enabled = false;
        this._updateLandingGearStatus();
    },
    
    isLandingGearEnabled: function() {
        return this.getLandingGearStatus() === 'enabled';
    },
    
    getLandingGearStatus: function() {
        var landingGear = this.landingGear;
        
        if (this.isLanded()) return 'landed';
        if (landingGear && landingGear.enabled) return 'enabled';
        return "disabled";
    },
    
    canLandOn: function(mob) {
        if (this.isLandingGearEnabled() && this.strafe === 0 && this.va === 0) {
            var landingGear = this.landingGear;
            if (gv.isAngleInRange(Math.atan2(mob.y - this.y, mob.x - this.x) - this.angle, landingGear.start, landingGear.end)) return true;
        }
        return false;
    },
    
    landOn: function(mob) {
        if (this.canLandOn(mob)) {
            this.setParentMob(mob);
            this.landingGear.on = mob;
            this.setThrust(0);
            this._updateLandingGearStatus();
        }
    },
    
    calculateThrust: function() {
        var angle = this.angle,
            thrust = this.thrust;
        return {
            dv:thrust,
            dvx:Math.cos(angle) * thrust,
            dvy:Math.sin(angle) * thrust
        }
    },
    
    canLaunch: function() {
        var self = this;
        if (self.isLanded()) {
            var landingGear = self.landingGear,
                onMob = landingGear.on;
            if (self.isChildMobOf(onMob)) {
                // Make sure we have enough thrust to lift off
                var gForce = self.calculateGravityPullFrom(onMob),
                    thrust = self.calculateThrust(),
                    diffX = self.x - onMob.x + thrust.dvx + gForce.dvx,
                    diffY = self.y - onMob.y + thrust.dvy + gForce.dvy;
                if (Math.sqrt(diffX * diffX + diffY * diffY) > self.measureCenterDistance(onMob)) return true;
            }
        }
    },
    
    launch: function() {
        var self = this;
        if (self.canLaunch()) {
            self.landingGear.on = null;
            self.setParentMob();
            self._updateLandingGearStatus();
        }
    },
    
    /** @private */
    _updateLandingGearStatus: function() {
        if (this.isPlayerShip()) gv.app.updateShipLandingGearStatus();
    },
    
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
    
    isAnyDockEnabled: function() {
        var docks = this.docks, i = docks.length;
        while (i) if (docks[--i].enabled) return true;
        return false;
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
    
    isDockedWith: function(ship) {
        var docks = this.docks, i = docks.length;
        while (i) if (docks[--i].ship === ship) return true;
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
        if (this._allowBurn() && !this.isLanded()) {
            // Scale by simulatedSecondsPerTimeSlice so that rotation behaves
            // the same regardless of time scaling. This generally makes it
            // easier for the user to maneuver.
            var timeScaling = 1 / gv.app.simulatedSecondsPerTimeSlice,
                va = this.va + (clockwise ? 0.00125 : -0.00125) * timeScaling;
            this.setVa(this._snapToZero(va, 0.00125 * timeScaling));
        }
    },
    
    // Thrust //
    increaseThrust: function() {this._applyThrust(true);},
    decreaseThrust: function() {this._applyThrust(false);},
    
    /** @private */
    _applyThrust: function(increase) {
        if (this._allowBurn()) {
            var thrust = this.thrust,
                factor = increase ? 1 : -1;
            if (increase ? thrust >= 0 : thrust > 0) {
                // Main Thrust
                thrust = Math.max(0, thrust + 0.5 * factor);
            } else {
                // Breaking
                thrust = Math.min(0, thrust + 0.25 * factor);
            }
            this.setThrust(this._snapToZero(thrust, 0.25));
        }
    },
    
    // Strafe Thrust //
    strafeLeft: function() {this._applyStrafe(false);},
    strafeRight: function() {this._applyStrafe(true);},
    
    /** @private */
    _applyStrafe: function(right) {
        if (this._allowBurn() && !this.isLanded()) {
            var strafe = this.strafe + 0.25 * (right ? 1 : -1);
            this.setStrafe(this._snapToZero(strafe, 0.25));
        }
    },
    
    /** @private */
    _allowBurn: function() {
        // No changes when simulation isn't running.
        if (!gv.spacetime.isRunning()) return false;
        
        // No changes when docked
        if (this.isDocked()) return false;
        
        return true;
    },
    
    /** @private */
    _snapToZero: function(v, limit) {return Math.abs(v) < limit ? 0 : v;},
    
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
