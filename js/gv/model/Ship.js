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
    setThrust: function(v) {this.thrust = v;},
    
    
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
        var va = this.va + (clockwise ? 0.1 : -0.1);
        if (Math.abs(va) < 0.05) va = 0;
        this.setVa(va);
    },
    
    increaseThrust: function() {
        this.setThrust(this.thrust + 1);
    },
    
    decreaseThrust: function() {
        this.setThrust(Math.max(0, this.thrust - 1));
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
