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
        var spacetime = GV.spacetime = new GV.Spacetime();
        self._buildSolarSystem(spacetime);
        
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
    
    setHighlightMob: function(v) {
        if (this.highlightMob !== v) {
            this.highlightMob = v;
            
            // Force a redraw if spacetime is not updating
            var GV = gv;
            if (!GV.spacetime.isRunning()) {
                GV.map.redraw();
                GV.shipMap.redraw();
                GV.targetMap.redraw();
            }
        }
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
    },
    
    /** @private */
    _buildSolarSystem: function(spacetime) {
        var M = myt,
            GV = gv,
            PI = Math.PI,
            mobs = [];
        
        var sun = new GV.Mob({x:0, y:0, vx:0, vy:0, mass:1.989e30, density:1410, type:'star', label:'Sun'});
        mobs.push(sun);
        
        var mercury = new GV.Mob({mass:3.3011e23, density:5427, type:'planet', label:'Mercury'});
        GV.giveMobCircularOrbit(mercury, sun, 57.91e9, 0);
        mobs.push(mercury);
        
        var venus = new GV.Mob({mass:4.8675e24, density:5243, type:'planet', label:'Venus'});
        GV.giveMobCircularOrbit(venus, sun, 108.21e9, PI/2);
        mobs.push(venus);
        
        var earth = new GV.Mob({mass:5.9724e24, density:5514, type:'planet', label:'Earth'});
        GV.giveMobCircularOrbit(earth, sun, 149.60e9, PI);
        mobs.push(earth);
            
            var luna = new GV.Mob({mass:7.346e22, density:3344, type:'moon', label:'Luna'});
            GV.giveMobCircularOrbit(luna, earth, 3.844e8, 0);
            mobs.push(luna);
        
        var mars = new GV.Mob({mass:6.4171e23, density:3933, type:'planet', label:'Mars'});
        GV.giveMobCircularOrbit(mars, sun, 227.92e9, 3*PI/2);
        mobs.push(mars);
            
            // Orbit radius is doubled since DENSITY_SCALING makes phobos unstable
            var phobos = new GV.Mob({mass:1.06e16, density:1900, type:'moon', label:'Phobos'});
            GV.giveMobCircularOrbit(phobos, mars, 2*9.378e6, 0);
            mobs.push(phobos);
            
            var deimos = new GV.Mob({mass:2.4e15, density:1750, type:'moon', label:'Deimos'});
            GV.giveMobCircularOrbit(deimos, mars, 2*23.459e6, PI);
            mobs.push(deimos);
        
        var asteroid, i, count = 150,
            lowerRange = 329.115316e9,
            upperRange = 478.713186e9,
            averageMass = 3.2e21 / count;
        for (i = 0; count > i; i++) {
            asteroid = new GV.Mob({mass:M.getRandomArbitrary(averageMass/10, averageMass*10), density:2000, type:'asteroid', label:'Asteroid ' + i});
            GV.giveMobCircularOrbit(asteroid, sun, M.getRandomArbitrary(lowerRange, upperRange), M.getRandomArbitrary(0, 2*PI));
            mobs.push(asteroid);
        }
        
        var jupiter = new GV.Mob({mass:1.89819e27, density:1326, type:'planet', label:'Jupiter'});
        GV.giveMobCircularOrbit(jupiter, sun, 778.57e9, 0);
        mobs.push(jupiter);
            
            var io = new GV.Mob({mass:893.2e20, density:3530, type:'moon', label:'Io'});
            GV.giveMobCircularOrbit(io, jupiter, 421.700e6, 0);
            mobs.push(io);
            
            var europa = new GV.Mob({mass:480.0e20, density:3010, type:'moon', label:'Europa'});
            GV.giveMobCircularOrbit(europa, jupiter, 671.034e6, 0);
            mobs.push(europa);
            
            var ganymede = new GV.Mob({mass:1481.9e20, density:1940, type:'moon', label:'Ganymede'});
            GV.giveMobCircularOrbit(ganymede, jupiter, 1070.4127e6, 0);
            mobs.push(ganymede);
            
            var callisto = new GV.Mob({mass:10759e20, density:1830, type:'moon', label:'Callisto'});
            GV.giveMobCircularOrbit(callisto, jupiter, 1882.709e6, 0);
            mobs.push(callisto);
            
            var himalia = new GV.Mob({mass:670e16, density:2600, type:'moon', label:'Himalia'});
            GV.giveMobCircularOrbit(himalia, jupiter, 11451.971e6, 0);
            mobs.push(himalia);
            
            var amalthea = new GV.Mob({mass:208e16, density:857, type:'moon', label:'Amalthea'});
            GV.giveMobCircularOrbit(amalthea, jupiter, 181.366e6, 0);
            mobs.push(amalthea);
            
            var elara = new GV.Mob({mass:87e16, density:2600, type:'moon', label:'Elara'});
            GV.giveMobCircularOrbit(elara, jupiter, 11778.034e6, 0);
            mobs.push(elara);
            
            var thebe = new GV.Mob({mass:43e16, density:860, type:'moon', label:'Thebe'});
            GV.giveMobCircularOrbit(thebe, jupiter, 221.889e6, 0);
            mobs.push(thebe);
        
        var saturn = new GV.Mob({mass:5.6834e26, density:687, type:'planet', label:'Saturn'});
        GV.giveMobCircularOrbit(saturn, sun, 1433.53e9, PI/2);
        mobs.push(saturn);
            
            var mimas = new GV.Mob({mass:0.379e20, density:1150, type:'moon', label:'Mimas'});
            GV.giveMobCircularOrbit(mimas, saturn, 185.404e6, 0);
            mobs.push(mimas);
            
            var enceladus = new GV.Mob({mass:1.08e20, density:1610, type:'moon', label:'Enceladus'});
            GV.giveMobCircularOrbit(enceladus, saturn, 237.950e6, PI/2);
            mobs.push(enceladus);
            
            var tethys = new GV.Mob({mass:6.18e20, density:985, type:'moon', label:'Tethys'});
            GV.giveMobCircularOrbit(tethys, saturn, 294.619e6, PI);
            mobs.push(tethys);
            
            var dione = new GV.Mob({mass:11.0e20, density:1480, type:'moon', label:'Dione'});
            GV.giveMobCircularOrbit(dione, saturn, 377.396e6, 3*PI/2);
            mobs.push(dione);
            
            var rhea = new GV.Mob({mass:23.1e20, density:1240, type:'moon', label:'Rhea'});
            GV.giveMobCircularOrbit(rhea, saturn, 527.108e6, 0);
            mobs.push(rhea);
            
            var titan = new GV.Mob({mass:1345.5e20, density:1880, type:'moon', label:'Titan'});
            GV.giveMobCircularOrbit(titan, saturn, 1221.930e6, PI/2);
            mobs.push(titan);
            
            var hyperion = new GV.Mob({mass:0.056e20, density:550, type:'moon', label:'Hyperion'});
            GV.giveMobCircularOrbit(hyperion, saturn, 1481.010e6, PI);
            mobs.push(hyperion);
            
            var iapetus = new GV.Mob({mass:18.1e20, density:1090, type:'moon', label:'Iapetus'});
            GV.giveMobCircularOrbit(iapetus, saturn, 3560.820e6, 3*PI/2);
            mobs.push(iapetus);
            
            var phoebe = new GV.Mob({mass:8.292e18, density:1640, type:'moon', label:'Phoebe'});
            GV.giveMobCircularOrbit(phoebe, saturn, 12869.700e6, 0, true);
            mobs.push(phoebe);
        
        var uranus = new GV.Mob({mass:8.6813e25, density:1271, type:'planet', label:'Uranus'});
        GV.giveMobCircularOrbit(uranus, sun, 2872.46e9, PI);
        mobs.push(uranus);
            
            var miranda = new GV.Mob({mass:0.66e20, density:1200, type:'moon', label:'Miranda'});
            GV.giveMobCircularOrbit(miranda, uranus, 129.390e6, 0);
            mobs.push(miranda);
            
            var ariel = new GV.Mob({mass:12.9e20, density:1590, type:'moon', label:'Ariel'});
            GV.giveMobCircularOrbit(ariel, uranus, 191.020e6, 0);
            mobs.push(ariel);
            
            var umbriel = new GV.Mob({mass:12.2e20, density:1460, type:'moon', label:'Umbriel'});
            GV.giveMobCircularOrbit(umbriel, uranus, 266.300e6, 0);
            mobs.push(umbriel);
            
            var titania = new GV.Mob({mass:34.2e20, density:1660, type:'moon', label:'Titania'});
            GV.giveMobCircularOrbit(titania, uranus, 435.910e6, 0);
            mobs.push(titania);
            
            var oberon = new GV.Mob({mass:28.8e20, density:1560, type:'moon', label:'Oberon'});
            GV.giveMobCircularOrbit(oberon, uranus, 583.520e6, 0);
            mobs.push(oberon);
            
            var puck = new GV.Mob({mass:2.90e18, density:1000, type:'moon', label:'Puck'});
            GV.giveMobCircularOrbit(puck, uranus, 86.010e6, 0);
            mobs.push(puck);
            
            var sycorax = new GV.Mob({mass:2.30e18, density:1000, type:'moon', label:'Sycorax'});
            GV.giveMobCircularOrbit(sycorax, uranus, 12179.000e6, 0, true);
            mobs.push(sycorax);
        
        var neptune = new GV.Mob({mass:10.2413e25, density:1638, type:'planet', label:'Neptune'});
        GV.giveMobCircularOrbit(neptune, sun, 4495.06e9, 3*PI/2);
        mobs.push(neptune);
            
            // Doubled orbits due to density scaling.
            var triton = new GV.Mob({mass:2140.800e19, density:1000, type:'moon', label:'Triton'});
            GV.giveMobCircularOrbit(triton, neptune, 2*354.759e6, 0, true);
            mobs.push(triton);
            
            var proteus = new GV.Mob({mass:5035e16, density:1000, type:'moon', label:'Proteus'});
            GV.giveMobCircularOrbit(proteus, neptune, 2*117.646e6, 0);
            mobs.push(proteus);
            
            var nereid = new GV.Mob({mass:2700e16, density:1000, type:'moon', label:'Nereid'});
            GV.giveMobCircularOrbit(nereid, neptune, 5513.818e6, 0);
            mobs.push(nereid);
            
            var larissa = new GV.Mob({mass:495e16, density:1000, type:'moon', label:'Larissa'});
            GV.giveMobCircularOrbit(larissa, neptune, 2*73.548e6, 0);
            mobs.push(larissa);
            
            var galatea = new GV.Mob({mass:375e16, density:1000, type:'moon', label:'Galatea'});
            GV.giveMobCircularOrbit(galatea, neptune, 2*61.953e6, 0);
            mobs.push(galatea);
            
            var despina = new GV.Mob({mass:210e16, density:1000, type:'moon', label:'Despina'});
            GV.giveMobCircularOrbit(despina, neptune, 2*52.526e6, 0);
            mobs.push(despina);
        
        var pluto = new GV.Mob({mass:0.01303e24, density:1860, type:'planet', label:'Pluto'});
        GV.giveMobCircularOrbit(pluto, sun, 5906.38e9, 0);
        mobs.push(pluto);
        
            var charon = new GV.Mob({mass:1.586e21, density:1700, type:'moon', label:'Charon'});
            GV.giveMobCircularOrbit(charon, pluto, 19.596e6, 0);
            mobs.push(charon);
            
            var nix = new GV.Mob({mass:4.5e16, density:1852, type:'moon', label:'Nix'});
            GV.giveMobCircularOrbit(nix, pluto, 48.694e6, PI);
            mobs.push(nix);
            
            var hydra = new GV.Mob({mass:4.8e16, density:1852, type:'moon', label:'Hydra'});
            GV.giveMobCircularOrbit(hydra, pluto, 64.738e6, PI);
            mobs.push(hydra);
            
            var kerberos = new GV.Mob({mass:1.6e16, density:1852, type:'moon', label:'Kerberos'});
            GV.giveMobCircularOrbit(kerberos, pluto, 57.783e6, PI);
            mobs.push(kerberos);
            
            var styx = new GV.Mob({mass:7.5e15, density:1852, type:'moon', label:'Styx'});
            GV.giveMobCircularOrbit(styx, pluto, 42.410e6, PI);
            mobs.push(styx);
        
        // Kuiper Belt
        count = 100;
        lowerRange = 39.5 * GV.AU;
        upperRange = 48 * GV.AU;
        averageMass = 3.2e19 / count;
        for (i = 0; count > i; i++) {
            asteroid = new GV.Mob({mass:M.getRandomArbitrary(averageMass/10, averageMass*10), density:1000, type:'asteroid', label:'Kuiper Belt Object ' + i});
            GV.giveMobCircularOrbit(asteroid, sun, M.getRandomArbitrary(lowerRange, upperRange), M.getRandomArbitrary(0, 2*PI));
            mobs.push(asteroid);
        }
        
        spacetime.bulkAddMob(mobs);
    }
});
