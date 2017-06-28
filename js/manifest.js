JS.Packages(function() {with(this) {
    var ROOT = global.ROOT;
    file(ROOT + 'myt.min.js').provides('myt.all');
    
    // Package:gv
    var GV_ROOT = ROOT + 'gv/';
    file(GV_ROOT + 'gv.js').provides('gv').requires('myt.all');
    
    var GV_MODEL_ROOT = GV_ROOT + 'model/';
    file(GV_MODEL_ROOT + 'Mob.js').provides('gv.Mob').requires('gv');
    file(GV_MODEL_ROOT + 'Ship.js').provides('gv.Ship').requires('gv.Mob');
    file(GV_MODEL_ROOT + 'Spacetime.js').provides('gv.Spacetime').requires('gv.Ship');
    
    var GV_VIEW_ROOT = GV_ROOT + 'view/';
    file(GV_VIEW_ROOT + 'WebGL.js').provides('gv.WebGL').requires('gv');
    file(GV_VIEW_ROOT + 'Map.js').provides('gv.Map').requires('gv.WebGL');
    
    file(GV_ROOT + 'App.js').provides('gv.App').requires('gv.Map','gv.Spacetime');
    
    // Include Everything
    file(GV_ROOT + 'all.js').provides('gv.all').requires('gv.App');
}});
