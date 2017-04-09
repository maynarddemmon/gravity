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
            GV = gv;
        
        attrs.bgColor = '#003300';
        attrs.minWidth = attrs.minHeight = 600;
        
        self.callSuper(parent, attrs);
        GV.app = self;
        
        // Create Spacetime
        var spacetime = GV.spacetime = new GV.Spacetime(),
            AU = GV.AU,
            mobArray = [
                {x:0,                              y:0, vx:0, vy:0,            mass:1.989e30, density:1410, type:'star',   label:'Sun'},
                {x:0.387 * AU + 695732600,         y:0, vx:0, vy:47360,        mass:3.285e23, density:5420, type:'planet', label:'Mercury'},
                {x:0.723 * AU + 695732600,         y:0, vx:0, vy:35020,        mass:4.867e24, density:5243, type:'planet', label:'Venus'},
                {x:1 * AU + 695732600,             y:0, vx:0, vy:30000,        mass:5.972e24, density:5520, type:'planet', label:'Earth'},
                {x:1 * AU + 695732600 + 384400000, y:0, vx:0, vy:30000 + 1023, mass:7.348e22, density:3344, type:'moon',   label:'Luna'},
                
                {x:1 * AU + 695732600 - 200000000, y:0, vx:0, vy:30000 - 1200, mass:7.348e22, density:3344, type:'moon',   label:'Luna 2'}
            ];
            
            for (var i = 0; 200 > i; i++) {
                mobArray.push({
                    x:AU - (i * 600 * 1000 * 1000), 
                    y:4000000000 * (i % 5) - 2, 
                    vx:0, 
                    vy:30000 + 1000 + i * 100, 
                    mass:1.0e22 * (i + 1), 
                    density:2000, 
                    type:'moon',
                    label:'Asteroid ' + i
                });
            }
        spacetime.bulkAdd(mobArray);
        
        // Build UI
        var mapContainer = this.mapContainer = new M.View(self);
        
        GV.map = self.map = new GV.Map(mapContainer, {
            scaleValue:20.2,
            centerMob:spacetime.getMobByLabel('Sun'),
            align:'right', valign:'top', expanded:true
        });
        
        GV.shipMap = self.shipMap = new GV.Map(mapContainer, {
            scaleValue:15.5,
            centerMob:spacetime.getMobByLabel('Earth'),
            align:'right', valign:'bottom'
        });
        
        GV.targetMap = self.targetMap = new GV.Map(mapContainer, {
            scaleValue:15,
            centerMob:spacetime.getMobByLabel('Luna'),
            align:'left', valign:'bottom'
        });
        
        // Controls
        new GV.Slider(self, {x:5, y:5, width:160, value:15, minValue:0, maxValue:18}, [{
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
                    case 7:  timeScale = 60 * 60; txt = '1 hr/sec'; break;
                    case 8:  timeScale = 60 * 60 * 3; txt = '3 hr/sec'; break;
                    case 9:  timeScale = 60 * 60 * 6; txt = '6 hr/sec'; break;
                    case 10: timeScale = 60 * 60 * 12; txt = '12 hr/sec'; break;
                    case 11: timeScale = 60 * 60 * 24; txt = '1 day/sec'; break;
                    case 12: timeScale = 60 * 60 * 24 * 2; txt = '2 day/sec'; break;
                    case 13: timeScale = 60 * 60 * 24 * 3; txt = '3 day/sec'; break;
                    case 14: timeScale = 60 * 60 * 24 * 4; txt = '4 day/sec'; break;
                    case 15: timeScale = 60 * 60 * 24 * 7; txt = '1 wk/sec'; break;
                    case 16: timeScale = 60 * 60 * 24 * 14; txt = '2 wk/sec'; break;
                    case 17: timeScale = 60 * 60 * 24 * 21; txt = '3 wk/sec'; break;
                    case 18: timeScale = 60 * 60 * 24 * 30; txt = '1 mon/sec'; break;
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
