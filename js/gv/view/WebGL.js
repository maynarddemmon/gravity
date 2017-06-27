/** A canvas setup for WebGL
    
    Events:
        None
    
    Attributes:
        None
*/
gv.WebGL = new JS.Class('WebGL', myt.View, {
    // Life Cycle //////////////////////////////////////////////////////////////
    initNode: function(parent, attrs) {
        attrs.tagName = 'canvas';
        
        this.callSuper(parent, attrs);
        
        // Only continue if WebGL is available and working
        var gl = this.gl;
        if (gl) {
            gl.getExtension('OES_standard_derivatives');
            
            // To disable the background color of the canvas element effecting
            // the color of each vertex.
            gl.blendFunc(gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR);
            
            gl.enable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);
            
            this.startTime = Date.now();
            
            // Create the shader program
            var shaderProgram = this.shaderProgram = gl.createProgram();
            this._attachShader('shader-vertex', 'vertex');
            this._attachShader('shader-fragment', 'fragment');
            gl.linkProgram(shaderProgram);
            
            if (gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                gl.useProgram(shaderProgram);
                
                // Init buffers
                this._initBuffer('aVtxPosition');
                this._initBuffer('aVtxColor');
                this._initBuffer('aVtxSize');
                this._initBuffer('aVtxType');
            } else {
                console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
                this.destroy();
            }
        } else {
            console.error('Unable to initialize WebGL. Your browser may not support it.');
            this.destroy();
        }
    },
    
    /** @private */
    _initBuffer: function(attrName) {
        var gl = this.gl,
            name = '_' + attrName;
        this[name] = gl.createBuffer();
        gl.enableVertexAttribArray(this.shaderProgram[name] = gl.getAttribLocation(this.shaderProgram, attrName));
    },
    
    /** @private */
    _attachShader: function(id, type) {
        var gl = this.gl,
            source = document.getElementById(id),
            shader = gl.createShader(type === 'fragment' ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
        gl.shaderSource(shader, source ? source.text : null);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.attachShader(this.shaderProgram, shader);
        } else {
            console.log('An error occurred compiling the shader: ' + id + ' : ' + gl.getShaderInfoLog(shader));  
            gl.deleteShader(shader);
        }
    },
    
    /** @overrides myt.View */
    createOurDomElement: function(parent) {
        var canvas = this.callSuper(parent);
        canvas.className = 'mytUnselectable';
        
        // Try to grab the standard context. If it fails, fallback to experimental.
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        return canvas;
    },
    
    
    // Accessors ///////////////////////////////////////////////////////////////
    /** @overrides myt.View
        Needed because canvas must also set width/height attribute.
        See: http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#attr-canvas-width */
    setWidth: function(v, supressEvent) {
        if (0 > v) v = 0;
        this.domElement.setAttribute('width', v);
        this.callSuper(v, supressEvent);
        if (this.inited) this.__updateSize();
    },
    
    /** @overrides myt.View
        Needed because canvas must also set width/height attribute.
        See: http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#attr-canvas-width */
    setHeight: function(v, supressEvent) {
        if (0 > v) v = 0;
        this.domElement.setAttribute('height', v);
        this.callSuper(v, supressEvent);
        if (this.inited) this.__updateSize();
    },
    
    /** @private */
    __updateSize: function() {
        this.gl.viewport(0, 0, this.width, this.height);
    },
    
    
    // Methods /////////////////////////////////////////////////////////////////
    redraw: function(data) {
        var gl = this.gl,
            shaderProgram = this.shaderProgram;
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        if (data.count > 0) {
            // Provide uniforms
            gl.uniform2f(gl.getUniformLocation(shaderProgram, "u_resolution"), this.width, this.height);
            //gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_time"), (Date.now() - this.startTime) / 1000);
            //gl.uniform2f(gl.getUniformLocation(shaderProgram, "u_mouse"), this.mouseX || 0, this.mouseY || 0);
            
            // Provide attributes to vertext shader
            this._vertexAttributePointer('aVtxPosition', data.position, 2);
            this._vertexAttributePointer('aVtxSize', data.size, 1);
            this._vertexAttributePointer('aVtxColor', data.color, 4);
            this._vertexAttributePointer('aVtxType', data.renderType, 1);
            
            // Draw
            gl.drawArrays(gl.POINTS, 0, data.count);
        }
    },
    
    /** @private */
    _vertexAttributePointer: function(name, array, size) {
        name = '_' + name;
        var gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this[name]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.shaderProgram[name], size, gl.FLOAT, false, 0, 0);
    }
});
