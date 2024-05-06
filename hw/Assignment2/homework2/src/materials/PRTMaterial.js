class PRTMaterial extends Material {
    constructor(vertexShader, fragmentShader) {
        //constructor(uniforms, attribs, vsSrc, fsSrc, frameBuffer)
        super({
            "uPrecomputeL[0]" : {type:'9fv', value: null},
            'uPrecomputeL[1]' : {type:'9fv', value: null},
            'uPrecomputeL[2]' : {type:'9fv', value: null}
        }, 
        ['aPrecomputeLT'], 
        vertexShader, 
        fragmentShader, null);
    }
}
    
async function buildPRTMaterial(vertexPath, fragmentPath) {    
    let vertexShader = await getShaderString(vertexPath);
    let fragmentShader = await getShaderString(fragmentPath);
    
    return new PRTMaterial(vertexShader, fragmentShader);
    
}
