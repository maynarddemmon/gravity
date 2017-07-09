/** The model of a spaceship object.
    
    Events:
        None
    
    Attributes:
        None
*/
gv.Ship = new JS.Class('Ship', gv.Mob, {
    // Life Cycle //////////////////////////////////////////////////////////////
    init: function(attrs) {
        this.rotationLevel = this.thrust = 0;
        
        attrs.type = 'ship';
        
        this.callSuper(attrs);
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setFuel: function(v) {this.fuel = v;},
    setThrust: function(v) {
        this.thrust = v;
        
        gv.app.updateShipThrustLabel();
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    setPlayerShip: function(v) {if (v) gv.app.setPlayerShip(this);},
    isPlayerShip: function() {return gv.app.getPlayerShip() === this;},
    
    rotateLeft: function() {
        this._applyRotationalThrust(false);
    },
    
    rotateRight: function() {
        this._applyRotationalThrust(true);
    },
    
    /** @private */
    _applyRotationalThrust: function(clockwise) {
        // Scale by simulatedSecondsPerTimeSlice
        var timeScaling = 1 / gv.app.simulatedSecondsPerTimeSlice,
            va = this.va + (clockwise ? 0.01 : -0.01) * timeScaling;
        
        // Snap to zero when close so it's easy for a user to stop rotation
        if (Math.abs(va) < 0.005 * timeScaling) va = 0;
        
        this.setVa(va);
    },
    
    increaseThrust: function() {
        var thrust = this.thrust;
        if (thrust >= 0) {
            // Increase Main Thrust
            thrust = Math.max(0, thrust + 0.12);
        } else {
            // Decrease Breaking
            thrust = Math.min(0, thrust + 0.03);
        }
        
        // Snap to zero when close so it's easy for a user to stop thrust
        if (Math.abs(thrust) < 0.005) thrust = 0;
        
        this.setThrust(thrust);
    },
    
    decreaseThrust: function() {
        var thrust = this.thrust;
        if (thrust > 0) {
            // Decrease Main Thrust
            thrust = Math.max(0, thrust - 0.12);
        } else {
            // Increase Breaking
            thrust = Math.min(0, thrust - 0.03);
        }
        
        // Snap to zero when close so it's easy for a user to stop thrust
        if (Math.abs(thrust) < 0.005) thrust = 0;
        
        this.setThrust(thrust);
    },
    
    /** @overrides */
    incrementDeltaV: function(mob) {
        var self = this,
            angle = self.angle,
            thrust = self.thrust;
        
        self.callSuper(mob);
        
        self.dvx += Math.cos(angle) * thrust;
        self.dvy += Math.sin(angle) * thrust;
    }
});
