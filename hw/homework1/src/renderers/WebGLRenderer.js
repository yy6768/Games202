class WebGLRenderer {
    meshes = [];
    shadowMeshes = [];
    lights = [];

    constructor(gl, camera) {
        this.gl = gl;
        this.camera = camera;
    }

    addLight(light) {
        this.lights.push({
            entity: light,
            meshRender: new MeshRender(this.gl, light.mesh, light.mat)
        });
    }
    addMeshRender(mesh) { this.meshes.push(mesh); }
    addShadowMeshRender(mesh) { this.shadowMeshes.push(mesh); }

    render(deltaTime) {
        const gl = this.gl;

        gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
        gl.clearDepth(1.0); // Clear everything
        gl.enable(gl.DEPTH_TEST); // Enable depth testing
        gl.depthFunc(gl.LEQUAL); // Near things obscure far things

        console.assert(this.lights.length != 0, "No light");
        // console.assert(this.lights.length == 1, "Multiple lights");

        for (let meshRender of this.meshes) {
            meshRender.mesh.transform.rotate[1] += degrees2Radians(meshRender.mesh.rotateSpeed) * deltaTime;
        }

        for (let l = 0; l < this.lights.length; l++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.lights[l].entity.fbo); // 绑定到当前光源的framebuffer
            gl.clearColor(1.0, 1.0, 1.0, 1.0); // shadowmap默认白色（无遮挡），解决地面边缘产生阴影的问题（因为地面外采样不到，默认值为0会认为是被遮挡）
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // 清除shadowmap上一帧的颜色、深度缓存，否则会一直叠加每一帧的结果
            // Draw light
            // 光源运动
            let light = this.lights[l].entity;
            this.lights[l].entity.lightPos = vec3.rotateY(light.lightPos, light.lightPos, light.focalPoint, degrees2Radians(light.lightSpeed) * deltaTime);

            this.lights[l].meshRender.mesh.transform.translate = this.lights[l].entity.lightPos;
            this.lights[l].meshRender.draw(this.camera);

            // Shadow pass
            if (this.lights[l].entity.hasShadowMap == true) {
                for (let i = 0; i < this.shadowMeshes.length; i++) {
                    if(this.shadowMeshes[i].material.lightIndex != l) // 匹配正确的光源才继续
                        continue;
                    this.gl.useProgram(this.shadowMeshes[i].shader.program.glShaderProgram);
                    let transform = this.shadowMeshes[i].mesh.transform;
                    let lightMVP = this.lights[l].entity.CalcLightMVP(transform.translate, transform.scale, transform.rotate);
                    this.shadowMeshes[i].material.uniforms.uLightMVP = { type: 'matrix4fv', value: lightMVP };
                    this.shadowMeshes[i].draw(this.camera);
                }
            }
            if(l != 0)
            {
                // opengl有混合模式，意在渲染非透明
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
            }
            // Camera pass
            for (let i = 0; i < this.meshes.length; i++) {
                if(this.meshes[i].material.lightIndex != l) 
                    continue;
                this.gl.useProgram(this.meshes[i].shader.program.glShaderProgram);
                // this.gl.uniform3fv(this.meshes[i].shader.program.uniforms.uLightPos, this.lights[l].entity.lightPos);
                let transform = this.meshes[i].mesh.transform;
                let lightMVP = this.lights[l].entity.CalcLightMVP(transform.translate, transform.scale, transform.rotate);
                this.meshes[i].material.uniforms.uLightMVP = { type: 'matrix4fv', value: lightMVP };
                this.meshes[i].material.uniforms.uLightPos = { type: '3fv', value: this.lights[l].entity.lightPos }; // 光源方向计算、光源强度衰减
                this.meshes[i].draw(this.camera);
            }
            gl.disable(gl.BLEND);
        }
    }
}