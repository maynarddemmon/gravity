/**
 * gravity: A gravity toy.
 * http://github.com/maynarddemmon/gravity
 * Copyright (c) 2017 Maynard Demmon
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/*
    TODO:
        - Handle destruction of the player ship (respawn?)
        
        - Formal landed state (no rotation while landed, no landing while rotating)
        - Landing via specific angles with a higher collision threshold (landing gear on back)
        
        - Draw scale markers on the map
        - Some kind of rotational thrust indicator
        - Elapsed time indicator.
        - Color relative velocity when it's near orbit velocity
        
        - Multiple selected mobs.
        - Update highlight mob when useing mousewheel to zoom
        - Key repeat support for thrust adjustments
        
        - Atmospheric drag
        - Show rotation on asteroid, moons, planets, etc.
        
        - Limit time scale based on distance to closest mob?
*/
gv = (function() {
    var timeSlicesPerSecond = 60,
        millisPerCalc = Math.ceil(1000 / timeSlicesPerSecond);
    return {
        // How many millis occur during one time slice.
        MILLIS_PER_CALC:millisPerCalc,
        
        // React only mass theshold. Mobs with mass below this value only react
        // to gravity, they don't generate it.
        REACT_ONLY_THRESHOLD:1.0e21,
        
        // The speed below which elastic collisions occur.
        ELASTIC_COLLISION_THRESHOLD:10.0,
        
        // The speed below which ships may collide with other ships and dock.
        DOCKING_THRESHOLD:1.0,
        
        FORCE_DISPLAY_THRESHOLD:0.000001,
        
        // Makes all mobs larger
        DENSITY_SCALING:1,
        
        // Used in volume of a sphere calculations.
        THREE_OVER_FOUR_PI:3 / (4 * Math.PI),
        
        HALF_PI:Math.PI / 2,
        
        TWO_PI:Math.PI * 2,
        
        // The gravitational constant
        G:6.674e-11,
        
        // 1 earth g force in newtons
        G_FORCE:9.80665,
        
        // 1 astronomical unit in meters
        AU:149597870700,
        
        HALO_RADIUS_BY_TYPE: {
            star:150,
            planet:50,
            moon:75,
            asteroid:500,
            ship:10
        },
        
        MOB_COLOR_BY_TYPE: {
            star:    [ 1.0,  1.0,  0.0, 0.0],
            planet:  [ 0.0, 0.75,  1.0, 0.0],
            moon:    [0.80, 0.75, 0.80, 0.0],
            asteroid:[0.75, 0.75, 0.75, 0.0],
            ship:    [ 0.0,  0.75,  0.0, 0.0]
        },
        
        // A reference to the gv.App object
        app:null,
        
        // A reference to the gv.Spacetime object
        spacetime:null,
        
        // A reference to the main gv.Map object
        map:null,
        
        circleIntersectsCircle: function(ax, ay, ar, bx, by, br) {
            return myt.Geometry.measureDistance(ax, ay, bx, by, true) < (ar + br) * (ar + br);
        },
        
        circleContainsCircle: function(ax, ay, ar, bx, by, br) {
            return (ar >= br) && (myt.Geometry.measureDistance(ax, ay, bx, by, true) <= (ar - br) * (ar - br));
        },
        
        /** Converts a radius (in meters) and orbit period (in days) 
            to meters/second. */
        getSpeedForRadiusAndPeriod: function(r, p) {
            return (2 * Math.PI * r) / (p * 3600 * 24);
        },
        
        /** Gets the speed of a satellite with a circular orbit at a given
            radius around a given center mass. */
        getSpeedForCircularOrbit: function(satelliteMob, centerMob, orbitRadius) {
            return Math.sqrt(gv.G * (satelliteMob.mass + centerMob.mass) / orbitRadius);
        },
        
        giveMobCircularOrbit: function(satelliteMob, centerMob, orbitRadius, angle, retrograde) {
            var speed = this.getSpeedForCircularOrbit(satelliteMob, centerMob, orbitRadius),
                tangentAngle = angle + (Math.PI / 2),
                reverse = retrograde ? -1 : 1;
            satelliteMob.setX(centerMob.x + Math.cos(angle) * orbitRadius);
            satelliteMob.setY(centerMob.y + Math.sin(angle) * orbitRadius);
            satelliteMob.setVx(centerMob.vx + Math.cos(tangentAngle) * speed * reverse);
            satelliteMob.setVy(centerMob.vy + Math.sin(tangentAngle) * speed * reverse);
        },
        
        getClosestPointOnACircleToAPoint: function(cx, cy, r, px, py) {
            var xDiff = px - cx,
                yDiff = py - cy,
                distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
            if (distance === 0) {
                return {x:cx, y:cy};
            } else {
                return {
                    x:cx + r * xDiff / distance,
                    y:cy + r * yDiff / distance
                };
            }
        },
        
        getIntersectionOfTwoCircles: function(x1, y1, r1, x2, y2, r2) {
            if (r1 > 8192 * r2) {
                // The first circle is much bigger than the second so
                // approximate using the tangent line.
                var angle = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2,
                    dx = r2 * Math.cos(angle),
                    dy = r2 * Math.sin(angle);
                return [{x:x2 + dx, y:y2 + dy},{x:x2 - dx, y:y2 - dy}];
            } else if (r2 > 8192 * r1) {
                // The second circle is much bigger than the first so
                // approximate using the tangent line.
                var angle = Math.atan2(y1 - y2, x1 - x2) - Math.PI / 2,
                    dx = r1 * Math.cos(angle),
                    dy = r1 * Math.sin(angle);
                return [{x:x1 + dx, y:y1 + dy},{x:x1 - dx, y:y1 - dy}];
            } else {
                var diffX = x1 - x2,
                    diffY = y1 - y2,
                    R = Math.sqrt(diffX * diffX + diffY * diffY);
                
                if (R === 0) {
                    // Circles with the same center and same radius intersect
                    // everywhere or nowhere. Either way return an empty result.
                    return [];
                }
                
                // No intersection so return an empty list of results.
                if (!(Math.abs(r1 - r2) <= R && R <= r1 + r2)) return [];
                
                var R2 = R * R,
                    R4 = R2 * R2,
                    a = (r1 * r1 - r2 * r2) / (2 * R2),
                    r2r2 = (r1 * r1 - r2 * r2),
                    c = Math.sqrt(2 * (r1 * r1 + r2 * r2) / R2 - (r2r2 * r2r2) / R4 - 1),
                    
                    fx = (x1 + x2) / 2 + a * (x2 - x1),
                    gx = c * (y2 - y1) / 2,
                    fy = (y1 + y2) / 2 + a * (y2 - y1),
                    gy = c * (x1 - x2) / 2;
                
                // Note if gy == 0 and gx == 0 then the circles are tangent and
                // there is only one solution but that one solution will just be
                // duplicated as the code is currently written
                return [{x:fx + gx, y:fy + gy}, {x:fx - gx, y:fy - gy}];
            }
        },
        
        isAngleInRange: function(angle, rangeStart, rangeEnd) {
            // First normalize angle and ranges to be between 0 and two pi.
            var TWO_PI = gv.TWO_PI;
            
            angle = angle % TWO_PI;
            if (angle < 0) angle += TWO_PI;
            
            rangeStart = rangeStart % TWO_PI;
            if (rangeStart < 0) rangeStart += TWO_PI;
            
            rangeEnd = rangeEnd % TWO_PI;
            if (rangeEnd < 0) rangeEnd += TWO_PI;
            
            if (rangeStart < rangeEnd) {
                // arc does not go through zero angle
                if (angle >= rangeStart && angle <= rangeEnd) return true;
            } else {
                // Arc through zero angle
                if (angle <= rangeEnd || angle >= rangeStart) return true;
            }
            
            return false;
        },
        
        formatMeters: function(v, abbr, fix) {
            fix = fix == null ? 2 : fix;
            
            if (v >= 100000000) return (v / this.AU).toFixed(fix + 2) + (abbr ? ' au' : ' astronomical units');
            if (v >= 1000000) return (v / 1000000).toFixed(fix) + (abbr ? ' mm' : ' megameters');
            if (v >= 1000) return (v / 1000).toFixed(fix) + (abbr ? ' km' : ' kilometers');
            return v.toFixed(fix) + (abbr ? ' m' : ' meters');
        },
        
        formatMetersForDistance: function(v, abbr, fix) {
            fix = fix == null ? 2 : fix;
            
            if (v >= 1000000000) return (v / this.AU).toFixed(fix + 2) + (abbr ? ' au' : ' astronomical units');
            if (v >= 10000) return (v / 1000).toFixed(fix) + (abbr ? ' km' : ' kilometers');
            return v.toFixed(fix) + (abbr ? ' m' : ' meters');
        }
    };
})();

// Add Font Awesome Cache to the gv object.
(function(gv) {
    var func = myt.FontAwesome.makeTag.bind(myt.FontAwesome);
    gv.FA_PLAY = func(['play']);
    gv.FA_PAUSE= func(['pause']);
})(gv);

gv.Button = new JS.Class('Button', myt.SimpleButton, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        if (attrs.height == null) attrs.height = 16;
        if (attrs.textY == null) attrs.textY = 3;
        
        if (attrs.roundedCorners == null) attrs.roundedCorners = 2;
        attrs.activeColor = '#005500';
        attrs.readyColor = '#006600';
        attrs.hoverColor = '#007700';
        attrs.textColor = '#00ff00';
        
        if (attrs.inset == null) attrs.inset = 3;
        if (attrs.outset == null) attrs.outset = 3;
        
        var shrinkToFit = attrs.shrinkToFit,
            fontSize = attrs.fontSize,
            text = attrs.text || '';
        delete attrs.shrinkToFit;
        delete attrs.fontSize;
        delete attrs.text;
        
        this.callSuper(parent, attrs);
        
        var textView = this.textView = new myt.Text(this, {
            x:this.inset, 
            y:this.textY, 
            text:text,
            whiteSpace:'nowrap',
            domClass:'myt-Text mytButtonText'
        });
        if (fontSize) textView.setFontSize(fontSize);
        if (shrinkToFit) this.applyConstraint('__update', [this, 'inset', this, 'outset', textView, 'width']);
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setText: function(v) {
        if (this.inited) this.textView.setText(v);
    },
    
    getText: function() {
        return this.textView.text;
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    /** @private */
    __update: function(v) {
        if (!this.destroyed) {
            var inset = this.inset,
                textView = this.textView;
            textView.setX(inset);
            this.setWidth(inset + textView.width + this.outset);
        }
    }
});

gv.CenteredButton = new JS.Class('CenteredButton', gv.Button, {
    initNode: function(parent, attrs) {
        attrs.roundedCorners = 9;
        attrs.height = 18;
        attrs.textY = 4;
        
        this.callSuper(parent, attrs);
        
        var textView = this.textView;
        textView.setAlign('center');
    }
});

gv.CircleButton = new JS.Class('CircleButton', gv.Button, {
    initNode: function(parent, attrs) {
        attrs.roundedCorners = 9;
        attrs.width = attrs.height = 18;
        
        this.callSuper(parent, attrs);
        
        var textView = this.textView;
        textView.setAlign('center');
        textView.setValign('middle');
        myt.FontAwesome.registerForNotification(textView);
    }
});

gv.SliderThumb = new JS.Class('Slider', myt.SimpleSliderThumb, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        if (attrs.activeColor == null) attrs.activeColor = '#00bb00';
        if (attrs.readyColor == null) attrs.readyColor = '#00cc00';
        if (attrs.hoverColor == null) attrs.hoverColor = '#00dd00';
        
        this.callSuper(parent, attrs);
    }
});

gv.Slider = new JS.Class('Slider', myt.Slider, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        if (attrs.bgColor == null) attrs.bgColor = '#006600';
        if (attrs.thumbClass == null) attrs.thumbClass = gv.SliderThumb;
        
        var text = attrs.text || '';
        delete attrs.text;
        
        this.callSuper(parent, attrs);
        
        this.thumb.setFocusable(false);
        
        var textView = this.textView = new myt.Text(this, {
            y:5, 
            whiteSpace:'nowrap',
            textColor:'#00ff00',
            fontSize:'10px',
            alignOffset:8,
            align:'right'
        });
        
        this._updateTextPosition();
        this._updateText();
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setValue: function(v) {
        this.callSuper(v);
        if (this.inited) this._updateTextPosition();
    },
    
    /** @private */
    _updateTextPosition: function() {
        this.textView.setAlign(this.value > (this.maxValue + this.minValue) / 2 ? 'left' : 'right');
    },
    
    setTooltip: function(v) {this.domElement.title = v;},
    
    setText: function(v) {
        this.text = v;
        if (this.inited) this._updateText();
    },
    
    /** @private */
    _updateText: function() {
        this.textView.setText(this.text);
    }
});
