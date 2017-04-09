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
gv = (function() {
    var timeSlicesPerSecond = 60,
        millisPerCalc = Math.ceil(1000 / timeSlicesPerSecond),
        secondsPerCalc = millisPerCalc / 1000;
    
    return {
        // How many times the simulation is recalculated per real second.
        TIME_SLICES_PER_SECOND:timeSlicesPerSecond,
        
        // How many millis occur during one time slice.
        MILLIS_PER_CALC:millisPerCalc,
        
        // How many seconds occur during one time slice.
        SECONDS_PER_CALC:secondsPerCalc,
        
        SIMULATED_SECONDS_PER_TIME_SLICE:null, // Will be updated when the time slider gets set via this.updateTimeScaling.
        
        updateTimeScaling: function(v) {
            this.SIMULATED_SECONDS_PER_TIME_SLICE = this.SECONDS_PER_CALC * v;
        },
        
        // Makes all mobs larger
        DENSITY_SCALING:1000,
        
        // Used in volume of a sphere calculations.
        THREE_OVER_FOUR_PI:3 / (4 * Math.PI),
        
        // The gravitational constant
        G:6.674e-11,
        
        // 1 astronomical unit in meters
        AU:149597870700,
        
        // A reference to the gv.App object
        app:null,
        
        // A reference to the gv.Spacetime object
        spacetime:null,
        
        // A reference to the main gv.Map object
        map:null,
        
        // A reference to the ship gv.Map object
        shipMap:null,
        
        // A reference to the target gv.Map object
        targetMap:null,
        
        HALO_RADIUS_BY_TYPE: {
            star:3,
            planet:100,
            moon:20
        },
        
        MOB_COLOR_BY_TYPE: {
            star:'#ffff00',
            planet:'#0099ff',
            moon:'#cccccc'
        },
        
        circleIntersectsCircle: function(ax, ay, ar, bx, by, br) {
            return myt.Geometry.measureDistance(ax, ay, bx, by, true) < (ar + br) * (ar + br);
        },
        
        circleContainsCircle: function(ax, ay, ar, bx, by, br) {
            return (ar >= br) && (myt.Geometry.measureDistance(ax, ay, bx, by, true) <= (ar - br) * (ar - br));
        },
    };
})();

gv.Button = new JS.Class('Button', myt.SimpleButton, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        if (attrs.height == null) attrs.height = 16;
        if (attrs.textY == null) attrs.textY = 2;
        
        if (attrs.roundedCorners == null) attrs.roundedCorners = 2;
        attrs.activeColor = '#005500';
        attrs.readyColor = '#006600';
        attrs.hoverColor = '#007700';
        attrs.textColor = '#00ff00';
        
        if (attrs.inset == null) attrs.inset = 3;
        if (attrs.outset == null) attrs.outset = 3;
        
        var shrinkToFit = attrs.shrinkToFit,
            text = attrs.text || '';
        delete attrs.shrinkToFit;
        delete attrs.text;
        
        this.callSuper(parent, attrs);
        
        var textView = this.textView = new myt.Text(this, {
            x:this.inset, 
            y:this.textY, 
            text:text,
            whiteSpace:'nowrap',
            domClass:'myt-Text mytButtonText'
        });
        if (shrinkToFit) this.applyConstraint('__update', [this, 'inset', this, 'outset', textView, 'width']);
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setText: function(v) {
        if (this.inited) this.textView.setText(v);
    },
    
    setTooltip: function(v) {this.domElement.title = v;},
    
    
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

gv.CircleButton = new JS.Class('CircleButton', gv.Button, {
    initNode: function(parent, attrs) {
        attrs.roundedCorners = 9;
        attrs.width = attrs.height = 18;
        
        this.callSuper(parent, attrs);
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
        if (attrs.bgColor == null) attrs.bgColor = '#002200';
        if (attrs.thumbClass == null) attrs.thumbClass = gv.SliderThumb;
        
        var text = attrs.text || '';
        delete attrs.text;
        
        this.callSuper(parent, attrs);
        
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
