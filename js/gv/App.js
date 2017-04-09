/** The root view for the Gravity toy.
    
    Events:
        None
    
    Attributes:
        None
*/
gv.App = new JS.Class('App', myt.View, {
    include: [myt.SizeToWindow],
    
    
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        var self = this,
            M = myt,
            GV = gv,
            AU = GV.AU;
        
        attrs.bgColor = '#003300';
        attrs.minWidth = attrs.minHeight = 600;
        
        self.callSuper(parent, attrs);
        GV.app = self;
        
        // Create Spacetime
        var spacetime = GV.spacetime = new GV.Spacetime(),
            mobArray = [
                {x:0,                   y:0, vx:0, vy:0,            mass:1.989e30, density:1410, type:'star',   label:'Sun'},
                {x:0.387 * AU,          y:0, vx:0, vy:47360,        mass:3.285e23, density:5420, type:'planet', label:'Mercury'},
                {x:-(0.723 * AU),       y:0, vx:0, vy:-35020,       mass:4.867e24, density:5243, type:'planet', label:'Venus'},
                
                {x:149.60e9,            y:0, vx:0, vy:30000,        mass:5.972e24, density:5520, type:'planet', label:'Earth'},
                {x:149.60e9 + 3.844e8,  y:0, vx:0, vy:30000 + 1023, mass:7.348e22, density:3344, type:'moon',   label:'Luna'},
                
                {
                    x:-227.92e9, y:0,
                    vx:0, vy:-24070,
                    mass:6.417e23, density:3933, 
                    type:'planet', label:'Mars'
                },{
                    x:-227.92e9 + 9.378e6, y:0, 
                    vx:0, vy:-24070 + gv.radiusAndPeriodToSpeed(9.378e6, 0.31891), 
                    mass:1.06e16, density:1900, 
                    type:'moon', label:'Phobos'
                },{
                    x:-227.92e9 - 23.459e6, y:0, 
                    vx:0, vy:-24070 - gv.radiusAndPeriodToSpeed(23.459e6, 1.26244), 
                    mass:2.4e15, density:1750, 
                    type:'moon', label:'Deimos'
                },{
                    x:778.57e9,
                    y:0, vx:0, vy:13060,
                    mass:1.89819e27, density:1326,
                    type:'planet', label:'Jupiter'
                },
            ];
            
            for (var i = 0; 200 > i; i++) {
                mobArray.push({
                    x:AU - (i * 600 * 1000 * 1000), 
                    y:4000000000 * (i % 5) - 2, 
                    vx:0, 
                    vy:30000 + 1000 + i * 100, 
                    mass:1.0e16 * (i + 1), 
                    density:1500, 
                    type:'asteroid',
                    label:'Asteroid ' + i
                });
            }
        spacetime.bulkAdd(mobArray);
        
        // Build UI
        var mapContainer = this.mapContainer = new M.View(self);
        
        GV.map = self.map = new GV.Map(mapContainer, {
            scaleValue:20.2,
            centerMob:spacetime.getMobByLabel('Sun'),
            align:'right', valign:'top', alignOffset:4, valignOffset:4, expanded:true
        });
        
        GV.shipMap = self.shipMap = new GV.Map(mapContainer, {
            scaleValue:15.5,
            centerMob:spacetime.getMobByLabel('Earth'),
            align:'right', valign:'bottom', alignOffset:4, valignOffset:4
        });
        
        GV.targetMap = self.targetMap = new GV.Map(mapContainer, {
            scaleValue:15,
            centerMob:spacetime.getMobByLabel('Luna'),
            align:'left', valign:'bottom', alignOffset:4, valignOffset:4
        });
        
        // Controls
        new GV.Slider(self, {x:5, y:5, width:160, value:13, minValue:0, maxValue:19}, [{
            setValue: function(v) {
                this.callSuper(v);
                
                var txt, timeScale;
                switch (this.value) {
                    case 0:  timeScale = 0; txt = 'paused'; break;
                    case 1:  timeScale = 1; txt = 'realtime'; break;
                    case 2:  timeScale = 5; txt = '5 sec/sec'; break;
                    case 3:  timeScale = 30; txt = '30 sec/sec'; break;
                    case 4:  timeScale = 60; txt = '1 min/sec'; break;
                    case 5:  timeScale = 60 * 5; txt = '5 min/sec'; break;
                    case 6:  timeScale = 60 * 15; txt = '15 min/sec'; break;
                    case 7:  timeScale = 60 * 30; txt = '30 min/sec'; break;
                    case 8:  timeScale = 60 * 60; txt = '1 hr/sec'; break;
                    case 9:  timeScale = 60 * 60 * 2; txt = '2 hr/sec'; break;
                    case 10: timeScale = 60 * 60 * 3; txt = '3 hr/sec'; break;
                    case 11: timeScale = 60 * 60 * 6; txt = '6 hr/sec'; break;
                    case 12: timeScale = 60 * 60 * 12; txt = '12 hr/sec'; break;
                    case 13: timeScale = 60 * 60 * 24; txt = '1 day/sec'; break;
                    case 14: timeScale = 60 * 60 * 24 * 2; txt = '2 day/sec'; break;
                    case 15: timeScale = 60 * 60 * 24 * 3; txt = '3 day/sec'; break;
                    case 16: timeScale = 60 * 60 * 24 * 4; txt = '4 day/sec'; break;
                    case 17: timeScale = 60 * 60 * 24 * 5; txt = '5 day/sec'; break;
                    case 18: timeScale = 60 * 60 * 24 * 6; txt = '6 day/sec'; break;
                    case 19: timeScale = 60 * 60 * 24 * 7; txt = '1 week/sec'; break;
                }
                this.setText(txt);
                if (timeScale > 0) {
                    GV.updateTimeScaling(timeScale);
                    spacetime.start();
                } else {
                    spacetime.stop();
                }
            }
        }]);
        
        self._updateSize();
        
        global.hideSpinner();
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    setWidth:function(v, supressEvent) {
        this.callSuper(v, supressEvent);
        if (this.inited) this._updateSize();
    },
    
    setHeight:function(v, supressEvent) {
        this.callSuper(v, supressEvent);
        if (this.inited) this._updateSize();
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    /** @private */
    _updateSize: function() {
        var self = this,
            mapContainer = self.mapContainer,
            size = Math.min(self.width, self.height);
        mapContainer.setWidth(size);
        mapContainer.setHeight(size);
        self.map.updateSize();
        self.shipMap.updateSize();
        self.targetMap.updateSize();
    },
    
    notifyMapExpansionChange: function(changedMap) {
        var self = this,
            maps = [self.map, self.shipMap, self.targetMap], 
            i = 3, map;
        if (changedMap.expanded) {
            while (i) {
                map = maps[--i];
                if (changedMap !== map && map.expanded && !map.closed) {
                    map.setExpanded(false);
                    break;
                }
            }
        }
    }
});
