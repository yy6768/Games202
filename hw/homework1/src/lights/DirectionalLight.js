class DirectionalLight {

    constructor(lightIntensity, lightColor, lightPos, focalPoint, lightUp, hasShadowMap, gl, lightIndex, lightSpeed) {
        this.mesh = Mesh.cube(setTransform(0, 0, 0, 0.2, 0.2, 0.2, 0));
        this.mat = new EmissiveMaterial(lightIntensity, lightColor);
        this.lightPos = lightPos;
        this.focalPoint = focalPoint;
        this.lightUp = lightUp
        this.lightIndex = lightIndex;
        this.lightSpeed = lightSpeed;
        this.hasShadowMap = hasShadowMap;
        this.fbo = new FBO(gl);
        if (!this.fbo) {
            console.log("无法设置帧缓冲区对象");
            return;
        }
    }

    CalcLightMVP(translate, scale, rotate = [0, 0, 0]) {
        let lightMVP = mat4.create();
        let modelMatrix = mat4.create();
        let viewMatrix = mat4.create();
        let projectionMatrix = mat4.create();
        // Model transform
        mat4.translate(modelMatrix, modelMatrix, translate);
        mat4.rotateX(modelMatrix, modelMatrix, rotate[0]);
		mat4.rotateY(modelMatrix, modelMatrix, rotate[1]);
		mat4.rotateZ(modelMatrix, modelMatrix, rotate[2]);
        mat4.scale(modelMatrix, modelMatrix, scale);
        // View transform
        mat4.lookAt(viewMatrix, this.lightPos, this.focalPoint, this.lightUp);
        // Projection transform
        mat4.ortho(projectionMatrix, -150, 150, -150, 150, 1e-2, 500);
        mat4.multiply(lightMVP, projectionMatrix, viewMatrix);
        mat4.multiply(lightMVP, lightMVP, modelMatrix);

        return lightMVP;
    }
}
